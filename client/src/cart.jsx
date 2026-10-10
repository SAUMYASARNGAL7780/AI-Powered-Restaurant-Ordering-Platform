import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sb_cart')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sb_cart', JSON.stringify(items));
    } catch {}
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      total: items.reduce((s, i) => s + i.qty * i.price, 0),
      add: (item) =>
        setItems((cur) => {
          const found = cur.find((i) => i.id === item.id);
          if (found) return cur.map((i) => (i.id === item.id ? { ...i, qty: Math.min(20, i.qty + 1) } : i));
          return [...cur, { id: item.id, name: item.name, price: item.price, qty: 1 }];
        }),
      setQty: (id, qty) =>
        setItems((cur) => (qty <= 0 ? cur.filter((i) => i.id !== id) : cur.map((i) => (i.id === id ? { ...i, qty: Math.min(20, qty) } : i)))),
      clear: () => setItems([]),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
