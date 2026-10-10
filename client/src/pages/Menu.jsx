import { useEffect, useMemo, useState } from 'react';
import { api, rupees } from '../api.js';
import { useCart } from '../cart.jsx';

const SPICE = ['', '🌶️', '🌶️🌶️', '🌶️🌶️🌶️'];

export default function Menu() {
  const { add, items: cartItems } = useCart();
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/menu')
      .then(setMenu)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['All', ...new Set(menu.map((m) => m.category))], [menu]);
  const shown = menu.filter((m) => (category === 'All' || m.category === category) && (!vegOnly || m.isVeg));
  const qtyInCart = (id) => cartItems.find((i) => i.id === id)?.qty || 0;

  return (
    <>
      <section className="hero">
        <img src="/poster.jpg" alt="Signature Bites" />
        <div>
          <h1>Fresh, hot and made to order</h1>
          <p>Choose dine-in or takeaway, pay with UPI and we'll start cooking as soon as your payment is confirmed.</p>
        </div>
      </section>

      <div className="filters">
        {categories.map((c) => (
          <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
        <label className="veg-toggle">
          <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} /> Veg only
        </label>
      </div>

      {loading && <p>Loading menu…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && !shown.length && <p>No items to show.</p>}

      <div className="grid">
        {shown.map((m) => (
          <article key={m._id} className="card">
            <div className="card-top">
              <span className={`dot ${m.isVeg ? 'veg' : 'nonveg'}`} title={m.isVeg ? 'Vegetarian' : 'Non-vegetarian'} />
              <h3>{m.name}</h3>
            </div>
            <p className="desc">{m.description}</p>
            <div className="card-bottom">
              <div>
                <strong>{rupees(m.price)}</strong> <span className="spice">{SPICE[m.spice]}</span>
              </div>
              <button className="btn small" onClick={() => add({ id: m._id, name: m.name, price: m.price })}>
                Add{qtyInCart(m._id) ? ` (${qtyInCart(m._id)})` : ''}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
