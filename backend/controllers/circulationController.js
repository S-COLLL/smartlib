// Issues, Returns and Reservations
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const Return = require('../models/Return');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Book = require('../models/Book');
const Member = require('../models/Member');
const Setting = require('../models/Setting');
const { ApiError, asyncHandler, nextId, escapeRegex, paginate, addDays, daysBetween, startOfDay, round2 } = require('../utils/helpers');
const { findBook, findMember } = require('../utils/lookup');
const { recalcBook, recalcShelf, syncMember, notify, processReservationQueue, refreshQueuePositions, ACTIVE_ISSUE } = require('../utils/library');

const studentScope = (req, filter) => {
  if (req.user.role === 'student') filter.member = req.user.member || null;
  return filter;
};

/* ============================== ISSUES ============================== */

// GET /api/issues
exports.listIssues = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 15, 500);
  const filter = studentScope(req, {});
  if (req.query.status) filter.status = req.query.status === 'Active' ? { $in: ACTIVE_ISSUE } : req.query.status;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ transactionId: rx }, { memberCode: rx }, { memberName: rx }, { bookCode: rx }, { bookTitle: rx }];
  }
  if (req.query.member) filter.member = (await findMember(req.query.member))._id;
  if (req.query.from || req.query.to) {
    filter.issueDate = {};
    if (req.query.from) filter.issueDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.issueDate.$lte = addDays(req.query.to, 1);
  }
  const [data, total] = await Promise.all([
    Issue.find(filter).sort({ issueDate: -1 }).skip(skip).limit(limit).populate('book', 'bookId title coverImage isbn price').lean(),
    Issue.countDocuments(filter),
  ]);
  const settings = await Setting.get();
  data.forEach((i) => {
    if (ACTIVE_ISSUE.includes(i.status)) {
      i.daysOverdue = daysBetween(i.dueDate, new Date());
      i.estimatedFine = i.daysOverdue * settings.finePerDay;
    }
  });
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// GET /api/issues/:id
exports.getIssue = asyncHandler(async (req, res) => {
  const q = mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { transactionId: req.params.id.toUpperCase() };
  const issue = await Issue.findOne(studentScope(req, q)).populate('book').populate('member').lean();
  if (!issue) throw new ApiError(404, 'Transaction not found');
  const [ret, fines] = await Promise.all([Return.findOne({ issue: issue._id }).lean(), Fine.find({ issue: issue._id })]);
  res.json({ success: true, data: issue, return: ret, fines });
});

// POST /api/issues  { member, book, dueDate?, days? }
exports.createIssue = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  const [member, book] = await Promise.all([findMember(req.body.member), findBook(req.body.book)]);
  await syncMember(member._id);
  const fresh = await Member.findById(member._id);

  if (fresh.status !== 'Active') throw new ApiError(400, `Membership is ${fresh.status}. Book cannot be issued.`);
  if (fresh.membershipExpiry < new Date()) throw new ApiError(400, 'Membership has expired. Renew it first.');
  if (fresh.booksIssued >= settings.maxBooksPerMember) throw new ApiError(400, `Member already has ${fresh.booksIssued} books (limit ${settings.maxBooksPerMember}).`);
  if (fresh.pendingFine > settings.maxPendingFine) throw new ApiError(400, `Member has ₹${fresh.pendingFine} pending fines (limit ₹${settings.maxPendingFine}). Collect payment first.`);
  if (await Issue.exists({ member: member._id, book: book._id, status: { $in: ACTIVE_ISSUE } })) {
    throw new ApiError(400, 'This member already has a copy of this book.');
  }

  // A held reservation for this member lets them collect the reserved copy
  const held = await Reservation.findOne({ member: member._id, book: book._id, status: 'Available' });
  const bookNow = await recalcBook(book._id);
  if (!held && bookNow.availableCopies < 1) {
    throw new ApiError(400, `No copies of "${book.title}" are available. You can reserve it instead.`);
  }

  let dueDate = req.body.dueDate ? new Date(req.body.dueDate) : addDays(new Date(), Number(req.body.days) || settings.loanDays);
  if (Number.isNaN(dueDate.getTime()) || startOfDay(dueDate) <= startOfDay(new Date())) throw new ApiError(400, 'Due date must be in the future');
  dueDate.setHours(23, 59, 0, 0);

  const issue = await Issue.create({
    transactionId: await nextId('issue', 'TXN', 5),
    member: member._id,
    book: book._id,
    memberCode: member.memberId,
    memberName: member.name,
    bookCode: book.bookId,
    bookTitle: book.title,
    issueDate: new Date(),
    dueDate,
    staff: req.user._id,
    staffName: req.user.name,
    status: 'Issued',
  });
  if (held) {
    held.status = 'Collected';
    await held.save();
  } else {
    // If the member had a waiting reservation, it's fulfilled now
    await Reservation.updateMany({ member: member._id, book: book._id, status: 'Waiting' }, { status: 'Collected' });
    await refreshQueuePositions(book._id);
  }
  await Book.updateOne({ _id: book._id }, { $inc: { timesBorrowed: 1 } });
  const updatedBook = await recalcBook(book._id);
  await syncMember(member._id);

  await notify({
    audience: 'member',
    member: member._id,
    type: 'issued',
    title: 'Book issued',
    message: `"${book.title}" has been issued to you. Due date: ${dueDate.toDateString()}.`,
    link: `book-details.html?id=${book.bookId}`,
  });
  res.status(201).json({ success: true, data: issue, book: updatedBook });
});

