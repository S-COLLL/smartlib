const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');
const Category = require('../models/Category');
const Shelf = require('../models/Shelf');
const Issue = require('../models/Issue');
const Reservation = require('../models/Reservation');
const Member = require('../models/Member');
const { ApiError, asyncHandler, nextId, escapeRegex, paginate, pick } = require('../utils/helpers');
const { findBook, findShelf } = require('../utils/lookup');
const { recalcBook, recalcShelf, notify, processReservationQueue, ACTIVE_ISSUE } = require('../utils/library');

const EDITABLE = [
  'title', 'isbn', 'publisher', 'publicationDate', 'edition', 'language', 'subcategory', 'description',
  'coverImage', 'pages', 'price', 'purchasePrice', 'currentValue', 'quantity', 'lostCopies', 'damagedCopies',
];

const SORTS = {
  az: { title: 1 },
  za: { title: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { timesBorrowed: -1, title: 1 },
};

/** Build a Mongo filter from query-string parameters. Shared with the AI assistant and reports. */
async function buildBookFilter(q = {}) {
  const filter = {};
  const and = [];
  if (q.search) {
    const term = String(q.search).trim();
    const rx = new RegExp(escapeRegex(term), 'i');
    const or = [
      { title: rx }, { isbn: rx }, { authorName: rx }, { publisher: rx }, { categoryName: rx },
      { bookId: rx }, { language: rx }, { subcategory: rx },
      { 'location.section': rx },
    ];
    const shelfMatch = term.match(/^(?:shelf\s*|sh-)?([a-z]{1,2})$/i);
    if (shelfMatch) or.push({ 'location.shelfCode': shelfMatch[1].toUpperCase() });
    const rackMatch = term.match(/^rack\s*(\d+)$/i);
    if (rackMatch) or.push({ 'location.rack': rackMatch[1].padStart(2, '0') });
    and.push({ $or: or });
  }
  if (q.category) {
    if (mongoose.isValidObjectId(q.category)) filter.category = q.category;
    else filter.categoryName = new RegExp(`^${escapeRegex(q.category)}$`, 'i');
  }
  if (q.author) {
    if (mongoose.isValidObjectId(q.author)) filter.author = q.author;
    else filter.authorName = new RegExp(escapeRegex(q.author), 'i');
  }
  if (q.language) filter.language = new RegExp(`^${escapeRegex(q.language)}$`, 'i');
  if (q.floor) filter['location.floor'] = Number(q.floor);
  if (q.shelf) {
    if (mongoose.isValidObjectId(q.shelf)) filter['location.shelf'] = q.shelf;
    else filter['location.shelfCode'] = String(q.shelf).toUpperCase().replace(/^SH-/, '');
  }
  if (q.rack) filter['location.rack'] = String(q.rack).padStart(2, '0');
  if (q.minPrice || q.maxPrice) {
    filter.price = {};
    if (q.minPrice) filter.price.$gte = Number(q.minPrice);
    if (q.maxPrice) filter.price.$lte = Number(q.maxPrice);
  }
  if (q.addedSince) filter.createdAt = { $gte: new Date(q.addedSince) };

  switch (String(q.status || '').toLowerCase()) {
    case 'available': filter.availableCopies = { $gt: 0 }; break;
    case 'issued': filter.issuedCopies = { $gt: 0 }; break;
    case 'reserved': {
      const waiting = await Reservation.distinct('book', { status: { $in: ['Waiting', 'Available'] } });
      and.push({ $or: [{ reservedCopies: { $gt: 0 } }, { _id: { $in: waiting } }] });
      break;
    }
    case 'overdue': filter._id = { $in: await Issue.distinct('book', { status: 'Overdue' }) }; break;
    case 'lost': filter.lostCopies = { $gt: 0 }; break;
    case 'damaged': filter.damagedCopies = { $gt: 0 }; break;
    case 'unavailable': filter.availableCopies = 0; break;
    default: break;
  }
  if (and.length) filter.$and = and;
  return filter;
}

// GET /api/books
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req, 12, 500);
  const filter = await buildBookFilter(req.query);
  const sort = SORTS[req.query.sort] || SORTS.newest;
  const [data, total] = await Promise.all([
    Book.find(filter).sort(sort).skip(skip).limit(limit).populate('location.shelf', 'shelfId name code').lean(),
    Book.countDocuments(filter),
  ]);
  const overdueIds = new Set((await Issue.distinct('book', { status: 'Overdue', book: { $in: data.map((b) => b._id) } })).map(String));
  data.forEach((b) => {
    b.hasOverdue = overdueIds.has(String(b._id));
  });
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

