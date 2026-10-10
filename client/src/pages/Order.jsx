import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, rupees } from '../api.js';

const STEPS = ['placed', 'preparing', 'ready', 'completed'];
const STEP_LABEL = { placed: 'Order placed', preparing: 'Preparing', ready: 'Ready', completed: 'Completed' };

export default function Order() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // poll so the customer sees status changes
    return () => clearInterval(t);
  }, [load]);

  async function submitUtr(e) {
    e.preventDefault();
    setUtrError('');
    setBusy(true);
    try {
      setOrder(await api(`/orders/${id}/utr`, { method: 'POST', body: { utr } }));
    } catch (err) {
      setUtrError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error} <Link to="/">Back to menu</Link></p>;
  if (!order) return <p>Loading…</p>;

  const needsPayment = ['pending', 'rejected'].includes(order.paymentStatus) && order.status !== 'cancelled';

  return (
    <div className="two-col">
      <section className="panel">
        <h2>Order {order.orderNo}</h2>
        <p className="muted">
          {order.orderType === 'dine-in' ? `Dine-in, table ${order.tableNumber}` : 'Takeaway'} · {order.customerName}
        </p>
        {order.items.map((i, n) => (
          <div key={n} className="row">
            <span className="grow">{i.qty} × {i.name}</span>
            <span className="amt">{rupees(i.qty * i.price)}</span>
          </div>
        ))}
        <div className="row total">
          <span className="grow">Total</span>
          <strong className="amt">{rupees(order.total)}</strong>
        </div>

        {order.status === 'cancelled' ? (
          <p className="error">This order was cancelled.</p>
        ) : order.paymentStatus === 'verified' ? (
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s} className={STEPS.indexOf(s) <= STEPS.indexOf(order.status) ? 'done' : ''}>{STEP_LABEL[s]}</li>
            ))}
          </ol>
        ) : null}
        {order.status === 'ready' && <p className="success">Your order is ready!</p>}
      </section>

      <section className="panel">
        {needsPayment && (
          <>
            <h2>Pay {rupees(order.total)} with UPI</h2>
            {order.paymentStatus === 'rejected' && (
              <p className="error">We couldn't match that UTR to a payment. Please check it and enter again.</p>
            )}
            <div className="qr">
              <QRCodeSVG value={order.upiLink} size={200} includeMargin />
            </div>
            <p className="muted center">Scan with any UPI app (GPay, PhonePe, Paytm…). On a phone you can also</p>
            <a className="btn block outline" href={order.upiLink}>Open UPI app</a>

            <form onSubmit={submitUtr}>
              <label>After paying, enter the 12-digit UTR / reference number
                <input value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={12} placeholder="e.g. 412345678901" required />
              </label>
              {utrError && <p className="error">{utrError}</p>}
              <button className="btn block" disabled={busy || utr.length !== 12}>{busy ? 'Submitting…' : 'Submit payment'}</button>
            </form>
          </>
        )}

        {order.paymentStatus === 'submitted' && (
          <>
            <h2>Waiting for confirmation</h2>
            <p>We've received your UTR. Our team is checking the payment, this page will update automatically.</p>
          </>
        )}

        {order.paymentStatus === 'verified' && (
          <>
            <h2>Payment confirmed ✓</h2>
            <p>Thank you, {order.customerName}! Keep this page open to follow your order.</p>
            <Link className="btn" to="/">Order more</Link>
          </>
        )}
      </section>
    </div>
  );
}