// PATCH /api/issues/:id/renew
exports.renewIssue = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  const issue = await Issue.findOne(studentScope(req, mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { transactionId: req.params.id.toUpperCase() }));
  if (!issue) throw new ApiError(404, 'Transaction not found');
  if (!ACTIVE_ISSUE.includes(issue.status)) throw new ApiError(400, `Cannot renew a ${issue.status.toLowerCase()} transaction`);
  if (issue.status === 'Overdue' || startOfDay(issue.dueDate) < startOfDay(new Date())) throw new ApiError(400, 'Overdue books cannot be renewed. Please return the book and clear the fine.');
  if (issue.renewalCount >= settings.maxRenewals) throw new ApiError(400, `Renewal limit reached (${settings.maxRenewals})`);
  const waiting = await Reservation.countDocuments({ book: issue.book, status: 'Waiting' });
  if (waiting) throw new ApiError(400, `Cannot renew — ${waiting} member(s) are waiting for this book`);
  issue.dueDate = addDays(issue.dueDate, settings.loanDays);
  issue.renewalCount += 1;
  issue.dueSoonNotified = false;
  await issue.save();
  await notify({
    audience: 'member',
    member: issue.member,
    type: 'issued',
    title: 'Book renewed',
    message: `"${issue.bookTitle}" renewed. New due date: ${issue.dueDate.toDateString()}.`,
    link: 'issues.html',
  });
  res.json({ success: true, data: issue, message: `Renewed until ${issue.dueDate.toDateString()}` });
});

/* ============================== RETURNS ============================= */

async function findActiveIssues(q) {
  const term = String(q || '').trim();
  if (!term) return [];
  const rx = new RegExp(`^${escapeRegex(term)}$`, 'i');
  const or = [{ transactionId: rx }, { memberCode: rx }, { bookCode: rx }];
  const byIsbn = await Book.find({ isbn: term }, '_id');
  if (byIsbn.length) or.push({ book: { $in: byIsbn.map((b) => b._id) } });
  const partial = new RegExp(escapeRegex(term), 'i');
  or.push({ memberName: partial }, { bookTitle: partial });
  return Issue.find({ status: { $in: ACTIVE_ISSUE }, $or: or }).sort({ dueDate: 1 }).limit(25).populate('book', 'bookId title isbn price coverImage authorName').populate('member', 'memberId name email pendingFine').lean();
}

function computeCharges(issue, settings, { condition = 'Good', returnDate = new Date(), damageCharge } = {}) {
  const daysOverdue = daysBetween(issue.dueDate, returnDate);
  const lateFine = daysOverdue * settings.finePerDay;
  const price = issue.book?.price || 0;
  let dmg = 0;
  let lost = 0;
  if (condition === 'Damaged') dmg = damageCharge !== undefined && damageCharge !== '' ? Number(damageCharge) : round2((price * settings.damageChargePercent) / 100);
  if (condition === 'Lost') lost = price + settings.lostProcessingFee;
  return { daysOverdue, lateFine, damageCharge: dmg, lostCharge: lost, totalFine: round2(lateFine + dmg + lost), finePerDay: settings.finePerDay };
}