// GET /api/books/meta — values for filter dropdowns
exports.meta = asyncHandler(async (_req, res) => {
  const [languages, publishers, categories, floors] = await Promise.all([
    Book.distinct('language'),
    Book.distinct('publisher'),
    Category.find({}, 'name').sort({ name: 1 }),
    Shelf.distinct('floor'),
  ]);
  res.json({ success: true, data: { languages: languages.sort(), publishers: publishers.filter(Boolean).sort(), categories, floors: floors.sort() } });
});

// GET /api/books/:id  (Mongo id or BK code or ISBN)
exports.get = asyncHandler(async (req, res) => {
  const ref = req.params.id;
  let book = null;
  if (mongoose.isValidObjectId(ref) && ref.length === 24) book = await Book.findById(ref);
  if (!book) book = await Book.findOne({ $or: [{ bookId: ref.toUpperCase() }, { isbn: ref }] });
  if (!book) throw new ApiError(404, 'Book not found');
  await book.populate([
    { path: 'author' },
    { path: 'category', select: 'name icon categoryId' },
    { path: 'location.shelf' },
  ]);
  const [activeIssues, queue, similar] = await Promise.all([
    Issue.find({ book: book._id, status: { $in: ACTIVE_ISSUE } }).sort({ dueDate: 1 }).lean(),
    Reservation.find({ book: book._id, status: { $in: ['Waiting', 'Available'] } })
      .sort({ status: 1, reservationDate: 1 })
      .populate('member', 'memberId name')
      .lean(),
    Book.find({ _id: { $ne: book._id }, $or: [{ category: book.category._id }, { author: book.author._id }] })
      .sort({ timesBorrowed: -1 })
      .limit(6)
      .lean(),
  ]);
  const nextDue = activeIssues[0]?.dueDate || null;
  // Students only see their own borrowing details
  const isStaff = req.user.role !== 'student';
  const myMember = req.user.member ? String(req.user.member) : null;
  const issues = isStaff ? activeIssues : activeIssues.filter((i) => String(i.member) === myMember);
  res.json({
    success: true,
    data: book,
    activeIssues: issues,
    nextDue,
    reservations: isStaff ? queue : queue.filter((r) => String(r.member?._id) === myMember),
    queueLength: queue.filter((r) => r.status === 'Waiting').length,
    similar,
  });
});

async function resolveAuthor(body) {
  if (body.author && mongoose.isValidObjectId(body.author)) {
    const a = await Author.findById(body.author);
    if (!a) throw new ApiError(400, 'Selected author does not exist');
    return a;
  }
  const name = String(body.authorName || body.author || '').trim();
  if (!name) throw new ApiError(400, 'Author is required');
  let a = await Author.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (!a) a = await Author.create({ authorId: await nextId('author', 'AUT', 3), name });
  return a;
}

async function resolveCategory(body) {
  const ref = body.category || body.categoryName;
  if (!ref) throw new ApiError(400, 'Category is required');
  const c = mongoose.isValidObjectId(ref) ? await Category.findById(ref) : await Category.findOne({ name: new RegExp(`^${escapeRegex(ref)}$`, 'i') });
  if (!c) throw new ApiError(400, 'Selected category does not exist');
  return c;
}

async function applyLocation(book, loc = {}) {
  if (!loc || !loc.shelf) throw new ApiError(400, 'Shelf location is required');
  const shelf = await findShelf(loc.shelf);
  const rack = String(loc.rack || '').trim();
  const row = String(loc.row || '').trim().toUpperCase();
  const position = String(loc.position || '').trim();
  if (!rack || !row || !position) throw new ApiError(400, 'Rack, row and position are required');
  if (!/^\d{1,3}$/.test(rack) || Number(rack) < 1 || Number(rack) > shelf.racks) throw new ApiError(400, `Rack must be between 1 and ${shelf.racks} for ${shelf.name}`);
  if (!/^[A-Z]$/.test(row) || row.charCodeAt(0) - 64 > shelf.rowsPerRack) throw new ApiError(400, `Row must be between A and ${String.fromCharCode(64 + shelf.rowsPerRack)} for ${shelf.name}`);
  if (!/^\d{1,3}$/.test(position) || Number(position) < 1) throw new ApiError(400, 'Position must be a positive number');
  book.location = {
    shelf: shelf._id,
    shelfCode: shelf.code,
    floor: shelf.floor,
    section: shelf.section,
    rack: rack.padStart(2, '0'),
    row,
    position: position.padStart(2, '0'),
  };
  return shelf;
}

