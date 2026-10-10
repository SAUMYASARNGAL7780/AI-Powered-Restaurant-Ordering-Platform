import { Router } from 'express';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Order from '../models/Order.js';
import { wrap } from '../middleware/auth.js';

const router = Router();

export const BUSINESS = {
  name: 'Signature Bites',
  tagline: 'Where Taste Meets Elegance',
  owner: 'Saumya Sarngal',
  address: 'Village Makhyal PO Paryal, Tehsil Marh, Mukhyal, Sohanjana, Jammu, J&K - 181206',
  fssai: '21026134000596',
  phone: process.env.BUSINESS_PHONE || '',
};

export function upiLink(order) {
  const p = new URLSearchParams({
    pa: process.env.UPI_ID || '',
    pn: process.env.UPI_PAYEE_NAME || BUSINESS.name,
    am: order.total.toFixed(2),
    cu: 'INR',
    tn: `Order ${order.orderNo}`,
  });
  return `upi://pay?${p.toString()}`;
}

const publicOrder = (o) => ({
  id: String(o._id),
  orderNo: o.orderNo,
  items: o.items.map(({ name, price, qty }) => ({ name, price, qty })),
  total: o.total,
  orderType: o.orderType,
  tableNumber: o.tableNumber,
  customerName: o.customerName,
  status: o.status,
  paymentStatus: o.payment.status,
  upiLink: o.payment.status === 'pending' || o.payment.status === 'rejected' ? upiLink(o) : undefined,
  createdAt: o.createdAt,
});

router.get('/config', (_req, res) => res.json({ ...BUSINESS, upiConfigured: Boolean(process.env.UPI_ID) }));

router.get(
  '/menu',
  wrap(async (_req, res) => {
    const items = await MenuItem.find({ available: true }).sort({ category: 1, name: 1 });
    res.json(items);
  })
);

router.post(
  '/orders',
  wrap(async (req, res) => {
    const { items, orderType, tableNumber = '', customerName, phone, notes = '' } = req.body || {};

    if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ error: 'Your cart is empty' });
    if (!['dine-in', 'takeaway'].includes(orderType)) return res.status(400).json({ error: 'Choose dine-in or takeaway' });
    if (orderType === 'dine-in' && !String(tableNumber).trim()) return res.status(400).json({ error: 'Please enter your table number' });
    if (!String(customerName || '').trim()) return res.status(400).json({ error: 'Please enter your name' });
    if (!/^\d{10}$/.test(String(phone || ''))) return res.status(400).json({ error: 'Enter a valid 10-digit phone number' });

    // Never trust prices from the browser: look everything up in the database.
    const ids = items.map((i) => i.menuItemId).filter((id) => mongoose.isValidObjectId(id));
    const dbItems = await MenuItem.find({ _id: { $in: ids }, available: true });
    const byId = new Map(dbItems.map((d) => [String(d._id), d]));

    const lines = [];
    for (const i of items) {
      const d = byId.get(String(i.menuItemId));
      const qty = Math.floor(Number(i.qty));
      if (!d || !(qty >= 1 && qty <= 20)) return res.status(400).json({ error: 'Some items are no longer available. Please refresh the menu.' });
      lines.push({ menuItem: d._id, name: d.name, price: d.price, qty });
    }
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

    const order = await Order.create({
      orderNo: 'SB' + Math.random().toString(36).slice(2, 7).toUpperCase(),
      items: lines,
      total,
      orderType,
      tableNumber: orderType === 'dine-in' ? String(tableNumber).trim().slice(0, 10) : '',
      customerName: String(customerName).trim().slice(0, 60),
      phone: String(phone),
      notes: String(notes).slice(0, 200),
    });
    res.status(201).json(publicOrder(order));
  })
);

router.get(
  '/orders/:id',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(publicOrder(order));
  })
);

// Customer submits the UTR (12-digit UPI reference number) after paying.
router.post(
  '/orders/:id/utr',
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const utr = String(req.body?.utr || '').trim();
    if (!/^\d{12}$/.test(utr)) return res.status(400).json({ error: 'UTR must be exactly 12 digits (see your UPI app payment details)' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (['submitted', 'verified'].includes(order.payment.status)) return res.status(409).json({ error: 'Payment already submitted for this order' });
    if (order.status === 'cancelled') return res.status(409).json({ error: 'This order was cancelled' });

    order.payment.utr = utr;
    order.payment.status = 'submitted';
    order.payment.submittedAt = new Date();
    try {
      await order.save();
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'This UTR has already been used for another order' });
      throw e;
    }
    res.json(publicOrder(order));
  })
);

export default router;
