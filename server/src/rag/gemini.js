// Thin wrapper over the Gemini REST API (no SDK needed, Node 18+ has fetch).

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const key = () => process.env.GEMINI_API_KEY;

export const geminiEnabled = () => Boolean(key());

async function call(path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// taskType: RETRIEVAL_DOCUMENT for menu items, RETRIEVAL_QUERY for the customer's question
export async function embedTexts(texts, taskType) {
  const model = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
  const out = [];
  for (let i = 0; i < texts.length; i += 50) {
    const chunk = texts.slice(i, i + 50);
    const data = await call(`models/${model}:batchEmbedContents`, {
      requests: chunk.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: 768,
      })),
    });
    for (const e of data.embeddings) out.push(e.values);
  }
  return out;
}

export async function generate({ system, history = [], user }) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = [
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: user }] },
  ];
  const data = await call(`models/${model}:generateContent`, {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}
