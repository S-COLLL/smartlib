/**
 * Core library bookkeeping. Counters on Book / Shelf / Member are derived from
 * the transactional collections (Issues, Reservations, Fines, Payments) so they
 * can never drift out of sync.
 */
const Book = require('../models/Book');
const Shelf = require('../models/Shelf');
const Member = require('../models/Member');
const Issue = require('../models/Issue');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const mongoose = require('mongoose');
const { addDays, startOfDay } = require('./helpers');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const ACTIVE_ISSUE = ['Issued', 'Overdue'];

async function notify({ audience = 'staff', member, type = 'system', title, message, link = '' }) {
  try {
    return await Notification.create({ audience, member, type, title, message, link });
  } catch (e) {
    console.error('Notification failed:', e.message);
    return null;
  }
}

function computeBookStatus(b) {
  if (b.availableCopies > 0) return 'Available';
  if (b.reservedCopies > 0) return 'Reserved';
  if (b.issuedCopies > 0) return 'Issued';
  if (b.lostCopies >= b.quantity) return 'Lost';
  if (b.damagedCopies > 0) return 'Damaged';
  return 'Unavailable';
}

async function recalcBook(bookId) {
  const book = await Book.findById(bookId);
  if (!book) return null;
  const [issued, reserved] = await Promise.all([
    Issue.countDocuments({ book: book._id, status: { $in: ACTIVE_ISSUE } }),
    Reservation.countDocuments({ book: book._id, status: 'Available' }),
  ]);
  book.issuedCopies = issued;
  book.reservedCopies = reserved;
  book.availableCopies = Math.max(0, book.quantity - issued - reserved - book.lostCopies - book.damagedCopies);
  book.status = computeBookStatus(book);
  await book.save();
  return book;
}

async function recalcShelf(shelfId) {
  if (!shelfId) return;
  shelfId = oid(shelfId);
  const [agg] = await Book.aggregate([
    { $match: { 'location.shelf': shelfId } },
    { $group: { _id: null, total: { $sum: { $subtract: ['$quantity', '$lostCopies'] } } } },
  ]);
  await Shelf.updateOne({ _id: shelfId }, { occupied: agg ? Math.max(0, agg.total) : 0 });
}

async function recalcAllShelves() {
  const shelves = await Shelf.find({}, '_id');
  await Promise.all(shelves.map((s) => recalcShelf(s._id)));
}

