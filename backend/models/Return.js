const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema(
  {
    returnId: { type: String, unique: true, index: true },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true, unique: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    transactionId: String,
    issueDate: Date,
    dueDate: Date,
    returnDate: { type: Date, default: Date.now },
    daysOverdue: { type: Number, default: 0 },
    condition: { type: String, enum: ['Good', 'Damaged', 'Lost'], default: 'Good' },
    lateFine: { type: Number, default: 0 },
    damageCharge: { type: Number, default: 0 },
    lostCharge: { type: Number, default: 0 },
    totalFine: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

returnSchema.index({ returnDate: -1 });

module.exports = mongoose.model('Return', returnSchema);
