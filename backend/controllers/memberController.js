const Member = require('../models/Member');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const Reservation = require('../models/Reservation');
const Setting = require('../models/Setting');
const { ApiError, asyncHandler, nextId, escapeRegex, paginate, pick, addDays } = require('../utils/helpers');
const { findMember } = require('../utils/lookup');
const { syncMember, notify, ACTIVE_ISSUE } = require('../utils/library');

const FIELDS = ['name', 'email', 'phone', 'profilePhoto', 'department', 'course', 'year', 'membershipType', 'membershipStart', 'membershipExpiry', 'status'];

// GET /api/members
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 12, 500);
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { memberId: rx }, { phone: rx }, { department: rx }, { course: rx }];
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.membershipType = req.query.type;
  const sortMap = { name: { name: 1 }, newest: { createdAt: -1 }, fine: { pendingFine: -1 }, expiry: { membershipExpiry: 1 } };
  const [data, total] = await Promise.all([
    Member.find(filter).sort(sortMap[req.query.sort] || { createdAt: -1 }).skip(skip).limit(limit).lean(),
    Member.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// GET /api/members/:id — profile with full history
exports.get = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id);
  if (req.user.role === 'student' && String(req.user.member) !== String(member._id)) throw new ApiError(403, 'You can only view your own membership');
  await syncMember(member._id);
  const [fresh, issues, fines, payments, reservations] = await Promise.all([
    Member.findById(member._id).lean(),
    Issue.find({ member: member._id }).sort({ issueDate: -1 }).populate('book', 'bookId title coverImage isbn authorName').lean(),
    Fine.find({ member: member._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ member: member._id }).sort({ date: -1 }).lean(),
    Reservation.find({ member: member._id }).sort({ reservationDate: -1 }).populate('book', 'bookId title').lean(),
  ]);
  fines.forEach((f) => {
    f.remainingAmount = Math.max(0, f.originalAmount - f.discount - f.paidAmount - f.waivedAmount);
  });
  res.json({ success: true, data: fresh, issues, fines, payments, reservations });
});

// POST /api/members
exports.create = asyncHandler(async (req, res) => {
  const body = pick(req.body, FIELDS);
  if (!body.membershipExpiry) body.membershipExpiry = addDays(body.membershipStart || new Date(), 365);
  if (new Date(body.membershipExpiry) <= new Date(body.membershipStart || Date.now())) throw new ApiError(400, 'Expiry date must be after the start date');
  const member = await Member.create({ ...body, memberId: await nextId('member', 'MEM') });

  // Record the membership fee if collected at the desk
  if (req.body.collectFee) {
    const settings = await Setting.get();
    await Payment.create({
      paymentId: await nextId('payment', 'PAY', 5),
      receiptNo: await nextId('receipt', 'RCPT-', 6),
      member: member._id,
      reason: 'Membership Fee',
      amount: Number(req.body.feeAmount) || settings.membershipFee,
      method: req.body.feeMethod || 'Cash',
      status: 'Paid',
      collectedBy: req.user._id,
      collectedByName: req.user.name,
    });
  }
  await notify({ type: 'system', title: 'New member added', message: `${member.name} (${member.memberId}) joined as ${member.membershipType}.`, link: 'members.html' });
  res.status(201).json({ success: true, data: member });
});

// PUT /api/members/:id
exports.update = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id);
  Object.assign(member, pick(req.body, FIELDS));
  if (member.membershipExpiry <= member.membershipStart) throw new ApiError(400, 'Expiry date must be after the start date');
  if (req.body.membershipExpiry && member.membershipExpiry > new Date()) {
    member.expiryNotified = false;
    if (member.status === 'Expired') member.status = 'Active';
  }
  await member.save();
  if (member.user && (req.body.name || req.body.email)) await User.updateOne({ _id: member.user }, { name: member.name, email: member.email });
  res.json({ success: true, data: member });
});

// PATCH /api/members/:id/renew — extend membership by N months (default 12)
exports.renew = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id);
  const months = Math.min(60, Math.max(1, Number(req.body.months) || 12));
  const base = member.membershipExpiry > new Date() ? member.membershipExpiry : new Date();
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  member.membershipExpiry = next;
  if (member.status === 'Expired') member.status = 'Active';
  member.expiryNotified = false;
  await member.save();
  let payment = null;
  if (req.body.collectFee !== false) {
    const settings = await Setting.get();
    payment = await Payment.create({
      paymentId: await nextId('payment', 'PAY', 5),
      receiptNo: await nextId('receipt', 'RCPT-', 6),
      member: member._id,
      reason: `Membership Renewal (${months} months)`,
      amount: Number(req.body.amount) || Math.round((settings.membershipFee * months) / 12),
      method: req.body.method || 'Cash',
      status: 'Paid',
      collectedBy: req.user._id,
      collectedByName: req.user.name,
    });
  }
  await notify({ audience: 'member', member: member._id, type: 'membership', title: 'Membership renewed', message: `Your membership is valid until ${next.toDateString()}.` });
  res.json({ success: true, data: member, payment });
});

// DELETE /api/members/:id
exports.remove = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id);
  const active = await Issue.countDocuments({ member: member._id, status: { $in: ACTIVE_ISSUE } });
  if (active) throw new ApiError(400, `Member has ${active} book(s) still issued. Collect them before deleting.`);
  await syncMember(member._id);
  const fresh = await Member.findById(member._id);
  if (fresh.pendingFine > 0) throw new ApiError(400, `Member has ₹${fresh.pendingFine} pending fines. Settle or waive them first.`);
  await Reservation.updateMany({ member: member._id, status: { $in: ['Waiting', 'Available'] } }, { status: 'Cancelled' });
  if (member.user) await User.updateOne({ _id: member.user }, { isActive: false, $unset: { member: 1 } });
  await member.deleteOne();
  res.json({ success: true, message: 'Member deleted' });
});
