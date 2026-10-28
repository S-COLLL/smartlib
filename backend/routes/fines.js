const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');

const router = express.Router();

const FINE_SELECT_FIELDS = `
  f.id,
  f.loan_id,
  f.member_id,
  f.amount,
  f.status,
  f.paid_date,
  f.description,
  f.created_at,
  f.updated_at,
  m.name AS member_name,
  m.membership_number,
  m.email AS member_email,
  b.title AS book_title,
  b.isbn AS book_isbn,
  b.cover_image AS book_cover
`;

/**
 * GET /stats - Fine statistics (admin/librarian)
 */
router.get('/stats', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(amount), 0) AS total_fines,
        COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) AS unpaid_fines,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_fines,
        COALESCE(SUM(CASE WHEN status = 'waived' THEN amount ELSE 0 END), 0) AS waived_fines,
        COALESCE(SUM(status = 'unpaid'), 0) AS unpaid_count,
        COALESCE(SUM(status = 'paid'), 0) AS paid_count,
        COALESCE(SUM(status = 'waived'), 0) AS waived_count
      FROM fines
    `);

    return res.json({
      success: true,
      data: {
        totalFines: parseFloat(rows[0].total_fines),
        unpaidFines: parseFloat(rows[0].unpaid_fines),
        paidFines: parseFloat(rows[0].paid_fines),
        waivedFines: parseFloat(rows[0].waived_fines),
        totalCount: parseInt(rows[0].total_count, 10),
        unpaidCount: parseInt(rows[0].unpaid_count, 10),
        paidCount: parseInt(rows[0].paid_count, 10),
        waivedCount: parseInt(rows[0].waived_count, 10),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /my - Current user's fines
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

    const conditions = ['f.member_id = ?'];
    const params = [memberId];

    if (status) {
      conditions.push('f.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM fines f WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${FINE_SELECT_FIELDS}
       FROM fines f
       JOIN members m ON f.member_id = m.id
       LEFT JOIN loans l ON f.loan_id = l.id
       LEFT JOIN books b ON l.book_id = b.id
       WHERE ${whereClause}
       ORDER BY f.created_at DESC
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
 * GET / - List fines (admin/librarian) or own (member)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const { status, member_id, search, page, limit } = req.query;
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
      conditions.push('f.member_id = ?');
      params.push(memberId);
    } else {
      if (member_id) {
        conditions.push('f.member_id = ?');
        params.push(parseInt(member_id, 10));
      }
    }

    if (status) {
      conditions.push('f.status = ?');
      params.push(status);
    }

    if (search) {
      const term = `%${search.trim()}%`;
      conditions.push('(m.name LIKE ? OR m.membership_number LIKE ? OR f.description LIKE ?)');
      params.push(term, term, term);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM fines f
       JOIN members m ON f.member_id = m.id
       LEFT JOIN loans l ON f.loan_id = l.id
       LEFT JOIN books b ON l.book_id = b.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${FINE_SELECT_FIELDS}
       FROM fines f
       JOIN members m ON f.member_id = m.id
       LEFT JOIN loans l ON f.loan_id = l.id
       LEFT JOIN books b ON l.book_id = b.id
       WHERE ${whereClause}
       ORDER BY f.status = 'unpaid' DESC, f.created_at DESC
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
 * POST /:id/pay - Record fine payment (admin/librarian)
 */
router.post('/:id/pay', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const fineId = req.params.id;

    const [fineRows] = await pool.query(
      `SELECT f.*, m.name as member_name, m.membership_number
       FROM fines f
       JOIN members m ON f.member_id = m.id
       WHERE f.id = ?`,
      [fineId]
    );

    if (fineRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fine record not found',
      });
    }

    const fine = fineRows[0];

    if (fine.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This fine has already been paid in full',
      });
    }

    if (fine.status === 'waived') {
      return res.status(400).json({
        success: false,
        message: 'This fine has been waived and cannot be paid',
      });
    }

    await pool.query(
      "UPDATE fines SET status = 'paid', paid_date = NOW() WHERE id = ?",
      [fineId]
    );

    const [updatedRows] = await pool.query(
      `SELECT ${FINE_SELECT_FIELDS}
       FROM fines f
       JOIN members m ON f.member_id = m.id
       LEFT JOIN loans l ON f.loan_id = l.id
       LEFT JOIN books b ON l.book_id = b.id
       WHERE f.id = ?`,
      [fineId]
    );

    Notification.create({
      audience: 'member',
      member: fine.member_id,
      type: 'payment',
      title: 'Fine Payment Received',
      message: `Your payment of ₹${fine.amount} for fine #${fine.id} was recorded. Thank you!`,
      link: '/fines',
    }).catch(() => {});

    ActivityLog.create({
      action: 'FINE_PAID',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        fineId,
        memberId: fine.member_id,
        memberName: fine.member_name,
        amount: fine.amount,
      },
      targetType: 'Fine',
      targetId: fineId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Payment of ₹${fine.amount} recorded successfully`,
      data: updatedRows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id/waive - Waive fine (admin only)
 */
router.put('/:id/waive', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const fineId = req.params.id;

    const [fineRows] = await pool.query(
      `SELECT f.*, m.name as member_name
       FROM fines f
       JOIN members m ON f.member_id = m.id
       WHERE f.id = ?`,
      [fineId]
    );

    if (fineRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fine record not found',
      });
    }

    const fine = fineRows[0];

    if (fine.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot waive an already paid fine',
      });
    }

    if (fine.status === 'waived') {
      return res.status(400).json({
        success: false,
        message: 'This fine is already waived',
      });
    }

    await pool.query("UPDATE fines SET status = 'waived' WHERE id = ?", [fineId]);

    const [updatedRows] = await pool.query(
      `SELECT ${FINE_SELECT_FIELDS}
       FROM fines f
       JOIN members m ON f.member_id = m.id
       LEFT JOIN loans l ON f.loan_id = l.id
       LEFT JOIN books b ON l.book_id = b.id
       WHERE f.id = ?`,
      [fineId]
    );

    Notification.create({
      audience: 'member',
      member: fine.member_id,
      type: 'fine',
      title: 'Fine Waived',
      message: `Your fine of ₹${fine.amount} has been waived by the library administration.`,
      link: '/fines',
    }).catch(() => {});

    ActivityLog.create({
      action: 'FINE_WAIVED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        fineId,
        memberId: fine.member_id,
        memberName: fine.member_name,
        amount: fine.amount,
      },
      targetType: 'Fine',
      targetId: fineId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Fine of ₹${fine.amount} waived successfully`,
      data: updatedRows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