// GET /api/returns/lookup?q=
exports.lookup = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  const issues = await findActiveIssues(req.query.q);
  const data = issues.map((i) => ({ ...i, charges: computeCharges(i, settings) }));
  res.json({ success: true, data, settings: { finePerDay: settings.finePerDay, damageChargePercent: settings.damageChargePercent, lostProcessingFee: settings.lostProcessingFee } });
});

// GET /api/returns
exports.listReturns = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 15, 500);
  const filter = studentScope(req, {});
  if (req.query.condition) filter.condition = req.query.condition;
  const [data, total] = await Promise.all([
    Return.find(filter).sort({ returnDate: -1 }).skip(skip).limit(limit).populate('book', 'bookId title').populate('member', 'memberId name').lean(),
    Return.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// POST /api/returns  { issue, condition, damageCharge?, returnDate?, remarks? }
exports.createReturn = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  const ref = req.body.issue;
  const issue = await Issue.findOne(mongoose.isValidObjectId(ref) ? { _id: ref } : { transactionId: String(ref || '').toUpperCase() }).populate('book');
  if (!issue) throw new ApiError(404, 'Transaction not found');
  if (!ACTIVE_ISSUE.includes(issue.status)) throw new ApiError(400, `This transaction is already ${issue.status.toLowerCase()}`);
  const condition = ['Good', 'Damaged', 'Lost'].includes(req.body.condition) ? req.body.condition : 'Good';
  const returnDate = req.body.returnDate ? new Date(req.body.returnDate) : new Date();
  if (Number.isNaN(returnDate.getTime()) || returnDate < startOfDay(issue.issueDate)) throw new ApiError(400, 'Return date cannot be before the issue date');
  if (returnDate > new Date()) throw new ApiError(400, 'Return date cannot be in the future');
  if (req.body.damageCharge !== undefined && req.body.damageCharge !== '' && (Number.isNaN(Number(req.body.damageCharge)) || Number(req.body.damageCharge) < 0)) {
    throw new ApiError(400, 'Damage charge must be a positive number');
  }
  const c = computeCharges(issue, settings, { condition, returnDate, damageCharge: req.body.damageCharge });

  issue.returnDate = returnDate;
  issue.status = condition === 'Good' ? 'Returned' : condition;
  issue.fineAmount = c.totalFine;
  await issue.save();

  const book = issue.book;
  if (condition === 'Lost') book.lostCopies += 1;
  if (condition === 'Damaged') book.damagedCopies += 1;
  await book.save();

  const ret = await Return.create({
    returnId: await nextId('return', 'RET', 5),
    issue: issue._id,
    member: issue.member,
    book: book._id,
    transactionId: issue.transactionId,
    issueDate: issue.issueDate,
    dueDate: issue.dueDate,
    returnDate,
    daysOverdue: c.daysOverdue,
    condition,
    lateFine: c.lateFine,
    damageCharge: c.damageCharge,
    lostCharge: c.lostCharge,
    totalFine: c.totalFine,
    remarks: req.body.remarks || '',
    processedBy: req.user._id,
  });

  const fines = [];
  const base = { member: issue.member, issue: issue._id, book: book._id, transactionId: issue.transactionId };
  if (c.lateFine > 0) {
    fines.push(await Fine.create({ ...base, fineId: await nextId('fine', 'FIN', 5), type: 'Late Fine', daysOverdue: c.daysOverdue, ratePerDay: settings.finePerDay, originalAmount: c.lateFine, description: `${c.daysOverdue} day(s) late × ₹${settings.finePerDay}/day` }));
  }
  if (c.damageCharge > 0) {
    fines.push(await Fine.create({ ...base, fineId: await nextId('fine', 'FIN', 5), type: 'Damage', originalAmount: c.damageCharge, description: `Damage charge for "${book.title}"` }));
  }
  if (c.lostCharge > 0) {
    fines.push(await Fine.create({ ...base, fineId: await nextId('fine', 'FIN', 5), type: 'Lost Book', originalAmount: c.lostCharge, description: `Replacement ₹${book.price} + processing ₹${settings.lostProcessingFee}` }));
  }
  if (fines.length) {
    await notify({
      audience: 'member',
      member: issue.member,
      type: 'fine',
      title: 'Fine generated',
      message: `A fine of ₹${c.totalFine} was generated for "${book.title}" (${issue.transactionId}).`,
      link: 'fines.html',
    });
  }
  await notify({
    type: 'returned',
    title: condition === 'Good' ? 'Book returned' : `Book reported ${condition.toLowerCase()}`,
    message: `${issue.memberName} returned "${book.title}"${c.daysOverdue ? ` ${c.daysOverdue} day(s) late` : ''}${c.totalFine ? ` — fine ₹${c.totalFine}` : ''}.`,
    link: 'returns.html',
  });

  const updatedBook = await processReservationQueue(book._id);
  await recalcShelf(book.location?.shelf);
  await syncMember(issue.member);
  res.status(201).json({ success: true, data: ret, fines, book: updatedBook, message: c.totalFine ? `Returned with fine ₹${c.totalFine}` : 'Returned on time — no fine' });
});