async function assertShelfSpace(shelf, extra, excludeBookId) {
  const [agg] = await Book.aggregate([
    { $match: { 'location.shelf': shelf._id, ...(excludeBookId ? { _id: { $ne: excludeBookId } } : {}) } },
    { $group: { _id: null, total: { $sum: { $subtract: ['$quantity', '$lostCopies'] } } } },
  ]);
  const used = agg ? agg.total : 0;
  if (used + extra > shelf.capacity) {
    throw new ApiError(400, `${shelf.name} has only ${Math.max(0, shelf.capacity - used)} free slots (needs ${extra})`);
  }
}

// POST /api/books
exports.create = asyncHandler(async (req, res) => {
  const body = req.body;
  const [author, category] = await Promise.all([resolveAuthor(body), resolveCategory(body)]);
  const book = new Book({
    ...pick(body, EDITABLE),
    bookId: await nextId('book', 'BK'),
    author: author._id,
    authorName: author.name,
    category: category._id,
    categoryName: category.name,
    addedBy: req.user._id,
  });
  if (!book.currentValue) book.currentValue = book.price;
  const shelf = await applyLocation(book, body.location);
  await assertShelfSpace(shelf, Number(book.quantity) - (book.lostCopies || 0));
  await book.validate();
  book.availableCopies = book.quantity - (book.lostCopies || 0) - (book.damagedCopies || 0);
  await book.save();
  await recalcBook(book._id);
  await recalcShelf(shelf._id);
  await notify({
    audience: 'all',
    type: 'new-book',
    title: 'New book added',
    message: `"${book.title}" by ${author.name} is now in ${category.name} — Floor ${book.location.floor}, Shelf ${book.location.shelfCode}.`,
    link: `book-details.html?id=${book.bookId}`,
  });
  res.status(201).json({ success: true, data: await Book.findById(book._id).populate('location.shelf', 'shelfId name code') });
});

// PUT /api/books/:id
exports.update = asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  const body = req.body;
  const oldShelf = book.location?.shelf;
  Object.assign(book, pick(body, EDITABLE));
  if (body.author || body.authorName) {
    const a = await resolveAuthor(body);
    book.author = a._id;
    book.authorName = a.name;
  }
  if (body.category || body.categoryName) {
    const c = await resolveCategory(body);
    book.category = c._id;
    book.categoryName = c.name;
  }
  let shelf = null;
  if (body.location) shelf = await applyLocation(book, body.location);
  const active = await Issue.countDocuments({ book: book._id, status: { $in: ACTIVE_ISSUE } });
  if (book.quantity < active + book.lostCopies + book.damagedCopies) {
    throw new ApiError(400, `Quantity cannot be lower than issued (${active}) + lost + damaged copies`);
  }
  if (shelf) await assertShelfSpace(shelf, book.quantity - book.lostCopies, book._id);
  await book.save();
  const updated = await processReservationQueue(book._id);
  await recalcShelf(book.location.shelf);
  if (oldShelf && String(oldShelf) !== String(book.location.shelf)) await recalcShelf(oldShelf);
  res.json({ success: true, data: updated });
});

// PATCH /api/books/:id/location — move a book to another shelf
exports.move = asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  const oldShelf = book.location?.shelf;
  const shelf = await applyLocation(book, req.body);
  if (String(oldShelf) !== String(shelf._id)) await assertShelfSpace(shelf, book.quantity - book.lostCopies, book._id);
  await book.save();
  await recalcShelf(shelf._id);
  if (oldShelf && String(oldShelf) !== String(shelf._id)) await recalcShelf(oldShelf);
  await notify({
    type: 'system',
    title: 'Book moved',
    message: `"${book.title}" moved to Floor ${book.location.floor}, ${book.location.section}, Shelf ${book.location.shelfCode}, Rack ${book.location.rack}, Row ${book.location.row}, Position ${book.location.position}.`,
    link: `book-details.html?id=${book.bookId}`,
  });
  res.json({ success: true, data: book });
});

