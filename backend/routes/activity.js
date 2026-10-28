const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');

const router = express.Router();

/**
 * GET /recent - Recent activity logs (admin/librarian)
 */
router.get('/recent', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET / - List activity logs with filters and pagination (admin only)
 */
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const { action, userId, targetType, from, to, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (p - 1) * l;

    const query = {};

    if (action) {
      query.action = new RegExp(action.trim(), 'i');
    }

    if (userId) {
      query.userId = userId;
    }

    if (targetType) {
      query.targetType = targetType.trim();
    }

    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