/* ============================ RESERVATIONS ========================== */

// GET /api/reservations
exports.listReservations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 15, 500);
  const filter = studentScope(req, {});
  if (req.query.status) filter.status = req.query.status;
  if (req.query.book) filter.book = (await findBook(req.query.book))._id;
  const [data, total] = await Promise.all([
    Reservation.find(filter)
      .sort({ status: 1, reservationDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('book', 'bookId title coverImage availableCopies isbn location')
      .populate('member', 'memberId name email')
      .lean(),
    Reservation.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// POST /api/reservations  { member?, book }
exports.createReservation = asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  const memberRef = req.user.role === 'student' ? req.user.member : req.body.member;
  if (!memberRef) throw new ApiError(400, 'Your account is not linked to a library membership');
  const [member, book] = await Promise.all([findMember(memberRef), findBook(req.body.book)]);
  if (member.status !== 'Active') throw new ApiError(400, `Membership is ${member.status}. Cannot reserve.`);
  if (await Reservation.exists({ member: member._id, book: book._id, status: { $in: ['Waiting', 'Available'] } })) {
    throw new ApiError(400, 'This member already has an active reservation for this book');
  }
  if (await Issue.exists({ member: member._id, book: book._id, status: { $in: ACTIVE_ISSUE } })) {
    throw new ApiError(400, 'This member currently has this book issued');
  }
  const r = await Reservation.create({
    reservationId: await nextId('reservation', 'RES', 5),
    member: member._id,
    book: book._id,
    reservationDate: new Date(),
    expiryDate: addDays(new Date(), settings.reservationValidityDays),
    status: 'Waiting',
    createdBy: req.user._id,
  });
  await processReservationQueue(book._id); // becomes "Available" immediately if a copy is free
  const fresh = await Reservation.findById(r._id).populate('book', 'bookId title').populate('member', 'memberId name');
  await notify({
    type: 'reservation',
    title: 'New reservation',
    message: `${member.name} reserved "${book.title}" (${fresh.status === 'Available' ? 'ready for pickup' : `queue #${fresh.queuePosition}`}).`,
    link: 'reservations.html',
  });
  res.status(201).json({
    success: true,
    data: fresh,
    message: fresh.status === 'Available' ? 'A copy is on hold — ready for pickup' : `Reserved — position #${fresh.queuePosition} in queue`,
  });
});

async function loadReservation(req) {
  const q = mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { reservationId: req.params.id.toUpperCase() };
  const r = await Reservation.findOne(studentScope(req, q));
  if (!r) throw new ApiError(404, 'Reservation not found');
  return r;
}

// PATCH /api/reservations/:id/cancel
exports.cancelReservation = asyncHandler(async (req, res) => {
  const r = await loadReservation(req);
  if (!['Waiting', 'Available'].includes(r.status)) throw new ApiError(400, `Reservation is already ${r.status.toLowerCase()}`);
  r.status = 'Cancelled';
  await r.save();
  await processReservationQueue(r.book);
  res.json({ success: true, data: r, message: 'Reservation cancelled' });
});

// PATCH /api/reservations/:id/collect — issue the held copy to the member
exports.collectReservation = asyncHandler(async (req, res, next) => {
  const r = await loadReservation(req);
  if (r.status !== 'Available') throw new ApiError(400, 'Only reservations marked "Available" can be collected');
  req.body = { member: String(r.member), book: String(r.book), days: req.body?.days };
  return exports.createIssue(req, res, next);
});

// DELETE /api/reservations/:id (admin cleanup of closed reservations)
exports.deleteReservation = asyncHandler(async (req, res) => {
  const r = await loadReservation(req);
  if (['Waiting', 'Available'].includes(r.status)) throw new ApiError(400, 'Cancel the reservation before deleting it');
  await r.deleteOne();
  res.json({ success: true, message: 'Reservation deleted' });
});
