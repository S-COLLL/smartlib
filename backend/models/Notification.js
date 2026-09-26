const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'issued',
  'due-soon',
  'overdue',
  'fine',
  'payment',
  'reservation',
  'membership',
  'new-book',
  'returned',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    // audience: "staff" = admin/librarian/staff; "member" = a specific member; "all" = everyone
    audience: { type: String, enum: ['staff', 'member', 'all'], default: 'staff' },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ member: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
