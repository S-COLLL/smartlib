/**
 * Rule-based "AI" Library Assistant.
 * Parses natural-language questions into structured queries against MongoDB.
 * No external AI API is required.
 */
const Book = require('../models/Book');
const Category = require('../models/Category');
const Issue = require('../models/Issue');
const Fine = require('../models/Fine');
const Member = require('../models/Member');
const Setting = require('../models/Setting');
const { asyncHandler, escapeRegex, daysBetween } = require('../utils/helpers');
const { buildBookFilter } = require('./bookController');
const { isStaff } = require('../middleware/auth');

const BOOK_FIELDS = 'bookId title authorName categoryName price availableCopies quantity location coverImage isbn language timesBorrowed status';
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const sectionLabel = (s = '') => (/section$/i.test(s) ? s : `${s} Section`);
const locationText = (l = {}) =>
  `Floor ${l.floor}, ${sectionLabel(l.section)}, Shelf ${l.shelfCode}, Rack ${l.rack}, Row ${l.row}, Position ${l.position}`;

const CATEGORY_ALIASES = {
  programming: ['programming', 'coding', 'code', 'software', 'developer'],
  science: ['science', 'scientific', 'physics', 'biology', 'astronomy'],
  technology: ['technology', 'tech'],
  engineering: ['engineering', 'engineer'],
  mathematics: ['mathematics', 'math', 'maths'],
  history: ['history', 'historical'],
  biography: ['biography', 'biographies', 'autobiography', 'memoir'],
  business: ['business', 'finance', 'management'],
  entrepreneurship: ['entrepreneurship', 'startup', 'startups', 'entrepreneur'],
  'competitive exams': ['competitive', 'exam', 'exams', 'upsc', 'gate', 'aptitude'],
  reference: ['reference', 'dictionary', 'encyclopedia'],
  fiction: ['fiction', 'novel', 'novels', 'story', 'stories'],
};

const STOP_WORDS = new Set(
  'show me list find get give all any the a an of books book with for please some that are is available which what do you have search looking look i want need on in at by'.split(' ')
);

