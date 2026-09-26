const Book = require('../models/Book');
const Member = require('../models/Member');
const Issue = require('../models/Issue');
const Return = require('../models/Return');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const Shelf = require('../models/Shelf');
const Setting = require('../models/Setting');
const { ApiError, asyncHandler, addDays, daysBetween, round2 } = require('../utils/helpers');
const { runMaintenance, recalcAllShelves, ACTIVE_ISSUE } = require('../utils/library');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${m.getFullYear()}-${m.getMonth() + 1}`, label: `${MONTHS[m.getMonth()]} '${String(m.getFullYear()).slice(2)}`, start: m });
  }
  return out;
}

async function monthly(Model, dateField, sumField, months, match = {}) {
  const rows = await Model.aggregate([
    { $match: { ...match, [dateField]: { $gte: months[0].start } } },
    {
      $group: {
        _id: { y: { $year: { date: `$${dateField}`, timezone: '+05:30' } }, m: { $month: { date: `$${dateField}`, timezone: '+05:30' } } },
        v: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
      },
    },
  ]);
  const map = Object.fromEntries(rows.map((r) => [`${r._id.y}-${r._id.m}`, r.v]));
  return months.map((m) => round2(map[m.key] || 0));
}

// GET /api/reports/dashboard
exports.dashboard = asyncHandler(async (_req, res) => {
  await runMaintenance();
  await recalcAllShelves();
  const now = new Date();
  const months = lastMonths(6);

  const [bookAgg] = await Book.aggregate([
    {
      $group: {
        _id: null,
        titles: { $sum: 1 },
        total: { $sum: '$quantity' },
        available: { $sum: '$availableCopies' },
        issued: { $sum: '$issuedCopies' },
        reserved: { $sum: '$reservedCopies' },
        lost: { $sum: '$lostCopies' },
        damaged: { $sum: '$damagedCopies' },
        value: { $sum: { $multiply: ['$currentValue', '$quantity'] } },
      },
    },
  ]);
  const [fineAgg] = await Fine.aggregate([
    { $group: { _id: null, total: { $sum: { $subtract: ['$originalAmount', '$discount'] } }, paid: { $sum: '$paidAmount' }, waived: { $sum: '$waivedAmount' } } },
  ]);
  const [collectedAgg] = await Payment.aggregate([{ $match: { status: { $in: ['Paid', 'Partially Paid'] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);

  const settings = await Setting.get();
  const [totalMembers, activeMembers, overdueCount, waitingReservations, recentBooksCount] = await Promise.all([
    Member.countDocuments(),
    Member.countDocuments({ status: 'Active' }),
    Issue.countDocuments({ status: 'Overdue' }),
    Reservation.countDocuments({ status: 'Waiting' }),
    Book.countDocuments({ createdAt: { $gte: addDays(now, -30) } }),
  ]);
  // Fines that are still accruing on unreturned overdue books
  const overdueIssues = await Issue.find({ status: 'Overdue' }).sort({ dueDate: 1 }).populate('book', 'bookId title coverImage').lean();
  const accruing = overdueIssues.reduce((s, i) => s + daysBetween(i.dueDate, now) * settings.finePerDay, 0);

  const [issuedSeries, returnedSeries, fineSeries, collectedSeries] = await Promise.all([
    monthly(Issue, 'issueDate', null, months),
    monthly(Return, 'returnDate', null, months),
    monthly(Fine, 'createdAt', 'originalAmount', months),
    monthly(Payment, 'date', 'amount', months, { status: { $in: ['Paid', 'Partially Paid'] } }),
  ]);

  const [popular, categories, shelves, recentTx, recentMembers, recentBooks] = await Promise.all([
    Book.find({ timesBorrowed: { $gt: 0 } }).sort({ timesBorrowed: -1 }).limit(7).select('bookId title authorName timesBorrowed').lean(),
    Book.aggregate([{ $group: { _id: '$categoryName', copies: { $sum: '$quantity' }, titles: { $sum: 1 } } }, { $sort: { copies: -1 } }]),
    Shelf.find().sort({ floor: 1, code: 1 }).lean(),
    Issue.find().sort({ updatedAt: -1 }).limit(8).lean(),
    Member.find().sort({ createdAt: -1 }).limit(5).lean(),
    Book.find().sort({ createdAt: -1 }).limit(5).select('bookId title authorName coverImage isbn createdAt categoryName').lean(),
  ]);

  const b = bookAgg || {};
  res.json({
    success: true,
    data: {
      stats: {
        totalBooks: b.total || 0,
        titles: b.titles || 0,
        availableBooks: b.available || 0,
        issuedBooks: b.issued || 0,
        reservedBooks: (b.reserved || 0),
        waitingReservations,
        lostBooks: b.lost || 0,
        damagedBooks: b.damaged || 0,
        totalMembers,
        activeMembers,
        overdueBooks: overdueCount,
        totalFines: round2((fineAgg?.total || 0) + accruing),
        finesOutstanding: round2((fineAgg?.total || 0) - (fineAgg?.paid || 0) - (fineAgg?.waived || 0) + accruing),
        accruingFines: accruing,
        totalCollected: round2(collectedAgg?.total || 0),
        booksAddedRecently: recentBooksCount,
        collectionValue: round2(b.value || 0),
      },
      charts: {
        months: months.map((m) => m.label),
        issued: issuedSeries,
        returned: returnedSeries,
        fines: fineSeries,
        collected: collectedSeries,
        popular: popular.map((p) => ({ label: p.title, author: p.authorName, value: p.timesBorrowed, id: p.bookId })),
        categories: categories.map((c) => ({ label: c._id || 'Uncategorised', value: c.copies, titles: c.titles })),
        shelves: shelves.map((s) => ({
          label: s.name,
          code: s.code,
          floor: s.floor,
          section: s.section,
          occupied: s.occupied,
          capacity: s.capacity,
          percent: s.capacity ? Math.round((s.occupied / s.capacity) * 100) : 0,
        })),
      },
      recentTransactions: recentTx,
      recentMembers,
      recentBooks,
      overdue: overdueIssues.slice(0, 6).map((i) => ({ ...i, daysOverdue: daysBetween(i.dueDate, now), fine: daysBetween(i.dueDate, now) * settings.finePerDay })),
    },
  });
});

/* ------------------------------ Reports ------------------------------ */

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const REPORTS = {
  books: {
    title: 'Books Report',
    columns: ['Book ID', 'Title', 'Author', 'Category', 'ISBN', 'Total', 'Available', 'Issued', 'Price (₹)', 'Location', 'Status'],
    async rows() {
      const books = await Book.find().sort({ bookId: 1 }).lean();
      return books.map((b) => [b.bookId, b.title, b.authorName, b.categoryName, b.isbn, b.quantity, b.availableCopies, b.issuedCopies, b.price, `F${b.location?.floor}-${b.location?.shelfCode}-R${b.location?.rack}-${b.location?.row}${b.location?.position}`, b.status]);
    },
  },
  issued: {
    title: 'Issued Books Report',
    columns: ['Transaction', 'Member ID', 'Member', 'Book ID', 'Book', 'Issue Date', 'Due Date', 'Renewals', 'Staff', 'Status'],
    async rows(q) {
      const filter = { status: { $in: ACTIVE_ISSUE } };
      if (q.from) filter.issueDate = { $gte: new Date(q.from), ...(q.to ? { $lte: addDays(q.to, 1) } : {}) };
      const list = await Issue.find(filter).sort({ issueDate: -1 }).lean();
      return list.map((i) => [i.transactionId, i.memberCode, i.memberName, i.bookCode, i.bookTitle, fmtDate(i.issueDate), fmtDate(i.dueDate), i.renewalCount, i.staffName, i.status]);
    },
  },
  returned: {
    title: 'Returned Books Report',
    columns: ['Return ID', 'Transaction', 'Member', 'Book', 'Issue Date', 'Due Date', 'Return Date', 'Days Late', 'Condition', 'Fine (₹)'],
    async rows(q) {
      const filter = {};
      if (q.from) filter.returnDate = { $gte: new Date(q.from), ...(q.to ? { $lte: addDays(q.to, 1) } : {}) };
      const list = await Return.find(filter).sort({ returnDate: -1 }).populate('member', 'name').populate('book', 'title').lean();
      return list.map((r) => [r.returnId, r.transactionId, r.member?.name, r.book?.title, fmtDate(r.issueDate), fmtDate(r.dueDate), fmtDate(r.returnDate), r.daysOverdue, r.condition, r.totalFine]);
    },
  },
  overdue: {
    title: 'Overdue Report',
    columns: ['Transaction', 'Member ID', 'Member', 'Book', 'Due Date', 'Days Overdue', 'Fine So Far (₹)'],
    async rows() {
      const s = await Setting.get();
      const list = await Issue.find({ status: 'Overdue' }).sort({ dueDate: 1 }).lean();
      return list.map((i) => {
        const d = daysBetween(i.dueDate, new Date());
        return [i.transactionId, i.memberCode, i.memberName, i.bookTitle, fmtDate(i.dueDate), d, d * s.finePerDay];
      });
    },
  },
  fines: {
    title: 'Fine Report',
    columns: ['Fine ID', 'Member', 'Type', 'Transaction', 'Original (₹)', 'Discount (₹)', 'Paid (₹)', 'Waived (₹)', 'Remaining (₹)', 'Status', 'Date'],
    async rows(q) {
      const filter = {};
      if (q.from) filter.createdAt = { $gte: new Date(q.from), ...(q.to ? { $lte: addDays(q.to, 1) } : {}) };
      const list = await Fine.find(filter).sort({ createdAt: -1 }).populate('member', 'name memberId');
      return list.map((f) => [f.fineId, `${f.member?.name} (${f.member?.memberId})`, f.type, f.transactionId || '', f.originalAmount, f.discount, f.paidAmount, f.waivedAmount, f.remainingAmount, f.status, fmtDate(f.createdAt)]);
    },
  },
  payments: {
    title: 'Payment Report',
    columns: ['Payment ID', 'Receipt', 'Member', 'Reason', 'Amount (₹)', 'Method', 'Status', 'Date', 'Collected By'],
    async rows(q) {
      const filter = {};
      if (q.from) filter.date = { $gte: new Date(q.from), ...(q.to ? { $lte: addDays(q.to, 1) } : {}) };
      const list = await Payment.find(filter).sort({ date: -1 }).populate('member', 'name memberId').lean();
      return list.map((p) => [p.paymentId, p.receiptNo || '—', `${p.member?.name} (${p.member?.memberId})`, p.reason, p.amount, p.method, p.status, fmtDate(p.date), p.collectedByName || '']);
    },
  },
  members: {
    title: 'Member Report',
    columns: ['Member ID', 'Name', 'Email', 'Phone', 'Department', 'Type', 'Expiry', 'Issued', 'Returned', 'Pending Fine (₹)', 'Paid (₹)', 'Status'],
    async rows() {
      const list = await Member.find().sort({ memberId: 1 }).lean();
      return list.map((m) => [m.memberId, m.name, m.email, m.phone, m.department, m.membershipType, fmtDate(m.membershipExpiry), m.booksIssued, m.booksReturned, m.pendingFine, m.totalFinePaid, m.status]);
    },
  },
  popular: {
    title: 'Popular Books Report',
    columns: ['Rank', 'Book ID', 'Title', 'Author', 'Category', 'Times Borrowed', 'Available / Total'],
    async rows() {
      const list = await Book.find().sort({ timesBorrowed: -1, title: 1 }).limit(25).lean();
      return list.map((b, i) => [i + 1, b.bookId, b.title, b.authorName, b.categoryName, b.timesBorrowed, `${b.availableCopies} / ${b.quantity}`]);
    },
  },
  shelves: {
    title: 'Shelf Occupancy Report',
    columns: ['Shelf ID', 'Name', 'Floor', 'Section', 'Racks', 'Capacity', 'Occupied', 'Available', 'Occupancy %', 'Status'],
    async rows() {
      await recalcAllShelves();
      const list = await Shelf.find().sort({ floor: 1, code: 1 });
      return list.map((s) => [s.shelfId, s.name, s.floor, s.section, s.racks, s.capacity, s.occupied, s.availableSpace, `${s.occupancyPercent}%`, s.status]);
    },
  },
};

// GET /api/reports — list available report types
exports.listReports = (_req, res) => {
  res.json({ success: true, data: Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title })) });
};

// GET /api/reports/:type?from=&to=
exports.getReport = asyncHandler(async (req, res) => {
  const r = REPORTS[req.params.type];
  if (!r) throw new ApiError(404, 'Unknown report type');
  const rows = await r.rows(req.query);
  res.json({ success: true, data: { key: req.params.type, title: r.title, columns: r.columns, rows, generatedAt: new Date() } });
});
