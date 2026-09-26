const mongoose = require('mongoose');

const ISSUE_STATUSES = ['Issued', 'Returned', 'Overdue', 'Lost', 'Damaged'];

const issueSchema = new mongoose.Schema(
  {
    transactionId: { type: String, unique: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    // Snapshots so history stays readable even if the book/member is edited later
    memberCode: String,
    memberName: String,
    bookCode: String,
    bookTitle: String,
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: Date,
    renewalCount: { type: Number, default: 0 },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffName: String,
    status: { type: String, enum: ISSUE_STATUSES, default: 'Issued' },
    fineAmount: { type: Number, default: 0 },
    dueSoonNotified: { type: Boolean, default: false },
    overdueNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

issueSchema.index({ member: 1, status: 1 });
issueSchema.index({ book: 1, status: 1 });
issueSchema.index({ status: 1, dueDate: 1 });
issueSchema.index({ issueDate: -1 });

module.exports = mongoose.model('Issue', issueSchema);
module.exports.ISSUE_STATUSES = ISSUE_STATUSES;
