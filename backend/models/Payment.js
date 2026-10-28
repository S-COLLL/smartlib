const mongoose = require('mongoose');

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partially Paid', 'Waived'];

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true, index: true },
    receiptNo: { type: String, unique: true, sparse: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    fine: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine' },
    transactionId: String, // library issue transaction the payment relates to
    reason: { type: String, required: [true, 'Payment reason is required'], trim: true },
    amount: { type: Number, required: true, min: [0, 'Amount cannot be negative'] },
    date: { type: Date, default: Date.now },
    method: { type: String, enum: PAYMENT_METHODS, default: 'Cash' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'Paid' },
    reference: { type: String, default: '' }, // mock gateway reference (UPI ref / card auth code)
    notes: { type: String, default: '' },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    collectedByName: String,
  },
  { timestamps: true }
);

paymentSchema.index({ member: 1, date: -1 });
paymentSchema.index({ date: -1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
