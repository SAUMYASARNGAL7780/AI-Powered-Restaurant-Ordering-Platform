import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import { buildIndex } from './rag/retriever.js';
import { seedIfEmpty } from './seed.js';

for (const k of ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD']) {
  if (!process.env[k]) {
    console.error(`Missing ${k} in server/.env (see .env.example)`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx for rate limiting
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '50kb' }));

app.use('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts, try again later' } }));
app.use('/api/chat', rateLimit({ windowMs: 60 * 1000, max: 15, message: { error: 'Slow down a little, please' } }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);

// In production the same server also serves the built React app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

await mongoose.connect(process.env.MONGODB_URI);
console.log('[db] connected');
await seedIfEmpty();
buildIndex().catch((e) => console.warn('[rag] initial index failed:', e.message));

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Signature Bites server on http://localhost:${port}`));
