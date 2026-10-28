const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate, validateMember } = require('../middleware/validate');
const { paginate, generateMembershipNumber } = require('../utils/helpers');

const router = express.Router();

/**
 * GET /stats - Member statistics (admin/librarian)
 */
router.get('/stats', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_members,
        COALESCE(SUM(status = 'active'), 0) AS active_members,
        COALESCE(SUM(status = 'inactive'), 0) AS inactive_members,
        COALESCE(SUM(status = 'suspended'), 0) AS suspended_members
      FROM members
    `);

    return res.json({
      success: true,
      data: {
        totalMembers: Number(rows[0].total_members),
        activeMembers: Number(rows[0].active_members),
        inactiveMembers: Number(rows[0].inactive_members),
        suspendedMembers: Number(rows[0].suspended_members),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET / - List members with search, pagination (admin/librarian)
 */
router.get('/', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const { search, status, department, page, limit } = req.query;
    const { offset, limit: pageLimit, page: currentPage } = paginate(page, limit || 15);

    const conditions = ['1=1'];
    const params = [];

    if (search) {
      const term = `%${search.trim()}%`;
      conditions.push('(m.name LIKE ? OR m.email LIKE ? OR m.membership_number LIKE ? OR m.phone LIKE ?)');
      params.push(term, term, term, term);
    }

    if (status) {
      conditions.push('m.status = ?');
      params.push(status.trim().toLowerCase());
    }

    if (department) {
      conditions.push('m.department = ?');
      params.push(department.trim());
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM members m WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        m.*,
        (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status IN ('issued', 'overdue')) AS active_loans_count,
        (SELECT COALESCE(SUM(f.amount), 0) FROM fines f WHERE f.member_id = m.id AND f.status = 'unpaid') AS unpaid_fines
       FROM members m
       WHERE ${whereClause}
       ORDER BY m.created_at DESC
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
 * GET /:id - Get member details (admin/librarian or self)
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const memberId = req.params.id;

    const [memberRows] = await pool.query(
      'SELECT * FROM members WHERE id = ? OR membership_number = ?',
      [memberId, memberId]
    );

    if (memberRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    const member = memberRows[0];

    // Check permission: staff or self
    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const isSelf = req.user.memberId === member.id || req.user.id === member.user_id;

    if (!isStaff && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own membership profile',
      });
    }

    // Fetch loans history
    const [loans] = await pool.query(
      `SELECT l.*, b.title, b.isbn, b.cover_image, b.author
       FROM loans l
       JOIN books b ON l.book_id = b.id
       WHERE l.member_id = ?
       ORDER BY l.issue_date DESC`,
      [member.id]
    );

    // Fetch fines
    const [fines] = await pool.query(
      `SELECT f.*, b.title as book_title
       FROM fines f
       LEFT JOIN loans l ON f.loan_id = l.id
       LEFT JOIN books b ON l.book_id = b.id
       WHERE f.member_id = ?
       ORDER BY f.created_at DESC`,
      [member.id]
    );

    // Fetch reservations
    const [reservations] = await pool.query(
      `SELECT r.*, b.title, b.isbn, b.cover_image
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       WHERE r.member_id = ?
       ORDER BY r.reservation_date DESC`,
      [member.id]
    );

    return res.json({
      success: true,
      data: {
        ...member,
        loans,
        fines,
        reservations,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST / - Create member (admin/librarian)
 */
router.post('/', authenticateToken, authorizeRoles('admin', 'librarian'), validate(validateMember), async (req, res, next) => {
  try {
    const { name, email, phone, department, course, year, status } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();

    const [existing] = await pool.query(
      'SELECT id FROM members WHERE email = ?',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A member with this email address already exists',
      });
    }

    const membershipNumber = generateMembershipNumber();

    const [result] = await pool.query(
      `INSERT INTO members (membership_number, name, email, phone, department, course, year, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        membershipNumber,
        name.trim(),
        cleanEmail,
        phone ? phone.trim() : null,
        department ? department.trim() : null,
        course ? course.trim() : null,
        year ? year.trim() : null,
        status || 'active',
      ]
    );

    const newId = result.insertId;
    const [newMember] = await pool.query('SELECT * FROM members WHERE id = ?', [newId]);

    ActivityLog.create({
      action: 'MEMBER_CREATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { memberId: newId, membershipNumber, name: name.trim() },
      targetType: 'Member',
      targetId: newId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: newMember[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id - Update member (admin/librarian)
 */
router.put('/:id', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const memberId = req.params.id;
    const { name, email, phone, department, course, year, status } = req.body;

    const [memberRows] = await connection.query('SELECT * FROM members WHERE id = ?', [memberId]);
    if (memberRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    const currentMember = memberRows[0];

    if (email && email.toLowerCase() !== currentMember.email.toLowerCase()) {
      const [existing] = await connection.query(
        'SELECT id FROM members WHERE email = ? AND id != ?',
        [email.trim().toLowerCase(), memberId]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Another member is already using this email address',
        });
      }
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE members SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        department = COALESCE(?, department),
        course = COALESCE(?, course),
        year = COALESCE(?, year),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        phone ? phone.trim() : null,
        department ? department.trim() : null,
        course ? course.trim() : null,
        year ? year.trim() : null,
        status || null,
        memberId,
      ]
    );

    // If member has linked user, keep user's name/email in sync
    if (currentMember.user_id && (name || email)) {
      await connection.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
        [name ? name.trim() : null, email ? email.trim().toLowerCase() : null, currentMember.user_id]
      );
    }

    await connection.commit();

    const [updated] = await pool.query('SELECT * FROM members WHERE id = ?', [memberId]);

    ActivityLog.create({
      action: 'MEMBER_UPDATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { memberId, name: updated[0].name },
      targetType: 'Member',
      targetId: memberId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Member updated successfully',
      data: updated[0],
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * PUT /:id/status - Toggle member status (admin only)
 */
router.put('/:id/status', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const memberId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const cleanStatus = status.toLowerCase();

    const [memberRows] = await pool.query('SELECT * FROM members WHERE id = ?', [memberId]);
    if (memberRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    await pool.query('UPDATE members SET status = ? WHERE id = ?', [cleanStatus, memberId]);

    // Also update users.is_active if user account linked
    if (memberRows[0].user_id) {
      await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [
        cleanStatus === 'active' ? 1 : 0,
        memberRows[0].user_id,
      ]);
    }

    ActivityLog.create({
      action: 'MEMBER_STATUS_CHANGED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { memberId, previousStatus: memberRows[0].status, newStatus: cleanStatus },
      targetType: 'Member',
      targetId: memberId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Member status successfully updated to ${cleanStatus}`,
      data: {
        id: parseInt(memberId, 10),
        status: cleanStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
