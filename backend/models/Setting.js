const mongoose = require('mongoose');

// Single-document collection with library policy settings
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'library', unique: true },
    libraryName: { type: String, default: 'SmartLib Central Library' },
    finePerDay: { type: Number, default: 10, min: 0 },
    loanDays: { type: Number, default: 14, min: 1 },
    maxRenewals: { type: Number, default: 2, min: 0 },
    maxBooksPerMember: { type: Number, default: 5, min: 1 },
    maxPendingFine: { type: Number, default: 500, min: 0 }, // members above this cannot borrow
    reservationHoldDays: { type: Number, default: 3, min: 1 },
    reservationValidityDays: { type: Number, default: 30, min: 1 },
    lostProcessingFee: { type: Number, default: 50, min: 0 },
    damageChargePercent: { type: Number, default: 30, min: 0, max: 100 },
    membershipFee: { type: Number, default: 500, min: 0 },
    dueSoonDays: { type: Number, default: 2, min: 1 },
  },
  { timestamps: true }
);

settingSchema.statics.get = async function getSettings() {
  let s = await this.findOne({ key: 'library' });
  if (!s) s = await this.create({ key: 'library' });
  return s;
};

module.exports = mongoose.model('Setting', settingSchema);
