// Minimal BM25 (Okapi) keyword search, no dependencies.

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'i', 'me', 'my', 'we', 'you', 'do', 'does', 'have', 'has', 'any', 'some',
  'what', 'which', 'want', 'like', 'can', 'could', 'please', 'show', 'give', 'get', 'for', 'to', 'of', 'and',
  'or', 'in', 'on', 'with', 'something', 'anything', 'item', 'items', 'dish', 'dishes', 'food', 'under', 'below',
  'than', 'less', 'rs', 'inr', 'rupees',
]);

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/₹/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)); // crude plural stemming
}

export class BM25 {
  constructor(docs, { k1 = 1.5, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docs = docs.map((d) => {
      const tokens = tokenize(d.text);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      return { id: d.id, len: tokens.length, tf };
    });
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / (this.docs.length || 1) || 1;
    this.df = new Map();
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }

  // Returns Map<id, score>
  search(query) {
    const terms = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const scores = new Map();
    for (const d of this.docs) {
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = this.df.get(t) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen));
      }
      scores.set(d.id, score);
    }
    return scores;
  }
}
