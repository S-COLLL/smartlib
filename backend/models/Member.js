const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, unique: true, index: true },
    name: { type: String, required: [true, 'Member name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is invalid'],
    },
    phone: { type: String, trim: true, match: [/^[+\d][\d\s-]{7,15}$/, 'Phone number is invalid'] },
    profilePhoto: { type: String, default: '' },
    department: { type: String, default: '', trim: true },
    course: { type: String, default: '', trim: true },
    year: { type: String, default: '', trim: true },
    membershipType: { type: String, enum: ['Student', 'Faculty', 'Staff', 'Premium', 'Guest'], default: 'Student' },
    membershipStart: { type: Date, default: Date.now },
    membershipExpiry: { type: Date, required: [true, 'Membership expiry date is required'] },
    booksIssued: { type: Number, default: 0 }, // currently issued
    booksReturned: { type: Number, default: 0 },
    pendingFine: { type: Number, default: 0 },
    totalFinePaid: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Expired', 'Suspended'], default: 'Active' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiryNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

memberSchema.index({ name: 1 });
memberSchema.index({ status: 1 });

module.exports = mongoose.model('Member', memberSchema);
