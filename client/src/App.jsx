import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCart } from './cart.jsx';
import { api } from './api.js';
import Menu from './pages/Menu.jsx';
import Cart from './pages/Cart.jsx';
import Order from './pages/Order.jsx';
import Admin from './pages/Admin.jsx';
import Chatbot from './components/Chatbot.jsx';

export default function App() {
  const { count } = useCart();
  const [biz, setBiz] = useState(null);
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  useEffect(() => {
    api('/config').then(setBiz).catch(() => {});
  }, []);

  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          <img src="/logo.jpg" alt="Signature Bites logo" />
        </Link>
        {!isAdmin && (
          <Link to="/cart" className="cart-link">
            Cart {count > 0 && <span className="badge">{count}</span>}
          </Link>
        )}
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order/:id" element={<Order />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Back to menu</Link></p>} />
        </Routes>
      </main>

      {!isAdmin && <Chatbot />}

      <footer className="footer">
        <p className="tagline">{biz?.tagline || 'Where Taste Meets Elegance'}</p>
        <p>{biz?.address}</p>
        {biz?.phone && <p>Call us: <a href={`tel:+91${biz.phone}`}>{biz.phone}</a></p>}
        {biz?.fssai && <p>FSSAI Lic. No. <strong>{biz.fssai}</strong></p>}
        <p><Link to="/admin">Staff login</Link></p>
      </footer>
    </>
  );
}
