const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { calculateFine } = require('../utils/fineCalculator');
const { paginate, formatDate } = require('../utils/helpers');

const router = express.Router();

const LOAN_SELECT_FIELDS = `
  l.id,
  l.book_id,
  l.member_id,
  l.issue_date,
  l.due_date,
  l.return_date,
  l.status,
  l.created_at,
  l.updated_at,
  b.title AS book_title,
  b.isbn AS book_isbn,
  b.cover_image AS book_cover,
  b.author AS book_author,
  m.name AS member_name,
  m.membership_number,
  m.email AS member_email,
  m.phone AS member_phone
`;

/**
 * GET /overdue - List overdue loans (admin/librarian)
 */
router.get('/overdue', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ${LOAN_SELECT_FIELDS},
        DATEDIFF(CURDATE(), l.due_date) AS days_overdue
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
      WHERE l.status IN ('issued', 'overdue') AND l.due_date < CURDATE()
      ORDER BY l.due_date ASC
    `);

    const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 2;
    const loansWithFines = rows.map((loan) => ({
      ...loan,
      days_overdue: Math.max(0, parseInt(loan.days_overdue, 10) || 0),
      accrued_fine: calculateFine(loan.due_date, new Date()),
    }));

    return res.json({
      success: true,
      data: loansWithFines,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats - Loan statistics (admin/librarian)
 */
router.get('/stats', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_loans,
        COALESCE(SUM(status = 'issued'), 0) AS active_loans,
        COALESCE(SUM(status = 'returned'), 0) AS returned_loans,
        COALESCE(SUM(status IN ('issued', 'overdue') AND due_date < CURDATE()), 0) AS overdue_loans
      FROM loans
    `);

    return res.json({
      success: true,
      data: {
        totalLoans: Number(rows[0].total_loans),
        activeLoans: Number(rows[0].active_loans),
        returnedLoans: Number(rows[0].returned_loans),
        overdueLoans: Number(rows[0].overdue_loans),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /my - Get current user's loans
 */
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    let memberId = req.user.memberId;
    if (!memberId) {
      const [members] = await pool.query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
      if (members.length === 0) {
        return res.json({ success: true, data: [] });
      }
      memberId = members[0].id;
    }

    const { status, page, limit } = req.query;
    const { offset, limit: pageLimit, page: currentPage } = paginate(page, limit || 15);

    const conditions = ['l.member_id = ?'];
    const params = [memberId];

    if (status) {
      if (status === 'active') {
        conditions.push("l.status IN ('issued', 'overdue')");
      } else {
        conditions.push('l.status = ?');
        params.push(status);
      }
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM loans l WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${LOAN_SELECT_FIELDS}
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE ${whereClause}
       ORDER BY l.issue_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    const data = rows.map((l) => ({
      ...l,
      estimated_fine: l.status !== 'returned' ? calculateFine(l.due_date, new Date()) : 0,
    }));

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET / - List loans with filters (admin/librarian) or own loans (member)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const { search, status, member_id, book_id, overdue, page, limit } = req.query;
    const { offset, limit: pageLimit, page: currentPage } = paginate(page, limit || 15);

    const conditions = ['1=1'];
    const params = [];

    if (!isStaff) {
      let memberId = req.user.memberId;
      if (!memberId) {
        const [members] = await pool.query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
        if (members.length === 0) {
          return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: pageLimit, totalPages: 1 } });
        }
        memberId = members[0].id;
      }
      conditions.push('l.member_id = ?');
      params.push(memberId);
    } else {
      if (member_id) {
        conditions.push('l.member_id = ?');
        params.push(parseInt(member_id, 10));
      }
    }

    if (book_id) {
      conditions.push('l.book_id = ?');
      params.push(parseInt(book_id, 10));
    }

    if (status) {
      if (status === 'active') {
        conditions.push("l.status IN ('issued', 'overdue')");
      } else {
        conditions.push('l.status = ?');
        params.push(status);
      }
    }

    if (overdue === 'true' || overdue === '1') {
      conditions.push("l.status IN ('issued', 'overdue') AND l.due_date < CURDATE()");
    }

    if (search) {
      const term = `%${search.trim()}%`;
      conditions.push('(b.title LIKE ? OR b.isbn LIKE ? OR m.name LIKE ? OR m.membership_number LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${LOAN_SELECT_FIELDS}
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE ${whereClause}
       ORDER BY l.issue_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    const data = rows.map((l) => ({
      ...l,
      estimated_fine: l.status !== 'returned' ? calculateFine(l.due_date, new Date()) : 0,
    }));

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /issue - Issue book to member (admin/librarian)
 * Business rules:
 * - Check member exists and is active
 * - Check member has no unpaid fines
 * - Check member has fewer than MAX_ACTIVE_LOANS active loans
 * - Check book exists and available_copies > 0
 * - Decrement available_copies
 * - Set due_date = issue_date + LOAN_PERIOD_DAYS
 * - Create notification
 * - Log activity
 */
router.post('/issue', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const bookId = req.body.book_id || req.body.bookId;
    const memberId = req.body.member_id || req.body.memberId;
    const loanDays = parseInt(req.body.loan_period_days || req.body.loanDays || process.env.LOAN_PERIOD_DAYS, 10) || 14;
    const maxActiveLoans = parseInt(process.env.MAX_ACTIVE_LOANS, 10) || 3;

    if (!bookId || !memberId) {
      return res.status(400).json({
        success: false,
        message: 'Both book_id and member_id are required to issue a book',
      });
    }

    // 1. Check member exists and status
    const [memberRows] = await connection.query('SELECT * FROM members WHERE id = ?', [memberId]);
    if (memberRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    const member = memberRows[0];
    if (member.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Member status is '${member.status}'. Books can only be issued to active members.`,
      });
    }

    // 2. Check unpaid fines
    const [fineRows] = await connection.query(
      "SELECT COALESCE(SUM(amount), 0) AS unpaid FROM fines WHERE member_id = ? AND status = 'unpaid'",
      [memberId]
    );
    const unpaidFines = parseFloat(fineRows[0].unpaid) || 0;
    if (unpaidFines > 0) {
      return res.status(400).json({
        success: false,
        message: `Member has ₹${unpaidFines.toFixed(2)} in unpaid fines. Outstanding fines must be cleared prior to new loans.`,
      });
    }

    // 3. Check active loans limit
    const [activeLoanRows] = await connection.query(
      "SELECT COUNT(*) AS active_count FROM loans WHERE member_id = ? AND status IN ('issued', 'overdue')",
      [memberId]
    );
    const activeCount = parseInt(activeLoanRows[0].active_count, 10) || 0;
    if (activeCount >= maxActiveLoans) {
      return res.status(400).json({
        success: false,
        message: `Member already has ${activeCount} active loans (limit is ${maxActiveLoans}). Return a book first.`,
      });
    }

    // Check if member already has this exact book currently issued
    const [duplicateLoan] = await connection.query(
      "SELECT id FROM loans WHERE member_id = ? AND book_id = ? AND status IN ('issued', 'overdue')",
      [memberId, bookId]
    );
    if (duplicateLoan.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Member currently already has a copy of this book on loan.',
      });
    }

    // 4. Check book exists and available copies
    const [bookRows] = await connection.query('SELECT * FROM books WHERE id = ?', [bookId]);
    if (bookRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    const book = bookRows[0];
    if (book.available_copies < 1) {
      return res.status(400).json({
        success: false,
        message: `No available copies of "${book.title}" to issue right now. You can place a reservation instead.`,
      });
    }

    await connection.beginTransaction();

    // 5. Decrement available copies
    await connection.query(
      'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
      [bookId]
    );

    // 6. Calculate dates and insert loan
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + loanDays * 24 * 60 * 60 * 1000);

    const issueDateStr = formatDate(issueDate);
    const dueDateStr = formatDate(dueDate);

    const [loanResult] = await connection.query(
      'INSERT INTO loans (book_id, member_id, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [bookId, memberId, issueDateStr, dueDateStr, 'issued']
    );
    const loanId = loanResult.insertId;

    // Check if member had an existing reservation for this book and fulfill it
    await connection.query(
      "UPDATE reservations SET status = 'fulfilled' WHERE member_id = ? AND book_id = ? AND status = 'pending'",
      [memberId, bookId]
    );

    await connection.commit();

    const [newLoanRows] = await pool.query(
      `SELECT ${LOAN_SELECT_FIELDS}
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE l.id = ?`,
      [loanId]
    );

    // 7. Create notification & log activity
    Notification.create({
      audience: 'member',
      member: member.id,
      type: 'issued',
      title: 'Book Issued',
      message: `"${book.title}" has been issued to you. Due date: ${dueDateStr}.`,
      link: `/loans/${loanId}`,
    }).catch(() => {});

    ActivityLog.create({
      action: 'BOOK_ISSUED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        loanId,
        bookId,
        bookTitle: book.title,
        memberId,
        memberName: member.name,
        dueDate: dueDateStr,
      },
      targetType: 'Loan',
      targetId: loanId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Book "${book.title}" successfully issued to ${member.name}`,
      data: newLoanRows[0],
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * POST /return - Return book (admin/librarian)
 * Business rules:
 * - Find active loan
 * - Set return_date and status='returned'
 * - Increment available_copies
 * - Calculate fine if overdue, create fine record
 * - Check and fulfill pending reservations
 * - Create notification
 * - Log activity
 */
router.post('/return', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const loanId = req.body.loan_id || req.body.loanId;
    const bookId = req.body.book_id || req.body.bookId;
    const memberId = req.body.member_id || req.body.memberId;

    let loanQuery = "SELECT * FROM loans WHERE status IN ('issued', 'overdue')";
    const queryParams = [];

    if (loanId) {
      loanQuery += ' AND id = ?';
      queryParams.push(loanId);
    } else if (bookId && memberId) {
      loanQuery += ' AND book_id = ? AND member_id = ?';
      queryParams.push(bookId, memberId);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide loan_id or both book_id and member_id to return a book',
      });
    }

    const [loanRows] = await connection.query(loanQuery, queryParams);
    if (loanRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active loan found matching the provided criteria',
      });
    }

    const loan = loanRows[0];
    const returnDate = new Date();
    const returnDateStr = formatDate(returnDate);

    // Calculate fine if overdue
    const fineAmount = calculateFine(loan.due_date, returnDate);

    // Fetch book and member details
    const [bookRows] = await connection.query('SELECT * FROM books WHERE id = ?', [loan.book_id]);
    const [memberRows] = await connection.query('SELECT * FROM members WHERE id = ?', [loan.member_id]);
    const book = bookRows[0];
    const member = memberRows[0];

    await connection.beginTransaction();

    // 1. Mark loan as returned
    await connection.query(
      "UPDATE loans SET return_date = ?, status = 'returned' WHERE id = ?",
      [returnDateStr, loan.id]
    );

    // 2. Increment available copies
    await connection.query(
      'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
      [loan.book_id]
    );

    // 3. Create fine record if overdue
    let fineRecord = null;
    if (fineAmount > 0) {
      const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 2;
      const daysOverdue = Math.round(fineAmount / finePerDay);
      const description = `Overdue return: ${daysOverdue} day(s) late for "${book.title}"`;

      const [fineResult] = await connection.query(
        'INSERT INTO fines (loan_id, member_id, amount, status, description) VALUES (?, ?, ?, ?, ?)',
        [loan.id, loan.member_id, fineAmount, 'unpaid', description]
      );

      fineRecord = {
        id: fineResult.insertId,
        loan_id: loan.id,
        member_id: loan.member_id,
        amount: fineAmount,
        status: 'unpaid',
        description,
      };

      Notification.create({
        audience: 'member',
        member: loan.member_id,
        type: 'fine',
        title: 'Overdue Fine Assessed',
        message: `A fine of ₹${fineAmount.toFixed(2)} was generated for late return of "${book.title}".`,
        link: '/fines',
      }).catch(() => {});
    }

    // 4. Check and notify next pending reservation
    const [pendingRes] = await connection.query(
      "SELECT r.*, m.name as member_name, m.email as member_email FROM reservations r JOIN members m ON r.member_id = m.id WHERE r.book_id = ? AND r.status = 'pending' ORDER BY r.queue_position ASC, r.reservation_date ASC LIMIT 1",
      [loan.book_id]
    );

    let fulfilledReservation = null;
    if (pendingRes.length > 0) {
      const nextReservation = pendingRes[0];
      await connection.query(
        "UPDATE reservations SET status = 'fulfilled' WHERE id = ?",
        [nextReservation.id]
      );

      // Re-order queue positions for remaining pending reservations
      await connection.query(
        "UPDATE reservations SET queue_position = queue_position - 1 WHERE book_id = ? AND status = 'pending' AND queue_position > 1",
        [loan.book_id]
      );

      fulfilledReservation = nextReservation;

      Notification.create({
        audience: 'member',
        member: nextReservation.member_id,
        type: 'reservation',
        title: 'Reserved Book Ready for Collection',
        message: `Your reserved copy of "${book.title}" is now available at the library desk.`,
        link: '/reservations',
      }).catch(() => {});
    }

    await connection.commit();

    const [updatedLoan] = await pool.query(
      `SELECT ${LOAN_SELECT_FIELDS}
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE l.id = ?`,
      [loan.id]
    );

    Notification.create({
      audience: 'member',
      member: loan.member_id,
      type: 'returned',
      title: 'Book Returned',
      message: `"${book.title}" has been successfully returned. Thank you!`,
      link: `/loans/${loan.id}`,
    }).catch(() => {});

    ActivityLog.create({
      action: 'BOOK_RETURNED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        loanId: loan.id,
        bookId: loan.book_id,
        bookTitle: book.title,
        memberId: loan.member_id,
        fineAmount,
        reservationFulfilled: fulfilledReservation ? fulfilledReservation.id : null,
      },
      targetType: 'Loan',
      targetId: loan.id,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message:
        fineAmount > 0
          ? `Book returned successfully. Late fine of ₹${fineAmount.toFixed(2)} generated.`
          : 'Book returned successfully on time. No fine.',
      data: {
        loan: updatedLoan[0],
        fine: fineRecord,
        reservationFulfilled: fulfilledReservation,
      },
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * GET /:id - Get loan details
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const loanId = req.params.id;

    const [rows] = await pool.query(
      `SELECT ${LOAN_SELECT_FIELDS}
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE l.id = ?`,
      [loanId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan record not found',
      });
    }

    const loan = rows[0];

    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const isSelf = req.user.memberId === loan.member_id;

    if (!isStaff && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own loan records',
      });
    }

    const [fines] = await pool.query('SELECT * FROM fines WHERE loan_id = ?', [loan.id]);

    return res.json({
      success: true,
      data: {
        ...loan,
        fines,
        estimated_fine: loan.status !== 'returned' ? calculateFine(loan.due_date, new Date()) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
