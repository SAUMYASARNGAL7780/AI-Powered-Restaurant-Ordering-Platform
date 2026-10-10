import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, rupees } from '../api.js';

export default function Admin() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener('sb-logout', out);
    return () => window.removeEventListener('sb-logout', out);
  }, []);

  return authed ? <Dashboard onLogout={() => { setToken(null); setAuthed(false); }} /> : <Login onDone={() => setAuthed(true)} />;
}

function Login({ onDone }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token } = await api('/admin/login', { method: 'POST', body: f });
      setToken(token);
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>Staff login</h2>
      <label>Username<input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required /></label>
      <label>Password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" required /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn block">Log in</button>
    </form>
  );
}

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState('orders');
  return (
    <>
      <div className="admin-bar">
        <div className="seg">
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
          <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>Menu</button>
        </div>
        <button className="btn outline small" onClick={onLogout}>Log out</button>
      </div>
      {tab === 'orders' ? <Orders /> : <MenuManager />}
    </>
  );
}

/* ---------------- Orders ---------------- */
const NEXT = { preparing: 'ready', ready: 'completed' };

function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState('');

  const load = useCallback(() => api('/admin/orders', { admin: true }).then(setOrders).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function act(path, body) {
    setError('');
    try {
      await api(path, { method: 'PATCH', body, admin: true });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const shown = orders.filter((o) =>
    filter === 'review' ? o.payment.status === 'submitted' : filter === 'active' ? !['completed', 'cancelled'].includes(o.status) : true
  );
  const toReview = orders.filter((o) => o.payment.status === 'submitted').length;

  return (
    <>
      <div className="filters">
        {[['active', 'Active'], ['review', `Payments to verify (${toReview})`], ['all', 'All']].map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!shown.length && <p>No orders here.</p>}

      <div className="grid">
        {shown.map((o) => (
          <article key={o._id} className="card">
            <div className="card-top">
              <h3>{o.orderNo}</h3>
              <span className={`tag ${o.status}`}>{o.status}</span>
            </div>
            <p className="muted">
              {o.orderType === 'dine-in' ? `Table ${o.tableNumber}` : 'Takeaway'} · {o.customerName} ·{' '}
              <a href={`tel:${o.phone}`}>{o.phone}</a>
            </p>
            <ul className="lines">
              {o.items.map((i, n) => <li key={n}>{i.qty} × {i.name}</li>)}
            </ul>
            {o.notes && <p className="muted">Note: {o.notes}</p>}
            <p><strong>{rupees(o.total)}</strong> · Payment: <span className={`tag ${o.payment.status}`}>{o.payment.status}</span></p>

            {o.payment.status === 'submitted' && (
              <div className="utr-box">
                <div>UTR: <code>{o.payment.utr}</code></div>
                <p className="muted">Check this UTR and the amount {rupees(o.total)} in your UPI app / bank statement first.</p>
                <div className="btns">
                  <button className="btn small" onClick={() => act(`/admin/orders/${o._id}/payment`, { action: 'verify' })}>Payment received</button>
                  <button className="btn small outline" onClick={() => act(`/admin/orders/${o._id}/payment`, { action: 'reject' })}>Not found</button>
                </div>
              </div>
            )}

            {o.payment.status === 'verified' && NEXT[o.status] && (
              <button className="btn small" onClick={() => act(`/admin/orders/${o._id}/status`, { status: NEXT[o.status] })}>
                Mark {NEXT[o.status]}
              </button>
            )}
            {!['completed', 'cancelled'].includes(o.status) && (
              <button className="link-danger" onClick={() => confirm('Cancel this order?') && act(`/admin/orders/${o._id}/status`, { status: 'cancelled' })}>
                Cancel order
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

/* ---------------- Menu manager ---------------- */
const EMPTY = { name: '', description: '', category: 'Prepared Foods', price: '', isVeg: true, spice: 0, tags: '', available: true };

function MenuManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/admin/menu', { admin: true }).then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const body = { ...form, price: Number(form.price), spice: Number(form.spice) };
      await api(editing ? `/admin/menu/${editing}` : '/admin/menu', { method: editing ? 'PUT' : 'POST', body, admin: true });
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function edit(i) {
    setEditing(i._id);
    setForm({ ...i, tags: (i.tags || []).join(', ') });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggle(i) {
    await api(`/admin/menu/${i._id}`, { method: 'PUT', body: { ...i, available: !i.available }, admin: true }).catch((e) => setError(e.message));
    load();
  }

  async function remove(i) {
    if (!confirm(`Delete ${i.name}?`)) return;
    await api(`/admin/menu/${i._id}`, { method: 'DELETE', admin: true }).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="two-col">
      <form className="panel" onSubmit={save}>
        <h2>{editing ? 'Edit item' : 'Add item'}</h2>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} /></label>
        <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} rows={3} /></label>
        <div className="inline">
          <label>Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></label>
          <label>Price (₹)<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
        </div>
        <div className="inline">
          <label>Spice
            <select value={form.spice} onChange={(e) => setForm({ ...form, spice: e.target.value })}>
              <option value={0}>Not spicy</option><option value={1}>Mild</option><option value={2}>Medium</option><option value={3}>Hot</option>
            </select>
          </label>
          <label>Type
            <select value={form.isVeg ? 'veg' : 'nonveg'} onChange={(e) => setForm({ ...form, isVeg: e.target.value === 'veg' })}>
              <option value="veg">Veg</option><option value="nonveg">Non-veg (eggs)</option>
            </select>
          </label>
        </div>
        <label>Tags (comma separated, helps the chatbot)<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="paneer, snack, grilled" /></label>
        <label className="check"><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Available</label>
        {error && <p className="error">{error}</p>}
        <div className="btns">
          <button className="btn">{editing ? 'Save changes' : 'Add item'}</button>
          {editing && <button type="button" className="btn outline" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      <section className="panel">
        <h2>Menu ({items.length})</h2>
        {items.map((i) => (
          <div key={i._id} className={`row ${i.available ? '' : 'off'}`}>
            <span className={`dot ${i.isVeg ? 'veg' : 'nonveg'}`} />
            <span className="grow">{i.name}<small className="muted"> · {i.category}</small></span>
            <span className="amt">{rupees(i.price)}</span>
            <button className="link" onClick={() => toggle(i)}>{i.available ? 'Hide' : 'Show'}</button>
            <button className="link" onClick={() => edit(i)}>Edit</button>
            <button className="link-danger" onClick={() => remove(i)}>Delete</button>
          </div>
        ))}
      </section>
    </div>
  );
}
