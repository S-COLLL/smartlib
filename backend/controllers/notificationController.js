const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { ApiError, asyncHandler, paginate, pick } = require('../utils/helpers');
const { isStaff } = require('../middleware/auth');
const { notify } = require('../utils/library');

// Notifications visible to the current user
function audienceFilter(user) {
  const or = [{ audience: 'all' }];
  if (isStaff(user)) or.push({ audience: 'staff' });
  if (user.member) or.push({ audience: 'member', member: user.member });
  return { $or: or };
}

// GET /api/notifications
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 20, 100);
  const filter = audienceFilter(req.user);
  if (req.query.type) filter.type = req.query.type;
  if (req.query.unread === 'true') filter.readBy = { $ne: req.user._id };
  const [docs, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...audienceFilter(req.user), readBy: { $ne: req.user._id } }),
  ]);
  const me = String(req.user._id);
  const data = docs.map(({ readBy, ...n }) => ({ ...n, read: (readBy || []).some((id) => String(id) === me) }));
  res.json({ success: true, data, unread, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// GET /api/notifications/unread-count
exports.unreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ ...audienceFilter(req.user), readBy: { $ne: req.user._id } });
  res.json({ success: true, unread });
});

// PATCH /api/notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid notification id');
  const r = await Notification.updateOne({ _id: req.params.id, ...audienceFilter(req.user) }, { $addToSet: { readBy: req.user._id } });
  if (!r.matchedCount) throw new ApiError(404, 'Notification not found');
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany(audienceFilter(req.user), { $addToSet: { readBy: req.user._id } });
  res.json({ success: true, updated: r.modifiedCount });
});

// POST /api/notifications — staff broadcast
exports.create = asyncHandler(async (req, res) => {
  const n = await notify({ ...pick(req.body, ['audience', 'member', 'title', 'message', 'link']), type: 'system' });
  if (!n) throw new ApiError(400, 'Could not create notification — check the fields');
  res.status(201).json({ success: true, data: n });
});

// DELETE /api/notifications/:id (staff)
exports.remove = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid notification id');
  await Notification.deleteOne({ _id: req.params.id });
  res.json({ success: true, message: 'Notification deleted' });
});

/* ============================== SETTINGS ============================ */

const SETTING_FIELDS = [
  'libraryName', 'finePerDay', 'loanDays', 'maxRenewals', 'maxBooksPerMember', 'maxPendingFine',
  'reservationHoldDays', 'reservationValidityDays', 'lostProcessingFee', 'damageChargePercent', 'membershipFee', 'dueSoonDays',
];

exports.getSettings = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await Setting.get() });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const s = await Setting.get();
  Object.assign(s, pick(req.body, SETTING_FIELDS));
  await s.save();
  res.json({ success: true, data: s, message: 'Settings saved' });
});
