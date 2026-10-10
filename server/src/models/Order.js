import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    items: [
      {
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        name: String,
        price: Number,
        qty: Number,
      },
    ],
    total: { type: Number, required: true },
    orderType: { type: String, enum: ['dine-in', 'takeaway'], required: true },
    tableNumber: { type: String, default: '' },
    customerName: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, required: true },
    notes: { type: String, default: '', maxlength: 200 },
    status: {
      type: String,
      enum: ['placed', 'preparing', 'ready', 'completed', 'cancelled'],
      default: 'placed',
    },
    payment: {
      method: { type: String, default: 'UPI' },
      // pending -> customer has not submitted a UTR yet
      // submitted -> UTR entered, waiting for admin to check the bank/UPI app
      // verified / rejected -> admin decision
      status: { type: String, enum: ['pending', 'submitted', 'verified', 'rejected'], default: 'pending' },
      utr: { type: String },
      submittedAt: Date,
      verifiedAt: Date,
    },
  },
  { timestamps: true }
);

// A UTR can only ever be attached to one order (stops the same payment being reused).
orderSchema.index(
  { 'payment.utr': 1 },
  { unique: true, partialFilterExpression: { 'payment.utr': { $type: 'string' } } }
);

export default mongoose.model('Order', orderSchema);
