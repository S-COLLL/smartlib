const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');

const router = express.Router();

const RESERVATION_SELECT_FIELDS = `
  r.id,
  r.book_id,
  r.member_id,
  r.reservation_date,
  r.queue_position,
  r.status,
  r.created_at,
  r.updated_at,
  b.title AS book_title,
  b.isbn AS book_isbn,
  b.cover_image AS book_cover,
  b.author AS book_author,
  b.available_copies,
  m.name AS member_name,
  m.membership_number,
  m.email AS member_email
`;

/**
 * GET /my - Current user's reservations
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

    const conditions = ['r.member_id = ?'];
    const params = [memberId];

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM reservations r WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${RESERVATION_SELECT_FIELDS}
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN members m ON r.member_id = m.id
       WHERE ${whereClause}
       ORDER BY r.reservation_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    return res.json({
      success: true,
      data: rows,
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
 * GET / - List reservations (admin/librarian) or own (member)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const { status, book_id, member_id, page, limit } = req.query;
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
      conditions.push('r.member_id = ?');
      params.push(memberId);
    } else {
      if (member_id) {
        conditions.push('r.member_id = ?');
        params.push(parseInt(member_id, 10));
      }
    }

    if (book_id) {
      conditions.push('r.book_id = ?');
      params.push(parseInt(book_id, 10));
    }

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN members m ON r.member_id = m.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${RESERVATION_SELECT_FIELDS}
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN members m ON r.member_id = m.id
       WHERE ${whereClause}
       ORDER BY r.status = 'pending' DESC, r.queue_position ASC, r.reservation_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    return res.json({
      success: true,
      data: rows,
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
 * POST / - Create reservation (authenticated member)
 * Rules:
 * - Can't reserve if available_copies > 0 (unless already borrowed by this member)
 * - No duplicate active reservations for same book
 * - Assign queue position
 */
router.post('/', authenticateToken, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const bookId = req.body.book_id || req.body.bookId;
    let memberId = req.body.member_id || req.body.memberId;

    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    if (!isStaff || !memberId) {
      memberId = req.user.memberId;
      if (!memberId) {
        const [members] = await connection.query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
        if (members.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Your user account is not linked to an active library membership.',
          });
        }
        memberId = members[0].id;
      }
    }

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: 'Book ID is required to place a reservation',
      });
    }

    // 1. Verify book exists
    const [bookRows] = await connection.query('SELECT * FROM books WHERE id = ?', [bookId]);
    if (bookRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }
    const book = bookRows[0];

    // 2. Verify member exists and active
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
        message: `Membership status is '${member.status}'. Only active members can reserve books.`,
      });
    }

    // 3. Check duplicate active reservation
    const [duplicateRes] = await connection.query(
      "SELECT id FROM reservations WHERE member_id = ? AND book_id = ? AND status = 'pending'",
      [memberId, bookId]
    );
    if (duplicateRes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active pending reservation for this book',
      });
    }

    // 4. Check available copies rule:
    // Can't reserve if available_copies > 0 (unless already borrowed by this member)
    if (book.available_copies > 0) {
      const [currentLoan] = await connection.query(
        "SELECT id FROM loans WHERE member_id = ? AND book_id = ? AND status IN ('issued', 'overdue')",
        [memberId, bookId]
      );
      if (currentLoan.length === 0) {
        return res.status(400).json({
          success: false,
          message: `"${book.title}" has ${book.available_copies} copy(s) currently available on the shelf. You can borrow it directly without placing a reservation.`,
        });
      }
    }

    await connection.beginTransaction();

    // 5. Calculate queue position
    const [queueRows] = await connection.query(
      "SELECT COUNT(*) AS count FROM reservations WHERE book_id = ? AND status = 'pending'",
      [bookId]
    );
    const queuePosition = (parseInt(queueRows[0].count, 10) || 0) + 1;

    // 6. Insert reservation
    const [result] = await connection.query(
      'INSERT INTO reservations (book_id, member_id, reservation_date, queue_position, status) VALUES (?, ?, NOW(), ?, ?)',
      [bookId, memberId, queuePosition, 'pending']
    );
    const reservationId = result.insertId;

    await connection.commit();

    const [newResRows] = await pool.query(
      `SELECT ${RESERVATION_SELECT_FIELDS}
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN members m ON r.member_id = m.id
       WHERE r.id = ?`,
      [reservationId]
    );

    Notification.create({
      audience: 'member',
      member: memberId,
      type: 'reservation',
      title: 'Reservation Placed',
      message: `You placed a reservation for "${book.title}". Your queue position is #${queuePosition}.`,
      link: '/reservations',
    }).catch(() => {});

    ActivityLog.create({
      action: 'RESERVATION_CREATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        reservationId,
        bookId,
        bookTitle: book.title,
        memberId,
        queuePosition,
      },
      targetType: 'Reservation',
      targetId: reservationId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Reservation placed successfully. You are #${queuePosition} in line.`,
      data: newResRows[0],
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * PUT /:id/cancel - Cancel reservation
 */
router.put('/:id/cancel', authenticateToken, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const reservationId = req.params.id;

    const [resRows] = await connection.query('SELECT * FROM reservations WHERE id = ?', [reservationId]);
    if (resRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    const reservation = resRows[0];

    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const isSelf = req.user.memberId === reservation.member_id;

    if (!isStaff && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only cancel your own reservation',
      });
    }

    if (reservation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a reservation with status '${reservation.status}'`,
      });
    }

    await connection.beginTransaction();

    await connection.query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservationId]);

    // Re-adjust queue positions for behind positions
    await connection.query(
      "UPDATE reservations SET queue_position = queue_position - 1 WHERE book_id = ? AND status = 'pending' AND queue_position > ?",
      [reservation.book_id, reservation.queue_position]
    );

    await connection.commit();

    ActivityLog.create({
      action: 'RESERVATION_CANCELLED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { reservationId, bookId: reservation.book_id, memberId: reservation.member_id },
      targetType: 'Reservation',
      targetId: reservationId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Reservation cancelled successfully',
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * PUT /:id/fulfill - Fulfill reservation (admin/librarian)
 */
router.put('/:id/fulfill', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const reservationId = req.params.id;

    const [resRows] = await connection.query(
      `SELECT r.*, b.title as book_title
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       WHERE r.id = ?`,
      [reservationId]
    );

    if (resRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    const reservation = resRows[0];
    if (reservation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Reservation is already '${reservation.status}'`,
      });
    }

    await connection.beginTransaction();

    await connection.query("UPDATE reservations SET status = 'fulfilled' WHERE id = ?", [reservationId]);

    await connection.query(
      "UPDATE reservations SET queue_position = queue_position - 1 WHERE book_id = ? AND status = 'pending' AND queue_position > ?",
      [reservation.book_id, reservation.queue_position]
    );

    await connection.commit();

    Notification.create({
      audience: 'member',
      member: reservation.member_id,
      type: 'reservation',
      title: 'Reserved Book Ready for Collection',
      message: `Your reserved copy of "${reservation.book_title}" is ready for pickup at the library circulation desk.`,
      link: '/reservations',
    }).catch(() => {});

    ActivityLog.create({
      action: 'RESERVATION_FULFILLED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { reservationId, bookId: reservation.book_id, memberId: reservation.member_id },
      targetType: 'Reservation',
      targetId: reservationId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Reservation marked as fulfilled',
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
