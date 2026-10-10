import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { api, rupees } from '../api.js';

export default function Cart() {
  const { items, total, setQty, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ orderType: 'dine-in', tableNumber: '', customerName: '', phone: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!items.length)
    return (
      <div className="panel center">
        <h2>Your cart is empty</h2>
        <Link className="btn" to="/">Browse the menu</Link>
      </div>
    );

  async function placeOrder(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: { ...form, items: items.map((i) => ({ menuItemId: i.id, qty: i.qty })) },
      });
      clear();
      navigate(`/order/${order.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <section className="panel">
        <h2>Your order</h2>
        {items.map((i) => (
          <div key={i.id} className="row">
            <span className="grow">{i.name}</span>
            <div className="qty">
              <button onClick={() => setQty(i.id, i.qty - 1)} aria-label="Decrease">−</button>
              <span>{i.qty}</span>
              <button onClick={() => setQty(i.id, i.qty + 1)} aria-label="Increase">+</button>
            </div>
            <strong className="amt">{rupees(i.price * i.qty)}</strong>
          </div>
        ))}
        <div className="row total">
          <span className="grow">Total</span>
          <strong className="amt">{rupees(total)}</strong>
        </div>
      </section>

      <form className="panel" onSubmit={placeOrder}>
        <h2>Your details</h2>
        <div className="seg">
          {['dine-in', 'takeaway'].map((t) => (
            <button type="button" key={t} className={form.orderType === t ? 'active' : ''} onClick={() => setForm({ ...form, orderType: t })}>
              {t === 'dine-in' ? 'Dine-in' : 'Takeaway'}
            </button>
          ))}
        </div>

        {form.orderType === 'dine-in' && (
          <label>Table number
            <input value={form.tableNumber} onChange={set('tableNumber')} maxLength={10} required />
          </label>
        )}
        <label>Name
          <input value={form.customerName} onChange={set('customerName')} maxLength={60} required />
        </label>
        <label>Phone (10 digits)
          <input value={form.phone} onChange={set('phone')} inputMode="numeric" pattern="\d{10}" maxLength={10} required />
        </label>
        <label>Notes (optional)
          <input value={form.notes} onChange={set('notes')} maxLength={200} placeholder="Less spicy, no onion…" />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Placing order…' : `Place order & pay ${rupees(total)}`}</button>
        <p className="muted">You'll pay by UPI on the next screen.</p>
      </form>
    </div>
  );
}
