import crypto from 'crypto';
import MenuItem from '../models/MenuItem.js';
import { BM25, tokenize } from './bm25.js';
import { embedTexts, geminiEnabled } from './gemini.js';

// Hybrid weights: semantic similarity counts a bit more than keyword match.
const W_BM25 = 0.4;
const W_SEM = 0.6;
// Minimum raw cosine similarity for a meaning-only match (no keyword hit). Lower it if good questions get rejected.
const MIN_SIM = Number(process.env.RAG_MIN_SIMILARITY || 0.6);

export const SPICE_LABEL = ['Not spicy', 'Mild', 'Medium', 'Hot'];

const state = { items: [], bm25: null };

export function docText(item) {
  return [
    `${item.name}.`,
    item.description,
    `Category: ${item.category}.`,
    item.isVeg ? 'Vegetarian, veg.' : 'Non-vegetarian, non-veg.',
    `Spice level: ${SPICE_LABEL[item.spice]}.`,
    (item.tags || []).join(' '),
    `Price: ${item.price} rupees.`,
  ].join(' ');
}

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// (Re)build the in-memory index from MongoDB. Only embeds items that are new or changed.
export async function buildIndex() {
  const docs = await MenuItem.find({ available: true }).select('+embedding +embedHash').lean();
  const stale = [];
  for (const d of docs) {
    d._text = docText(d);
    d._hash = hash(d._text);
    if (!d.embedding?.length || d.embedHash !== d._hash) stale.push(d);
  }
  if (stale.length && geminiEnabled()) {
    try {
      const vecs = await embedTexts(stale.map((d) => d._text), 'RETRIEVAL_DOCUMENT');
      await MenuItem.bulkWrite(
        stale.map((d, i) => ({
          updateOne: { filter: { _id: d._id }, update: { $set: { embedding: vecs[i], embedHash: d._hash } } },
        }))
      );
      stale.forEach((d, i) => (d.embedding = vecs[i]));
      console.log(`[rag] embedded ${stale.length} menu item(s)`);
    } catch (e) {
      console.warn('[rag] embedding failed, using keyword search only:', e.message);
    }
  }
  state.items = docs.map((d) => ({ ...d, id: String(d._id) }));
  state.bm25 = new BM25(state.items.map((d) => ({ id: d.id, text: d._text })));
  console.log(`[rag] index ready with ${state.items.length} item(s)`);
}

let timer;
export function reindexSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => buildIndex().catch((e) => console.warn('[rag] reindex failed:', e.message)), 1500);
}

// Pull dietary / spice / budget preferences out of free text.
export function parseConstraints(q) {
  const text = q.toLowerCase();
  const c = { diet: null, eggless: false, maxSpice: null, minSpice: null, maxPrice: null, cheap: false, generic: false };

  if (/\bnon[- ]?veg(etarian)?\b/.test(text)) c.diet = 'nonveg';
  else if (/\b(veg|vegetarian|pure veg|meat[- ]?free)\b/.test(text)) c.diet = 'veg';
  if (/\b(eggless|no egg|without egg)\b/.test(text)) c.eggless = true;

  if (/\b(mild|not spicy|less spicy|non[- ]?spicy|no spice|low spice|kids?|children)\b/.test(text)) c.maxSpice = 1;
  else if (/\b(spicy|hot(?!\s+(?:tea|coffee|chai|drink|beverage|chocolate|milk|water|soda))|fiery)\b/.test(text)) c.minSpice = 2;

  const price =
    text.match(/(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?|<=?)\s*(?:rs\.?|₹|inr)?\s*(\d{2,4})/) ||
    text.match(/(?:rs\.?|₹)\s*(\d{2,4})/) ||
    text.match(/(\d{2,4})\s*(?:rs|rupees|₹|inr)/);
  if (price) c.maxPrice = Number(price[1]);
  if (/\b(cheap|cheapest|affordable|budget|inexpensive)\b/.test(text)) c.cheap = true;
  // general "show me food" style questions count as menu questions even without a keyword match
  if (/\b(menu|recommend|suggest|popular|best|special|signature|hungry|eat|food|drink|snack|breakfast|lunch|dinner|dessert|sweet|options?)\b/.test(text) || /what (do you|can i|is) (have|serve|sell|get|available)|what.*available|show me (everything|all)/.test(text)) c.generic = true;
  return c;
}