async function deleteOne(book) {
  const active = await Issue.countDocuments({ book: book._id, status: { $in: ACTIVE_ISSUE } });
  if (active) throw new ApiError(400, `"${book.title}" has ${active} copy(s) currently issued and cannot be deleted`);
  await Reservation.updateMany({ book: book._id, status: { $in: ['Waiting', 'Available'] } }, { status: 'Cancelled' });
  await book.deleteOne();
  await recalcShelf(book.location?.shelf);
}

// DELETE /api/books/:id
exports.remove = asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  await deleteOne(book);
  res.json({ success: true, message: 'Book deleted' });
});

// POST /api/books/bulk  { action: 'delete'|'move'|'category', ids: [], shelf, category }
exports.bulk = asyncHandler(async (req, res) => {
  const { action, ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw new ApiError(400, 'Select at least one book');
  const books = await Book.find({ _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) } });
  const results = { ok: 0, failed: [] };
  if (action === 'delete') {
    for (const b of books) {
      try {
        await deleteOne(b);
        results.ok += 1;
      } catch (e) {
        results.failed.push({ id: b.bookId, reason: e.message });
      }
    }
  } else if (action === 'category') {
    const c = await resolveCategory(req.body);
    const r = await Book.updateMany({ _id: { $in: books.map((b) => b._id) } }, { category: c._id, categoryName: c.name });
    results.ok = r.modifiedCount;
  } else if (action === 'move') {
    const shelf = await findShelf(req.body.shelf);
    const needed = books.filter((b) => String(b.location?.shelf) !== String(shelf._id)).reduce((s, b) => s + b.quantity - b.lostCopies, 0);
    await assertShelfSpace(shelf, needed);
    const oldShelves = new Set();
    for (const b of books) {
      if (b.location?.shelf) oldShelves.add(String(b.location.shelf));
      b.location = { ...b.location, shelf: shelf._id, shelfCode: shelf.code, floor: shelf.floor, section: shelf.section };
      await b.save();
      results.ok += 1;
    }
    oldShelves.add(String(shelf._id));
    for (const s of oldShelves) await recalcShelf(s);
  } else {
    throw new ApiError(400, 'Unknown bulk action');
  }
  res.json({ success: true, data: results, message: `${results.ok} book(s) updated${results.failed.length ? `, ${results.failed.length} skipped` : ''}` });
});

// GET /api/books/recommendations?member=MEM0001
exports.recommendations = asyncHandler(async (req, res) => {
  let memberId = req.user.member;
  if (req.user.role !== 'student' && req.query.member) {
    const m = await Member.findOne(mongoose.isValidObjectId(req.query.member) ? { _id: req.query.member } : { memberId: req.query.member.toUpperCase() });
    memberId = m?._id;
  }
  const history = memberId ? await Issue.find({ member: memberId }).populate('book', 'category author categoryName authorName').lean() : [];
  const readIds = new Set(history.map((h) => String(h.book?._id)));
  const catScore = {};
  const authScore = {};
  history.forEach((h) => {
    if (!h.book) return;
    catScore[h.book.category] = (catScore[h.book.category] || 0) + 1;
    authScore[h.book.author] = (authScore[h.book.author] || 0) + 1;
  });
  const terms = (req.user.searchHistory || []).slice(0, 5);
  const termRx = terms.map((t) => new RegExp(escapeRegex(t), 'i'));

  const candidates = await Book.find({ _id: { $nin: [...readIds] } }).lean();
  const maxBorrow = Math.max(1, ...candidates.map((b) => b.timesBorrowed));
  const scored = candidates.map((b) => {
    let score = (b.timesBorrowed / maxBorrow) * 2;
    const reasons = [];
    if (catScore[b.category]) {
      score += catScore[b.category] * 2;
      reasons.push(`Because you read ${b.categoryName}`);
    }
    if (authScore[b.author]) {
      score += authScore[b.author] * 3;
      reasons.push(`More by ${b.authorName}`);
    }
    if (termRx.some((rx) => rx.test(b.title) || rx.test(b.authorName) || rx.test(b.categoryName))) {
      score += 2.5;
      reasons.push('Matches your searches');
    }
    if (b.availableCopies > 0) score += 0.5;
    if (!reasons.length) reasons.push(b.timesBorrowed > maxBorrow / 2 ? 'Popular in the library' : 'Trending pick');
    return { ...b, score, reason: reasons[0] };
  });
  scored.sort((a, b) => b.score - a.score);
  res.json({ success: true, data: scored.slice(0, Number(req.query.limit) || 8), basedOn: { borrowed: history.length, searches: terms } });
});

exports.buildBookFilter = buildBookFilter;
