/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Author = require('../models/Author');
const Category = require('../models/Category');
const Shelf = require('../models/Shelf');
const Book = require('../models/Book');
const Member = require('../models/Member');
const Issue = require('../models/Issue');
const Return = require('../models/Return');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const Counter = require('../models/Counter');
const { nextId, addDays, daysBetween } = require('../utils/helpers');
const { recalcBook, recalcAllShelves, syncMember, refreshQueuePositions, runMaintenance } = require('../utils/library');
const D = require('./data');

const ago = (days, hour = 11) => {
  const d = addDays(new Date(), -days);
  d.setHours(hour, 15, 0, 0);
  return d;
};
// Bypass Mongoose's immutable createdAt to backdate records
const backdate = (Model, id, date) => Model.collection.updateOne({ _id: id }, { $set: { createdAt: date, updatedAt: date } });

async function seedDatabase({ silent = false } = {}) {
  const log = (...a) => !silent && console.log(...a);
  await Promise.all(
    [User, Author, Category, Shelf, Book, Member, Issue, Return, Reservation, Fine, Payment, Notification, Setting, Counter].map((M) => M.deleteMany({}))
  );
  await Promise.all([Book, Member, Issue, Fine, Payment].map((M) => M.syncIndexes()));
  const settings = await Setting.create({ key: 'library', libraryName: 'SmartLib Central Library' });

  /* Staff accounts */
  const [admin, librarian] = await User.create([
    { name: 'Admin User', email: 'admin@smartlib.com', password: 'Admin@123', role: 'admin' },
    { name: 'Lakshmi Menon', email: 'librarian@smartlib.com', password: 'Librarian@123', role: 'librarian' },
    { name: 'Ravi Staff', email: 'staff@smartlib.com', password: 'Staff@123', role: 'staff' },
  ]);
  log('✓ Staff users');

  /* Categories & authors */
  const cats = {};
  for (const c of D.categories) cats[c.name] = await Category.create({ ...c, categoryId: await nextId('category', 'CAT', 3) });
  const auths = {};
  for (const a of D.authors) auths[a.name] = await Author.create({ ...a, authorId: await nextId('author', 'AUT', 3) });
  log(`✓ ${D.categories.length} categories, ${D.authors.length} authors`);

  /* Shelves */
  const shelves = {};
  for (const [code, floor, section, racks, rowsPerRack, capacity, cat] of D.shelves) {
    shelves[code] = await Shelf.create({ code, floor, section, racks, rowsPerRack, capacity, category: cats[cat]._id });
  }
  log(`✓ ${D.shelves.length} shelves`);

  /* Books with exact physical locations */
  const books = {};
  const perShelf = {};
  for (const [title, author, isbn, publisher, year, category, subcategory, price, pages, language, quantity, shelfCode, edition, description, popularity] of D.books) {
    const shelf = shelves[shelfCode];
    const i = (perShelf[shelfCode] = (perShelf[shelfCode] ?? -1) + 1);
    let location = {
      shelf: shelf._id,
      shelfCode,
      floor: shelf.floor,
      section: shelf.section,
      rack: String((i % shelf.racks) + 1).padStart(2, '0'),
      row: String.fromCharCode(65 + (Math.floor(i / shelf.racks) % shelf.rowsPerRack)),
      position: String(((i * 5) % 18) + 2).padStart(2, '0'),
    };
    if (title === 'The Alchemist') location = { ...location, rack: '03', row: 'B', position: '07' };
    const purchasePrice = Math.round(price * 0.8);
    const book = await Book.create({
      bookId: await nextId('book', 'BK'),
      title,
      isbn,
      author: auths[author]._id,
      authorName: author,
      publisher,
      publicationDate: new Date(year, 0, 15),
      edition,
      language,
      category: cats[category]._id,
      categoryName: category,
      subcategory,
      description,
      pages,
      price,
      purchasePrice,
      currentValue: Math.round(price * 0.9),
      quantity,
      availableCopies: quantity,
      timesBorrowed: popularity,
      location,
      addedBy: admin._id,
    });
    const recent = D.recentlyAdded.includes(title);
    await backdate(Book, book._id, recent ? ago(3 + D.recentlyAdded.indexOf(title) * 5) : ago(200 + (Object.keys(books).length * 7) % 180));
    books[title] = book;
  }
  log(`✓ ${D.books.length} books`);

  /* Members (+ student login linked to the first member) */
  const members = [];
  for (const [name, email, phone, department, course, year, membershipType, startAgo, expiryIn, status] of D.members) {
    const m = await Member.create({
      memberId: await nextId('member', 'MEM'),
      name,
      email,
      phone,
      department,
      course,
      year,
      membershipType,
      membershipStart: ago(startAgo),
      membershipExpiry: addDays(new Date(), expiryIn),
      status,
    });
    await backdate(Member, m._id, ago(startAgo));
    members.push(m);
  }
  const student = await User.create({ name: members[0].name, email: members[0].email, password: 'Student@123', role: 'student', member: members[0]._id });
  members[0].user = student._id;
  await members[0].save();
  log(`✓ ${members.length} members`);

  /* Issues, returns and fines */
  const fineIndex = {};
  let issueCount = 0;
  for (const [mi, title, issuedAgo, returnedAgo, cond = 'Good'] of D.issues) {
    const member = members[mi];
    const book = books[title];
    const issueDate = ago(issuedAgo, 10);
    const dueDate = addDays(issueDate, settings.loanDays);
    dueDate.setHours(23, 59, 0, 0);
    const returned = returnedAgo !== null && returnedAgo !== undefined;
    const returnDate = returned ? ago(returnedAgo, 16) : undefined;
    const issue = await Issue.create({
      transactionId: await nextId('issue', 'TXN', 5),
      member: member._id,
      book: book._id,
      memberCode: member.memberId,
      memberName: member.name,
      bookCode: book.bookId,
      bookTitle: book.title,
      issueDate,
      dueDate,
      returnDate,
      staff: librarian._id,
      staffName: librarian.name,
      status: returned ? (cond === 'Good' ? 'Returned' : cond) : 'Issued',
      dueSoonNotified: returned,
      overdueNotified: returned,
    });
    await backdate(Issue, issue._id, issueDate);
    issueCount += 1;
    if (!returned) continue;

    const daysOverdue = daysBetween(dueDate, returnDate);
    const lateFine = daysOverdue * settings.finePerDay;
    const damageCharge = cond === 'Damaged' ? Math.round((book.price * settings.damageChargePercent) / 100) : 0;
    const lostCharge = cond === 'Lost' ? book.price + settings.lostProcessingFee : 0;
    issue.fineAmount = lateFine + damageCharge + lostCharge;
    await issue.save();
    if (cond === 'Lost') await Book.updateOne({ _id: book._id }, { $inc: { lostCopies: 1 } });
    if (cond === 'Damaged') await Book.updateOne({ _id: book._id }, { $inc: { damagedCopies: 1 } });

    await Return.create({
      returnId: await nextId('return', 'RET', 5),
      issue: issue._id,
      member: member._id,
      book: book._id,
      transactionId: issue.transactionId,
      issueDate,
      dueDate,
      returnDate,
      daysOverdue,
      condition: cond,
      lateFine,
      damageCharge,
      lostCharge,
      totalFine: issue.fineAmount,
      processedBy: librarian._id,
    });

    const base = { member: member._id, issue: issue._id, book: book._id, transactionId: issue.transactionId };
    const fines = [];
    if (lateFine) fines.push({ ...base, type: 'Late Fine', daysOverdue, ratePerDay: settings.finePerDay, originalAmount: lateFine, description: `${daysOverdue} day(s) late × ₹${settings.finePerDay}/day` });
    if (damageCharge) fines.push({ ...base, type: 'Damage', originalAmount: damageCharge, description: `Damage charge for "${book.title}"` });
    if (lostCharge) fines.push({ ...base, type: 'Lost Book', originalAmount: lostCharge, description: `Replacement ₹${book.price} + processing ₹${settings.lostProcessingFee}` });
    for (const f of fines) {
      const fine = await Fine.create({ ...f, fineId: await nextId('fine', 'FIN', 5) });
      await backdate(Fine, fine._id, returnDate);
      fineIndex[`${mi}|${title}|${f.type}`] = { fine, returnDate };
    }
  }
  log(`✓ ${issueCount} issue records`);

  /* Fine settlements → payments */
  let paymentCount = 0;
  for (const [key, action] of Object.entries(D.fineSettlements)) {
    const entry = fineIndex[key];
    if (!entry) continue;
    const { fine, returnDate } = entry;
    if (action.discount) fine.discount = action.discount;
    if (action.pay) {
      const [amount, method, after] = action.pay;
      fine.paidAmount = amount;
      fine.refreshStatus();
      await fine.save();
      await Payment.create({
        paymentId: await nextId('payment', 'PAY', 5),
        receiptNo: await nextId('receipt', 'RCPT-', 6),
        member: fine.member,
        fine: fine._id,
        transactionId: fine.transactionId,
        reason: `${fine.type} — ${fine.description}`,
        amount,
        date: addDays(returnDate, after),
        method,
        status: fine.status === 'Paid' ? 'Paid' : 'Partially Paid',
        reference: `${method === 'UPI' ? 'UPI' : method === 'Card' ? 'AUTH-' : method === 'Cash' ? 'CASH-' : 'NEFT'}${String(100000 + paymentCount * 7919).slice(0, 6)}`,
        collectedBy: librarian._id,
        collectedByName: librarian.name,
      });
      paymentCount += 1;
    }
    if (action.waive) {
      const remaining = fine.remainingAmount;
      fine.waivedAmount = remaining;
      fine.refreshStatus();
      await fine.save();
      await Payment.create({
        paymentId: await nextId('payment', 'PAY', 5),
        member: fine.member,
        fine: fine._id,
        transactionId: fine.transactionId,
        reason: `${fine.type} waived — ${action.waive}`,
        amount: remaining,
        date: addDays(returnDate, 1),
        method: 'Cash',
        status: 'Waived',
        notes: action.waive,
        collectedBy: admin._id,
        collectedByName: admin.name,
      });
      paymentCount += 1;
    }
    if (!action.pay && !action.waive) await fine.save();
  }
  for (const [mi, amount, method, daysAgo, status] of D.membershipPayments) {
    await Payment.create({
      paymentId: await nextId('payment', 'PAY', 5),
      receiptNo: status === 'Pending' ? undefined : await nextId('receipt', 'RCPT-', 6),
      member: members[mi]._id,
      reason: status === 'Pending' ? 'Membership Renewal (12 months)' : 'Membership Fee',
      amount,
      date: ago(daysAgo, 12),
      method,
      status,
      reference: `${method === 'UPI' ? 'UPI' : method === 'Card' ? 'AUTH-' : method === 'Cash' ? 'CASH-' : 'NEFT'}${String(200000 + paymentCount * 104729).slice(0, 6)}`,
      collectedBy: librarian._id,
      collectedByName: librarian.name,
    });
    paymentCount += 1;
  }
  log(`✓ ${Object.keys(fineIndex).length} fines, ${paymentCount} payments`);

  /* Reservations */
  for (const [mi, title, daysAgo, status] of D.reservations) {
    const reservationDate = ago(daysAgo, 13);
    const r = {
      reservationId: await nextId('reservation', 'RES', 5),
      member: members[mi]._id,
      book: books[title]._id,
      reservationDate,
      status,
      expiryDate: addDays(reservationDate, settings.reservationValidityDays),
      createdBy: librarian._id,
    };
    if (status === 'Available') {
      r.availableSince = ago(1, 9);
      r.expiryDate = addDays(r.availableSince, settings.reservationHoldDays);
    }
    if (status === 'Expired') r.expiryDate = addDays(reservationDate, settings.reservationValidityDays);
    await Reservation.create(r);
  }
  log(`✓ ${D.reservations.length} reservations`);

  /* Derived counters */
  for (const b of Object.values(books)) await recalcBook(b._id);
  for (const b of Object.values(books)) await refreshQueuePositions(b._id);
  await recalcAllShelves();

  /* Notifications (maintenance adds overdue / due-soon / expiry alerts) */
  const n = [
    { audience: 'all', type: 'new-book', title: 'New books added', message: 'Life 3.0 and AI Superpowers are now on Floor 1, Technology Section.', link: 'books.html?sort=newest', days: 3 },
    { audience: 'all', type: 'new-book', title: 'New book added', message: '"The God of Small Things" by Arundhati Roy is now in Fiction — Floor 1, Shelf B.', link: 'books.html?sort=newest', days: 23 },
    { audience: 'member', member: 0, type: 'issued', title: 'Book issued', message: '"The Alchemist" has been issued to you. Please return it within 14 days.', link: 'issues.html', days: 5 },
    { audience: 'member', member: 0, type: 'issued', title: 'Book issued', message: '"Clean Code" has been issued to you. Please return it within 14 days.', link: 'issues.html', days: 10 },
    { audience: 'member', member: 4, type: 'reservation', title: 'Reserved book is ready', message: '"Sapiens" is available for pickup at the issue desk.', link: 'reservations.html', days: 1 },
    { audience: 'staff', type: 'reservation', title: 'Reservation ready for pickup', message: 'Vikram Singh can now collect "Sapiens".', link: 'reservations.html', days: 1 },
    { audience: 'member', member: 3, type: 'fine', title: 'Fine generated', message: 'A late fine of ₹70 was generated for "The Alchemist".', link: 'fines.html', days: 9 },
    { audience: 'staff', type: 'payment', title: 'Payment completed', message: 'Meera Krishnan paid ₹750 via Bank Transfer — Membership Fee.', link: 'payments.html', days: 20 },
    { audience: 'staff', type: 'payment', title: 'Payment pending', message: 'Neha Kapoor initiated a ₹500 bank transfer for membership renewal — confirm on receipt.', link: 'payments.html', days: 1 },
    { audience: 'staff', type: 'returned', title: 'Book reported lost', message: 'Dr. Sunita Rao reported "Half Girlfriend" as lost. Charge: ₹226.', link: 'fines.html', days: 45 },
    { audience: 'all', type: 'system', title: 'Welcome to SmartLib', message: 'Try the AI Assistant — ask "Where is The Alchemist?"', link: 'ai-assistant.html', days: 30 },
  ];
  for (const x of n) {
    const doc = await Notification.create({ audience: x.audience, member: x.member !== undefined ? members[x.member]._id : undefined, type: x.type, title: x.title, message: x.message, link: x.link });
    await backdate(Notification, doc._id, ago(x.days, 9 + (x.days % 8)));
  }
  await runMaintenance();
  for (const m of members) await syncMember(m._id);
  log(`✓ Notifications (${await Notification.countDocuments()})`);
  log('\nDemo logins:\n  admin@smartlib.com / Admin@123\n  librarian@smartlib.com / Librarian@123\n  staff@smartlib.com / Staff@123\n  student@smartlib.com / Student@123');
}

if (require.main === module) {
  connectDB()
    .then(() => seedDatabase())
    .then(() => {
      console.log('\n✓ Database seeded successfully');
      return mongoose.disconnect();
    })
    .catch((err) => {
      console.error('✗ Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