async function findBookByTitle(term) {
  const clean = term.replace(/[?."'!]/g, '').replace(/^(the book|book)\s+/i, '').trim();
  if (!clean) return [];
  let books = await Book.find({ title: new RegExp(`^${escapeRegex(clean)}$`, 'i') }).select(BOOK_FIELDS).lean();
  if (!books.length) books = await Book.find({ title: new RegExp(escapeRegex(clean), 'i') }).select(BOOK_FIELDS).limit(5).lean();
  if (!books.length) {
    const noArticle = clean.replace(/^(the|a|an)\s+/i, '');
    books = await Book.find({ title: new RegExp(escapeRegex(noArticle), 'i') }).select(BOOK_FIELDS).limit(5).lean();
  }
  if (!books.length) {
    books = await Book.find({ $text: { $search: clean } }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .select(BOOK_FIELDS)
      .limit(3)
      .lean();
  }
  return books;
}

function parsePrice(text) {
  const num = '(?:₹|rs\\.?|inr)?\\s*(\\d+(?:,\\d{3})*(?:\\.\\d+)?)';
  const clean = (s) => Number(s.replace(/,/g, ''));
  let m = text.match(new RegExp(`between\\s+${num}\\s+(?:and|to|-)\\s+${num}`, 'i'));
  if (m) return { minPrice: clean(m[1]), maxPrice: clean(m[2]) };
  m = text.match(new RegExp(`(?:under|below|less than|cheaper than|within|upto|up to|<)\\s*${num}`, 'i'));
  if (m) return { maxPrice: clean(m[1]) };
  m = text.match(new RegExp(`(?:over|above|more than|greater than|>)\\s*${num}`, 'i'));
  if (m) return { minPrice: clean(m[1]) };
  return {};
}

async function parseBookQuery(text) {
  const lower = text.toLowerCase();
  const q = {};
  const understood = [];

  Object.assign(q, parsePrice(lower));
  if (q.maxPrice !== undefined && q.minPrice !== undefined) understood.push(`price ${inr(q.minPrice)}–${inr(q.maxPrice)}`);
  else if (q.maxPrice !== undefined) understood.push(`price under ${inr(q.maxPrice)}`);
  else if (q.minPrice !== undefined) understood.push(`price over ${inr(q.minPrice)}`);

  const categories = await Category.find({}, 'name').lean();
  for (const c of categories) {
    const aliases = CATEGORY_ALIASES[c.name.toLowerCase()] || [c.name.toLowerCase()];
    if (aliases.some((a) => new RegExp(`\\b${escapeRegex(a)}\\b`, 'i').test(lower)) || lower.includes(c.name.toLowerCase())) {
      q.category = c.name;
      understood.push(`category ${c.name}`);
      break;
    }
  }

  const author = text.match(/\b(?:by|author|written by|from author)\s+([a-z][a-z.\s'-]+?)(?=\s+(?:under|below|over|above|on|in|at|between|priced|that|which|with|available)\b|[?.,!]|$)/i);
  if (author) {
    q.author = author[1].trim();
    understood.push(`author "${q.author}"`);
  }

  const floor = lower.match(/\bfloor\s*(\d+)|\b(\d+)(?:st|nd|rd|th)\s+floor/);
  if (floor) {
    q.floor = Number(floor[1] || floor[2]);
    understood.push(`floor ${q.floor}`);
  }
  const shelf = text.match(/\bshelf\s+([a-z]{1,2})\b/i);
  if (shelf) {
    q.shelf = shelf[1].toUpperCase();
    understood.push(`shelf ${q.shelf}`);
  }
  const rack = lower.match(/\brack\s*(\d+)/);
  if (rack) {
    q.rack = rack[1];
    understood.push(`rack ${rack[1].padStart(2, '0')}`);
  }

  const languages = await Book.distinct('language');
  const lang = languages.find((l) => new RegExp(`\\b${escapeRegex(l)}\\b`, 'i').test(lower));
  if (lang) {
    q.language = lang;
    understood.push(`language ${lang}`);
  }

  if (/\b(available|in stock)\b/.test(lower)) {
    q.status = 'available';
    understood.push('available now');
  } else if (/\b(issued|checked out|borrowed)\b/.test(lower)) {
    q.status = 'issued';
    understood.push('currently issued');
  } else if (/\breserved\b/.test(lower)) {
    q.status = 'reserved';
    understood.push('reserved');
  } else if (/\b(lost)\b/.test(lower)) {
    q.status = 'lost';
    understood.push('lost copies');
  } else if (/\b(damaged)\b/.test(lower)) {
    q.status = 'damaged';
    understood.push('damaged copies');
  }

  // Remaining free-text keywords (only if no structured filter was found)
  if (!understood.length) {
    const words = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP_WORDS.has(w));
    if (words.length) {
      q.search = words.join(' ');
      understood.push(`keywords "${q.search}"`);
    }
  }
  return { q, understood };
}

const summariseBooks = (books) => books.map((b) => ({ ...b, locationText: b.location ? locationText(b.location) : '' }));

// POST /api/ai/query  { message }
exports.query = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 300);
  const lower = message.toLowerCase();
  const reply = (payload) => res.json({ success: true, data: { query: message, ...payload } });
  const staff = isStaff(req.user);

  if (!message || /^(hi|hello|hey|help|what can you do|\?)\b/i.test(lower)) {
    return reply({
      intent: 'help',
      reply: "Hi! I'm your SmartLib assistant. I can locate books on the shelf, search by price, author, category, floor or language, list overdue books, show popular titles and summarise library statistics.",
      suggestions: ['Where is The Alchemist?', 'Show science books under ₹500', 'Find available books by Chetan Bhagat', 'Which books are overdue?', 'Show books available on Floor 2', 'Most popular books'],
    });
  }

  // 1. Location of a specific book
  const loc = message.match(/(?:where\s+is|where's|where\s+can\s+i\s+find|locate|location\s+of|which\s+shelf\s+(?:is|has)|find\s+the\s+book)\s+(.+)/i);
  if (loc) {
    const books = await findBookByTitle(loc[1]);
    if (!books.length) {
      return reply({ intent: 'location', reply: `I couldn't find a book matching "${loc[1].replace(/[?]/g, '')}". Try the exact title or search by author.`, books: [] });
    }
    const b = books[0];
    let status;
    if (b.availableCopies > 0) status = `is available (${b.availableCopies} of ${b.quantity} copies) on`;
    else {
      const next = await Issue.findOne({ book: b._id, status: { $in: ['Issued', 'Overdue'] } }).sort({ dueDate: 1 }).lean();
      status = `is currently ${b.status.toLowerCase()}${next ? ` (next expected back ${next.dueDate.toDateString()})` : ''}. Its shelf location is`;
    }
    return reply({
      intent: 'location',
      reply: `${b.title} ${status} ${locationText(b.location)}.`,
      location: b.location,
      books: summariseBooks(books),
    });
  }

  // 2. Overdue books
  if (/\boverdue\b|\blate\b.*\bbooks?\b/.test(lower)) {
    const settings = await Setting.get();
    const filter = { status: 'Overdue' };
    if (!staff || /\bmy\b/.test(lower)) filter.member = req.user.member || null;
    const issues = await Issue.find(filter).sort({ dueDate: 1 }).limit(20).lean();
    const rows = issues.map((i) => {
      const d = daysBetween(i.dueDate, new Date());
      return { ...i, daysOverdue: d, fine: d * settings.finePerDay };
    });
    const total = rows.reduce((s, r) => s + r.fine, 0);
    return reply({
      intent: 'overdue',
      reply: rows.length
        ? `${rows.length} book${rows.length > 1 ? 's are' : ' is'} overdue, with ${inr(total)} in fines accruing at ${inr(settings.finePerDay)}/day.`
        : 'Great news — there are no overdue books right now.',
      issues: rows,
    });
  }

  // 3. My books / my fines (for students or anyone linked to a membership)
  if (/\bmy\s+(books|loans|issued)\b/.test(lower) && req.user.member) {
    const issues = await Issue.find({ member: req.user.member, status: { $in: ['Issued', 'Overdue'] } }).sort({ dueDate: 1 }).lean();
    return reply({
      intent: 'my-books',
      reply: issues.length ? `You have ${issues.length} book(s) issued. The next one is due on ${issues[0].dueDate.toDateString()}.` : "You don't have any books issued right now.",
      issues,
    });
  }
  if (/\b(my\s+)?(fines?|dues|penalt)/.test(lower) && (/\bmy\b/.test(lower) || !staff)) {
    const member = req.user.member ? await Member.findById(req.user.member).lean() : null;
    const fines = member ? await Fine.find({ member: member._id, status: { $in: ['Pending', 'Partially Paid'] } }) : [];
    return reply({
      intent: 'fines',
      reply: member ? (member.pendingFine > 0 ? `You have ${inr(member.pendingFine)} in pending fines across ${fines.length} charge(s).` : 'You have no pending fines. 🎉') : 'Your account is not linked to a membership.',
      fines: fines.map((f) => f.toJSON()),
    });
  }
  if (/\b(pending|outstanding|total)\s+fines?\b|\bfines?\s+(collected|pending|outstanding)/.test(lower) && staff) {
    const [agg] = await Fine.aggregate([{ $group: { _id: null, total: { $sum: '$originalAmount' }, discount: { $sum: '$discount' }, paid: { $sum: '$paidAmount' }, waived: { $sum: '$waivedAmount' } } }]);
    const a = agg || { total: 0, discount: 0, paid: 0, waived: 0 };
    return reply({
      intent: 'stats',
      reply: `Fines generated: ${inr(a.total)}. Collected: ${inr(a.paid)}. Waived/discounted: ${inr(a.waived + a.discount)}. Outstanding: ${inr(a.total - a.paid - a.waived - a.discount)}.`,
    });
  }

  // 4. Statistics
  if (/\bhow many\b|\bstatistic|\bstats\b|\bsummary\b|\btotal books\b/.test(lower) && !/\bby\b/.test(lower)) {
    const [agg] = await Book.aggregate([{ $group: { _id: null, titles: { $sum: 1 }, copies: { $sum: '$quantity' }, available: { $sum: '$availableCopies' }, issued: { $sum: '$issuedCopies' } } }]);
    const [members, overdue] = await Promise.all([Member.countDocuments({ status: 'Active' }), Issue.countDocuments({ status: 'Overdue' })]);
    const a = agg || { titles: 0, copies: 0, available: 0, issued: 0 };
    return reply({
      intent: 'stats',
      reply: `The library has ${a.copies} books (${a.titles} titles): ${a.available} available and ${a.issued} issued. ${members} active members, ${overdue} overdue loans.`,
    });
  }

  // 5. Popular / recommendations / new arrivals
  if (/\b(popular|most borrowed|trending|best|top)\b/.test(lower)) {
    const books = await Book.find().sort({ timesBorrowed: -1 }).limit(8).select(BOOK_FIELDS).lean();
    return reply({ intent: 'books', reply: `Here are the ${books.length} most borrowed books in the library.`, books: summariseBooks(books), filters: { sort: 'popular' } });
  }
  if (/\b(new|latest|recent(ly)?)\b.*\b(books?|arrivals?|added)\b|\bnew arrivals\b/.test(lower)) {
    const books = await Book.find().sort({ createdAt: -1 }).limit(8).select(BOOK_FIELDS).lean();
    return reply({ intent: 'books', reply: 'These are the most recently added books.', books: summariseBooks(books), filters: { sort: 'newest' } });
  }
  if (/\brecommend|suggest/.test(lower)) {
    const books = await Book.find({ availableCopies: { $gt: 0 } }).sort({ timesBorrowed: -1 }).limit(6).select(BOOK_FIELDS).lean();
    return reply({ intent: 'books', reply: 'Based on what readers love right now, I recommend these (all available today):', books: summariseBooks(books) });
  }

  // 6. General book search with filters
  const { q, understood } = await parseBookQuery(message);
  if (!understood.length) {
    return reply({
      intent: 'unknown',
      reply: "I'm not sure what you're looking for. Try asking where a book is, or search by author, category, price or floor.",
      suggestions: ['Where is Wings of Fire?', 'Programming books under ₹800', 'Books by R.K. Narayan', 'Books on Floor 3'],
    });
  }
  const filter = await buildBookFilter(q);
  const [books, total] = await Promise.all([
    Book.find(filter).sort({ availableCopies: -1, timesBorrowed: -1 }).limit(12).select(BOOK_FIELDS).lean(),
    Book.countDocuments(filter),
  ]);
  const text = total
    ? `I found ${total} book${total > 1 ? 's' : ''} matching ${understood.join(', ')}.${total > books.length ? ` Showing the top ${books.length}.` : ''}`
    : `No books match ${understood.join(', ')}. Try widening your search.`;
  return reply({ intent: 'books', reply: text, books: summariseBooks(books), filters: q, total });
});
