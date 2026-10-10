import { useEffect, useRef, useState } from 'react';
import { api, rupees } from '../api.js';
import { useCart } from '../cart.jsx';

const SUGGESTIONS = ['Veg options under ₹100', 'Something mild for kids', 'Spicy snacks', 'What drinks do you have?'];

export default function Chatbot() {
  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Ask me about veg options, spice level or your budget and I will suggest dishes from our menu.' },
  ]);
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.slice(1).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api('/chat', { method: 'POST', body: { message, history } });
      setMessages((m) => [...m, { role: 'assistant', text: res.reply, items: res.items }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: e.message || 'Sorry, something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen(!open)} aria-label="Open menu assistant">
        {open ? '✕' : '💬 Ask'}
      </button>
      {open && (
        <div className="chat">
          <div className="chat-head">Menu assistant</div>
          <div className="chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <p>{m.text}</p>
                {m.items?.length > 0 && (
                  <div className="msg-items">
                    {m.items.slice(0, 3).map((it) => (
                      <button key={it.id} className="chip small" onClick={() => add(it)}>
                        + {it.name} {rupees(it.price)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="msg-items">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip small" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
            {busy && <div className="msg assistant"><p>Thinking…</p></div>}
            <div ref={bottom} />
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. spicy veg under 150" maxLength={300} />
            <button className="btn small" disabled={busy}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
