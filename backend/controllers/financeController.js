// Fines and Payments (mock payment gateway — no real money is processed)
const crypto = require('crypto');
const mongoose = require('mongoose');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const Setting = require('../models/Setting');
const { ApiError, asyncHandler, nextId, escapeRegex, paginate, round2 } = require('../utils/helpers');
const { findMember } = require('../utils/lookup');
const { syncMember, notify } = require('../utils/library');

const studentScope = (req, filter) => {
  if (req.user.role === 'student') filter.member = req.user.member || null;
  return filter;
};

async function loadFine(req) {
  const q = mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { fineId: req.params.id.toUpperCase() };
  const fine = await Fine.findOne(studentScope(req, q));
  if (!fine) throw new ApiError(404, 'Fine not found');
  return fine;
}

/* =============================== FINES ============================== */

// GET /api/fines
exports.listFines = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 15, 500);
  const filter = studentScope(req, {});
  if (req.query.status) filter.status = req.query.status === 'Outstanding' ? { $in: ['Pending', 'Partially Paid'] } : req.query.status;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.member) filter.member = (await findMember(req.query.member))._id;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    const Member = mongoose.model('Member');
    const members = await Member.find({ $or: [{ name: rx }, { memberId: rx }] }, '_id');
    filter.$or = [{ fineId: rx }, { transactionId: rx }, { description: rx }, { member: { $in: members.map((m) => m._id) } }];
  }
  const [docs, total] = await Promise.all([
    Fine.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('member', 'memberId name email').populate('book', 'bookId title price'),
    Fine.countDocuments(filter),
  ]);
  res.json({ success: true, data: docs.map((d) => d.toJSON()), pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// GET /api/fines/summary
exports.fineSummary = asyncHandler(async (req, res) => {
  const match = studentScope(req, {});
  const [agg] = await Fine.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        original: { $sum: '$originalAmount' },
        discount: { $sum: '$discount' },
        paid: { $sum: '$paidAmount' },
        waived: { $sum: '$waivedAmount' },
        count: { $sum: 1 },
        pendingCount: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Partially Paid']] }, 1, 0] } },
      },
    },
  ]);
  const s = agg || { original: 0, discount: 0, paid: 0, waived: 0, count: 0, pendingCount: 0 };
  const byType = await Fine.aggregate([{ $match: match }, { $group: { _id: '$type', amount: { $sum: '$originalAmount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]);
  const settings = await Setting.get();
  res.json({
    success: true,
    data: { ...s, remaining: round2(s.original - s.discount - s.paid - s.waived), byType, finePerDay: settings.finePerDay },
  });
});

// POST /api/fines — manual charge (damage, replacement, membership fee, other)
exports.createFine = asyncHandler(async (req, res) => {
  const member = await findMember(req.body.member);
  const fine = await Fine.create({
    fineId: await nextId('fine', 'FIN', 5),
    member: member._id,
    type: req.body.type,
    originalAmount: Number(req.body.amount),
    description: req.body.description || '',
    transactionId: req.body.transactionId || undefined,
  });
  await syncMember(member._id);
  await notify({ audience: 'member', member: member._id, type: 'fine', title: 'New charge added', message: `${fine.type}: ₹${fine.originalAmount}. ${fine.description}`, link: 'fines.html' });
  res.status(201).json({ success: true, data: fine });
});

// PATCH /api/fines/:id/discount  { discount }
exports.discountFine = asyncHandler(async (req, res) => {
  const fine = await loadFine(req);
  const discount = Number(req.body.discount);
  if (Number.isNaN(discount) || discount < 0) throw new ApiError(400, 'Discount must be a positive number');
  if (discount > fine.originalAmount - fine.paidAmount - fine.waivedAmount) throw new ApiError(400, 'Discount cannot exceed the unpaid amount');
  fine.discount = discount;
  fine.refreshStatus();
  await fine.save();
  await syncMember(fine.member);
  res.json({ success: true, data: fine, message: `Discount of ₹${discount} applied` });
});

// PATCH /api/fines/:id/waive  { reason }
exports.waiveFine = asyncHandler(async (req, res) => {
  const fine = await loadFine(req);
  const remaining = fine.remainingAmount;
  if (remaining <= 0) throw new ApiError(400, 'Nothing left to waive on this fine');
  fine.waivedAmount += remaining;
  fine.refreshStatus();
  await fine.save();
  const payment = await Payment.create({
    paymentId: await nextId('payment', 'PAY', 5),
    member: fine.member,
    fine: fine._id,
    transactionId: fine.transactionId,
    reason: `${fine.type} waived${req.body.reason ? ` — ${req.body.reason}` : ''}`,
    amount: remaining,
    method: 'Cash',
    status: 'Waived',
    notes: req.body.reason || '',
    collectedBy: req.user._id,
    collectedByName: req.user.name,
  });
  await syncMember(fine.member);
  res.json({ success: true, data: fine, payment, message: `₹${remaining} waived` });
});

// DELETE /api/fines/:id — only unpaid fines (admin)
exports.deleteFine = asyncHandler(async (req, res) => {
  const fine = await loadFine(req);
  if (fine.paidAmount > 0 || fine.waivedAmount > 0) throw new ApiError(400, 'Fines with payments cannot be deleted');
  await fine.deleteOne();
  await syncMember(fine.member);
  res.json({ success: true, message: 'Fine deleted' });
});

/* ============================= PAYMENTS ============================= */

// GET /api/payments
exports.listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 15, 500);
  const filter = studentScope(req, {});
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.member) filter.member = (await findMember(req.query.member))._id;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(new Date(req.query.to).getTime() + 86400000);
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    const members = await mongoose.model('Member').find({ $or: [{ name: rx }, { memberId: rx }] }, '_id');
    filter.$or = [{ paymentId: rx }, { receiptNo: rx }, { transactionId: rx }, { reason: rx }, { reference: rx }, { member: { $in: members.map((m) => m._id) } }];
  }
  const [data, total, totals] = await Promise.all([
    Payment.find(filter).sort({ date: -1 }).skip(skip).limit(limit).populate('member', 'memberId name email').populate('fine', 'fineId type').lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);
  res.json({ success: true, data, totals, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// GET /api/payments/:id — receipt data
exports.getPayment = asyncHandler(async (req, res) => {
  const q = mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { $or: [{ paymentId: req.params.id.toUpperCase() }, { receiptNo: req.params.id.toUpperCase() }] };
  const payment = await Payment.findOne(studentScope(req, q)).populate('member').populate({ path: 'fine', populate: { path: 'book', select: 'bookId title' } });
  if (!payment) throw new ApiError(404, 'Payment not found');
  const settings = await Setting.get();
  res.json({ success: true, data: payment, library: { name: settings.libraryName } });
});

function mockGatewayReference(method) {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  if (method === 'UPI') return `UPI${Date.now().toString().slice(-8)}${rand.slice(0, 4)}`;
  if (method === 'Card') return `AUTH-${rand}`;
  if (method === 'Bank Transfer') return `NEFT${Date.now().toString().slice(-10)}`;
  return `CASH-${rand.slice(0, 6)}`;
}

async function applyToFine(fine, amount) {
  fine.paidAmount = round2(fine.paidAmount + amount);
  fine.refreshStatus();
  await fine.save();
}

// POST /api/payments  { member, fine?, amount, method, reason?, status? ('Paid'|'Pending'), notes? }
exports.createPayment = asyncHandler(async (req, res) => {
  const amount = round2(req.body.amount);
  if (!(amount > 0)) throw new ApiError(400, 'Amount must be greater than zero');
  const method = req.body.method || 'Cash';
  let fine = null;
  let member;
  if (req.body.fine) {
    fine = await Fine.findOne(mongoose.isValidObjectId(req.body.fine) ? { _id: req.body.fine } : { fineId: String(req.body.fine).toUpperCase() });
    if (!fine) throw new ApiError(404, 'Fine not found');
    if (fine.remainingAmount <= 0) throw new ApiError(400, 'This fine is already settled');
    if (amount > fine.remainingAmount) throw new ApiError(400, `Amount exceeds the remaining balance of ₹${fine.remainingAmount}`);
    member = await findMember(fine.member);
  } else {
    member = await findMember(req.body.member);
    if (!req.body.reason) throw new ApiError(400, 'Reason is required for payments not linked to a fine');
  }

  const pending = req.body.status === 'Pending'; // e.g. bank transfer awaiting confirmation
  let status = 'Paid';
  if (pending) status = 'Pending';
  else if (fine && amount < fine.remainingAmount) status = 'Partially Paid';

  const payment = await Payment.create({
    paymentId: await nextId('payment', 'PAY', 5),
    receiptNo: pending ? undefined : await nextId('receipt', 'RCPT-', 6),
    member: member._id,
    fine: fine?._id,
    transactionId: fine?.transactionId || req.body.transactionId || undefined,
    reason: req.body.reason || (fine ? `${fine.type}${fine.description ? ` — ${fine.description}` : ''}` : ''),
    amount,
    method,
    status,
    reference: mockGatewayReference(method),
    notes: req.body.notes || '',
    collectedBy: req.user._id,
    collectedByName: req.user.name,
  });
  if (fine && !pending) await applyToFine(fine, amount);
  await syncMember(member._id);

  if (!pending) {
    await notify({ audience: 'member', member: member._id, type: 'payment', title: 'Payment received', message: `₹${amount} received via ${method} (${payment.receiptNo}). Thank you!`, link: 'payments.html' });
    await notify({ type: 'payment', title: 'Payment completed', message: `${member.name} paid ₹${amount} via ${method} — ${payment.reason}.`, link: 'payments.html' });
  }
  res.status(201).json({ success: true, data: payment, fine, message: pending ? 'Payment recorded as pending' : `Payment of ₹${amount} successful` });
});

// PATCH /api/payments/:id/confirm — confirm a pending payment
exports.confirmPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne(mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { paymentId: req.params.id.toUpperCase() });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status !== 'Pending') throw new ApiError(400, 'Only pending payments can be confirmed');
  if (payment.fine) {
    const fine = await Fine.findById(payment.fine);
    if (fine) {
      if (payment.amount > fine.remainingAmount) throw new ApiError(400, `Fine balance is now ₹${fine.remainingAmount}; payment exceeds it`);
      await applyToFine(fine, payment.amount);
      payment.status = fine.status === 'Paid' ? 'Paid' : 'Partially Paid';
    } else payment.status = 'Paid';
  } else payment.status = 'Paid';
  payment.receiptNo = await nextId('receipt', 'RCPT-', 6);
  payment.date = new Date();
  await payment.save();
  await syncMember(payment.member);
  await notify({ audience: 'member', member: payment.member, type: 'payment', title: 'Payment confirmed', message: `₹${payment.amount} confirmed (${payment.receiptNo}).`, link: 'payments.html' });
  res.json({ success: true, data: payment, message: 'Payment confirmed' });
});
