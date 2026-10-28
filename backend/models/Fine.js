const mongoose = require('mongoose');

const FINE_TYPES = ['Late Fine', 'Lost Book', 'Damage', 'Replacement', 'Membership Fee', 'Other'];
const FINE_STATUSES = ['Pending', 'Partially Paid', 'Paid', 'Waived'];

const fineSchema = new mongoose.Schema(
  {
    fineId: { type: String, unique: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue' },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    transactionId: String,
    type: { type: String, enum: FINE_TYPES, required: true },
    description: { type: String, default: '' },
    daysOverdue: { type: Number, default: 0 },
    ratePerDay: { type: Number, default: 0 },
    originalAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    waivedAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: FINE_STATUSES, default: 'Pending' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

fineSchema.virtual('remainingAmount').get(function remaining() {
  return Math.max(0, this.originalAmount - this.discount - this.paidAmount - this.waivedAmount);
});

// Keep status consistent with amounts
fineSchema.methods.refreshStatus = function refreshStatus() {
  const payable = this.originalAmount - this.discount;
  if (this.paidAmount + this.waivedAmount >= payable) this.status = this.waivedAmount > 0 ? 'Waived' : 'Paid';
  else if (this.paidAmount > 0) this.status = 'Partially Paid';
  else this.status = 'Pending';
};

fineSchema.index({ member: 1, status: 1 });
fineSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Fine', fineSchema);
module.exports.FINE_TYPES = FINE_TYPES;
module.exports.FINE_STATUSES = FINE_STATUSES;
