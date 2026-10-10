import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    category: { type: String, default: 'Prepared Foods', trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
    isVeg: { type: Boolean, default: true },
    // 0 = not spicy, 1 = mild, 2 = medium, 3 = hot
    spice: { type: Number, default: 0, min: 0, max: 3 },
    tags: { type: [String], default: [] },
    image: { type: String, default: '' },
    available: { type: Boolean, default: true },
    // RAG fields (kept out of normal queries)
    embedding: { type: [Number], select: false },
    embedHash: { type: String, select: false },
  },
  { timestamps: true }
);

export default mongoose.model('MenuItem', menuItemSchema);
