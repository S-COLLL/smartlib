const mongoose = require('mongoose');

const RESERVATION_STATUSES = ['Waiting', 'Available', 'Collected', 'Cancelled', 'Expired'];

const reservationSchema = new mongoose.Schema(
  {
    reservationId: { type: String, unique: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    reservationDate: { type: Date, default: Date.now },
    queuePosition: { type: Number, default: 0 },
    availableSince: Date,
    expiryDate: Date,
    status: { type: String, enum: RESERVATION_STATUSES, default: 'Waiting' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

reservationSchema.index({ book: 1, status: 1, reservationDate: 1 });
reservationSchema.index({ member: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
module.exports.RESERVATION_STATUSES = RESERVATION_STATUSES;