async function syncMember(memberId) {
  if (!memberId) return;
  memberId = oid(memberId);
  const [issued, returned, fines, paid] = await Promise.all([
    Issue.countDocuments({ member: memberId, status: { $in: ACTIVE_ISSUE } }),
    Issue.countDocuments({ member: memberId, status: { $in: ['Returned', 'Damaged', 'Lost'] } }),
    Fine.find({ member: memberId, status: { $in: ['Pending', 'Partially Paid'] } }),
    Payment.aggregate([
      { $match: { member: memberId, status: { $in: ['Paid', 'Partially Paid'] }, fine: { $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const pending = fines.reduce((s, f) => s + f.remainingAmount, 0);
  await Member.updateOne(
    { _id: memberId },
    { booksIssued: issued, booksReturned: returned, pendingFine: pending, totalFinePaid: paid[0] ? paid[0].total : 0 }
  );
}

async function refreshQueuePositions(bookId) {
  const waiting = await Reservation.find({ book: bookId, status: 'Waiting' }).sort({ reservationDate: 1 });
  await Promise.all(
    waiting.map((r, i) => (r.queuePosition !== i + 1 ? Reservation.updateOne({ _id: r._id }, { queuePosition: i + 1 }) : null))
  );
}

/** Promote waiting reservations while free copies exist. */
async function processReservationQueue(bookId) {
  const settings = await Setting.get();
  let book = await recalcBook(bookId);
  while (book && book.availableCopies > 0) {
    const next = await Reservation.findOne({ book: bookId, status: 'Waiting' }).sort({ reservationDate: 1 }).populate('member', 'name memberId');
    if (!next) break;
    next.status = 'Available';
    next.queuePosition = 0;
    next.availableSince = new Date();
    next.expiryDate = addDays(new Date(), settings.reservationHoldDays);
    await next.save();
    await notify({
      audience: 'member',
      member: next.member._id,
      type: 'reservation',
      title: 'Reserved book is ready',
      message: `"${book.title}" is now available for pickup. Please collect it before ${next.expiryDate.toDateString()}.`,
      link: `book-details.html?id=${book.bookId}`,
    });
    await notify({
      type: 'reservation',
      title: 'Reservation ready for pickup',
      message: `${next.member.name} (${next.member.memberId}) can now collect "${book.title}".`,
      link: 'reservations.html',
    });
    book = await recalcBook(bookId);
  }
  await refreshQueuePositions(bookId);
  return book;
}

/**
 * Periodic maintenance: mark overdue issues, send due-soon reminders, expire
 * memberships and stale reservations. Safe to run any number of times.
 */
async function runMaintenance() {
  const settings = await Setting.get();
  const now = new Date();
  const today = startOfDay(now);

  // Overdue issues
  const overdue = await Issue.find({ status: 'Issued', dueDate: { $lt: today } });
  for (const issue of overdue) {
    issue.status = 'Overdue';
    if (!issue.overdueNotified) {
      issue.overdueNotified = true;
      await notify({
        audience: 'member',
        member: issue.member,
        type: 'overdue',
        title: 'Book overdue',
        message: `"${issue.bookTitle}" was due on ${issue.dueDate.toDateString()}. A fine of ₹${settings.finePerDay}/day applies.`,
        link: 'issues.html',
      });
      await notify({
        type: 'overdue',
        title: 'Book overdue',
        message: `${issue.memberName} has not returned "${issue.bookTitle}" (${issue.transactionId}).`,
        link: 'returns.html',
      });
    }
    await issue.save();
  }

  // Due soon reminders
  const dueSoon = await Issue.find({
    status: 'Issued',
    dueSoonNotified: false,
    dueDate: { $gte: today, $lte: addDays(today, settings.dueSoonDays + 1) },
  });
  for (const issue of dueSoon) {
    issue.dueSoonNotified = true;
    await issue.save();
    await notify({
      audience: 'member',
      member: issue.member,
      type: 'due-soon',
      title: 'Book due soon',
      message: `"${issue.bookTitle}" is due on ${issue.dueDate.toDateString()}. Return or renew it to avoid fines.`,
      link: 'issues.html',
    });
  }

  // Memberships
  await Member.updateMany({ status: 'Active', membershipExpiry: { $lt: now } }, { status: 'Expired' });
  const expiring = await Member.find({
    status: 'Active',
    expiryNotified: false,
    membershipExpiry: { $gte: now, $lte: addDays(now, 15) },
  });
  for (const m of expiring) {
    m.expiryNotified = true;
    await m.save();
    await notify({
      audience: 'member',
      member: m._id,
      type: 'membership',
      title: 'Membership expiring soon',
      message: `Your membership expires on ${m.membershipExpiry.toDateString()}. Renew it at the library desk.`,
      link: 'members.html',
    });
    await notify({
      type: 'membership',
      title: 'Membership expiring',
      message: `${m.name} (${m.memberId}) membership expires on ${m.membershipExpiry.toDateString()}.`,
      link: 'members.html',
    });
  }

  // Reservations: held copies not collected in time, and stale waiting requests
  const stale = await Reservation.find({ status: { $in: ['Available', 'Waiting'] }, expiryDate: { $lt: now } });
  const touched = new Set();
  for (const r of stale) {
    r.status = 'Expired';
    await r.save();
    touched.add(String(r.book));
  }
  for (const bookId of touched) await processReservationQueue(bookId);

  // Keep member counters fresh for overdue changes
  const affected = new Set(overdue.map((i) => String(i.member)));
  for (const id of affected) await syncMember(id);
}

module.exports = {
  ACTIVE_ISSUE,
  notify,
  recalcBook,
  recalcShelf,
  recalcAllShelves,
  syncMember,
  processReservationQueue,
  refreshQueuePositions,
  runMaintenance,
  computeBookStatus,
};
