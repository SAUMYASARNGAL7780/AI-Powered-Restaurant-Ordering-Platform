# Signature Bites – AI-Powered Restaurant Ordering Platform

MERN ordering platform for **Signature Bites** (FSSAI Reg. No. 21026134000596): menu management, cart, dine-in / takeaway orders, UPI QR checkout with UTR-based payment verification, a JWT-secured admin dashboard, and a hybrid RAG chatbot (BM25 + Gemini embeddings) that answers dietary, spice and budget questions from the live menu.

**Stack:** React (Vite) · Node.js · Express · MongoDB (Mongoose) · Gemini API

## Quick start

Requires Node 18+ and a MongoDB database (local, or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd server
npm install
cp .env.example .env      # then edit .env (see below)
npm run dev               # http://localhost:5000  (seeds a sample menu on first run)

# 2. Frontend (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

### `.env` values you must set
| Variable | What it is |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string |
| `JWT_SECRET` | Long random string (signs admin tokens) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin dashboard login (`/admin`) |
| `UPI_ID` | Your UPI ID (VPA) that receives payments |
| `GEMINI_API_KEY` | From https://aistudio.google.com/apikey (optional, without it the chatbot uses keyword search only) |

## How it works

**Ordering:** customer adds items → cart (dine-in needs table number, or takeaway) → order is created. Prices are always re-read from the database on the server.

**UPI + UTR payment:** the order page shows a UPI QR (amount and order number pre-filled). After paying, the customer enters the 12-digit UTR. In **Admin → Orders → Payments to verify** you compare the UTR and amount with your UPI app / bank statement, then press *Payment received* (order moves to *preparing*) or *Not found* (customer can re-enter). A UTR can only be used on one order, and food can't be marked preparing until payment is verified.

**Admin dashboard (`/admin`):** login returns a 12-hour JWT. Orders tab auto-refreshes every 8 s. Menu tab lets you add / edit / hide / delete items.

**Hybrid RAG chatbot** (`server/src/rag/`):
1. Each menu item is turned into a text document (name, description, veg/non-veg, spice, tags, price) and embedded with Gemini; vectors are stored in MongoDB and only recomputed when an item changes.
2. For a question, preferences are parsed (veg / non-veg, eggless, mild or spicy, budget like "under ₹150") and used as hard filters.
3. Remaining items are scored with **BM25** (keywords) and **cosine similarity** of Gemini embeddings, normalised and combined 40% / 60%.
4. The top 5 items are given to Gemini as the only allowed context, so it can't invent dishes or prices. If Gemini is unavailable, a simple template reply is used instead.

## Project layout
```
server/src/
  index.js            Express app, rate limits, serves client build in production
  models/             MenuItem, Order
  routes/             public.js (menu, orders, UTR), admin.js (JWT), chat.js
  rag/                bm25.js, gemini.js, retriever.js
  seed.js             Sample menu (npm run seed resets it)
client/src/
  pages/              Menu, Cart, Order (QR + UTR), Admin
  components/         Chatbot
```

## Deploying
Build the client (`cd client && npm run build`) and run only the server (`cd server && npm start`): it serves `client/dist` too, so one service on Render / Railway / a VPS is enough. Set the same env variables there and use MongoDB Atlas. Serve over HTTPS.

## Before going live
- **Edit the sample menu and prices** in the admin Menu tab (they are placeholders).
- Use a strong `ADMIN_PASSWORD` and `JWT_SECRET`; never commit `.env`.
- Your FSSAI registration covers *Prepared Foods, Eggs and egg products, and Beverages (non-dairy)*. The sample menu stays within these; check with your food safety officer before adding other categories (e.g. meat).
- Your registration permits turnover up to ₹1.5 crore per year.
- UTR checking is manual by design (no payment gateway); always match the amount too.

## Ideas for later
Email/WhatsApp order alerts, sound alert on new orders in admin, item images, a print-friendly kitchen ticket.