function passes(item, c, { relaxSpice = false, relaxPrice = false } = {}) {
  if (c.diet === 'veg' && !item.isVeg) return false;
  if (c.diet === 'nonveg' && item.isVeg) return false;
  if (c.eggless && (item.tags || []).includes('egg')) return false;
  if (!relaxSpice && c.maxSpice != null && item.spice > c.maxSpice) return false;
  if (!relaxSpice && c.minSpice != null && item.spice < c.minSpice) return false;
  if (!relaxPrice && c.maxPrice != null && item.price > c.maxPrice) return false;
  return true;
}

const normalise = (m) => {
  const vals = [...m.values()];
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  return new Map([...m].map(([k, v]) => [k, max === min ? (max > 0 ? 1 : 0) : (v - min) / span]));
};

export async function search(query, k = 5) {
  if (!state.bm25 || !state.items.length) return { results: [], constraints: parseConstraints(query), mode: 'none', relaxed: false, relevant: false };
  const constraints = parseConstraints(query);

  let pool = state.items.filter((i) => passes(i, constraints));
  let relaxed = false;
  if (!pool.length) {
    // Nothing matches the exact budget/spice: relax those (never relax veg/non-veg) and tell the LLM.
    pool = state.items.filter((i) => passes(i, constraints, { relaxSpice: true, relaxPrice: true }));
    relaxed = true;
  }
  if (!pool.length) return { results: [], constraints, mode: 'none', relaxed, relevant: false };

  // 1) keyword scores
  const bm = state.bm25.search(query);
  const bmNorm = normalise(new Map(pool.map((i) => [i.id, bm.get(i.id) || 0])));

  // 2) semantic scores (only if we have a key and stored vectors)
  let semNorm = null;
  let semMax = 0;
  let mode = 'keyword';
  if (geminiEnabled() && pool.some((i) => i.embedding?.length)) {
    try {
      const [qv] = await embedTexts([query], 'RETRIEVAL_QUERY');
      const rawSem = new Map(pool.map((i) => [i.id, i.embedding?.length ? cosine(qv, i.embedding) : 0]));
      semMax = Math.max(...rawSem.values());
      semNorm = normalise(rawSem);
      mode = 'hybrid';
    } catch (e) {
      console.warn('[rag] query embedding failed, keyword only:', e.message);
    }
  }

  // Is this really a menu question? Normalised scores always put *something* on top, so check raw evidence.
  const bmMax = Math.max(0, ...pool.map((i) => bm.get(i.id) || 0));
  const hasPrefs = constraints.diet || constraints.eggless || constraints.maxSpice != null || constraints.minSpice != null ||
    constraints.maxPrice != null || constraints.cheap || constraints.generic;
  const relevant = bmMax > 0 || semMax >= MIN_SIM || Boolean(hasPrefs);

  const scored = pool.map((i) => {
    let score = semNorm ? W_BM25 * bmNorm.get(i.id) + W_SEM * semNorm.get(i.id) : bmNorm.get(i.id);
    if (constraints.cheap) score += 0.15 * (1 - Math.min(i.price, 300) / 300);
    return { item: i, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, k).map(({ item, score }) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    price: item.price,
    isVeg: item.isVeg,
    spice: item.spice,
    score: Number(score.toFixed(3)),
  }));
  return { results: relevant ? results : [], constraints, mode, relaxed, relevant };
}

// Words that are not food names, so they must not be treated as "an item we don't have".
const NOT_FOOD = new Set([
  'available', 'availability', 'avail', 'serve', 'serving', 'sell', 'selling', 'offer', 'offering', 'got', 'there', 'today',
  'tonight', 'menu', 'order', 'ordering', 'price', 'cost', 'much', 'tell', 'know', 'ask', 'right', 'now', 'also', 'else',
  'stock', 'left', 'kind', 'type', 'option', 'spicy', 'hot', 'mild', 'veg', 'vegetarian', 'nonveg', 'non', 'eggless',
  'cheap', 'cheapest', 'budget', 'affordable', 'restaurant', 'place', 'cafe',
]);

// Food words in the question that appear nowhere on our menu (e.g. "chicken").
export function unmatchedTerms(query) {
  if (!state.bm25) return [];
  return [...new Set(tokenize(query))].filter((t) => !state.bm25.df.has(t) && !NOT_FOOD.has(t));
}

// Compact list of everything we serve, so the LLM knows what does NOT exist.
export function menuSummary() {
  return state.items.map((i) => `${i.name} (₹${i.price}, ${i.isVeg ? 'veg' : 'contains egg'})`).join('; ');
}