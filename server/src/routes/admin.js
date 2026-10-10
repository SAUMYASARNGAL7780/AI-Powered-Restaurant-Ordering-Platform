import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Order from '../models/Order.js';
import { requireAdmin, wrap } from '../middleware/auth.js';
import { reindexSoon } from '../rag/retriever.js';

const router = Router();
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const okUser = same(username ?? '', process.env.ADMIN_USERNAME);
  const okPass = same(password ?? '', process.env.ADMIN_PASSWORD);
  if (!(okUser && okPass)) return res.status(401).json({ error: 'Wrong username or password' });
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// Everything below needs a valid admin token.
router.use(requireAdmin);

// ---------- Orders ----------
router.get(
  '/orders',
  wrap(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.payment) filter['payment.status'] = String(req.query.payment);
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
  })
);

router.patch(
  '/orders/:id/payment',
  wrap(async (req, res) => {
    const { action } = req.body || {};
    if (!['verify', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be verify or reject' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment.status !== 'submitted') return res.status(409).json({ error: 'No UTR is waiting for review on this order' });

    if (action === 'verify') {
      order.payment.status = 'verified';
      order.payment.verifiedAt = new Date();
      if (order.status === 'placed') order.status = 'preparing';
    } else {
      // Free the UTR so the customer can enter the correct one.
      order.payment.status = 'rejected';
      order.payment.utr = undefined;
    }
    await order.save();
    res.json(order);
  })
);

router.patch(
  '/orders/:id/status',
  wrap(async (req, res) => {
    const { status } = req.body || {};
    if (!['placed', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (['preparing', 'ready', 'completed'].includes(status) && order.payment.status !== 'verified')
      return res.status(409).json({ error: 'Verify the payment before preparing this order' });
    order.status = status;
    await order.save();
    res.json(order);
  })
);

// ---------- Menu ----------
function pickMenuFields(body) {
  const b = body || {};
  const out = {
    name: String(b.name || '').trim(),
    description: String(b.description || '').trim(),
    category: String(b.category || 'Prepared Foods').trim(),
    price: Number(b.price),
    isVeg: Boolean(b.isVeg),
    spice: Math.min(3, Math.max(0, Math.floor(Number(b.spice) || 0))),
    available: b.available !== false,
    image: String(b.image || '').trim(),
    tags: (Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(','))
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean),
  };
  if (!out.name) return { error: 'Name is required' };
  if (!Number.isFinite(out.price) || out.price < 0) return { error: 'Enter a valid price' };
  if (!out.isVeg && !out.tags.includes('egg') && /egg|omelette|bhurji/i.test(out.name)) out.tags.push('egg');
  return { data: out };
}

router.get('/menu', wrap(async (_req, res) => res.json(await MenuItem.find().sort({ category: 1, name: 1 }))));

router.post(
  '/menu',
  wrap(async (req, res) => {
    const { data, error } = pickMenuFields(req.body);
    if (error) return res.status(400).json({ error });
    const item = await MenuItem.create(data);
    reindexSoon();
    res.status(201).json(item);
  })
);

router.put(
  '/menu/:id',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Item not found' });
    const { data, error } = pickMenuFields(req.body);
    if (error) return res.status(400).json({ error });
    const item = await MenuItem.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    reindexSoon();
    res.json(item);
  })
);

router.delete(
  '/menu/:id',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Item not found' });
    await MenuItem.findByIdAndDelete(req.params.id);
    reindexSoon();
    res.json({ ok: true });
  })
);

export default router;
