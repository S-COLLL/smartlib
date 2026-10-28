const express = require('express');
const { pool } = require('../config/db');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');

const router = express.Router();

/**
 * Helper to build visibility filter for a user
 */
function getAudienceFilter(user) {
  const isStaff = ['admin', 'librarian'].includes(user.role);
  const userIdentities = [user.id, String(user.id)];
  if (user.memberId) {
    userIdentities.push(user.memberId, String(user.memberId));
  }

  const conditions = [
    { audience: 'all' },
    { member: { $in: userIdentities } },
  ];

  if (isStaff) {
    conditions.push({ audience: 'staff' });
  }

  return { $or: conditions };
}

/**
 * GET /unread-count - Count unread notifications for current user
 */
router.get('/unread-count', authenticateToken, async (req, res, next) => {
  try {
    const visibilityFilter = getAudienceFilter(req.user);
    const userIdStr = String(req.user.id);

    const notifications = await Notification.find(visibilityFilter).select('readBy');
    const unreadCount = notifications.filter(
      (n) => !(n.readBy || []).some((r) => String(r) === userIdStr)
    ).length;

    return res.json({
      success: true,
      data: {
        unreadCount,
      },
      unread: unreadCount,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET / - Get current user's notifications
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { unread, type, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (p - 1) * l;

    const query = getAudienceFilter(req.user);

    if (type) {
      query.type = type;
    }

    const userIdStr = String(req.user.id);

    const total = await Notification.countDocuments(query);
    const docs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l);

    let items = docs.map((doc) => {
      const isRead = (doc.readBy || []).some((r) => String(r) === userIdStr);
      return {
        id: doc._id,
        _id: doc._id,
        audience: doc.audience,
        member: doc.member,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        link: doc.link,
        isRead,
        read: isRead,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    if (unread === 'true' || unread === '1') {
      items = items.filter((i) => !i.isRead);
    }

    // Total unread across all
    const allDocs = await Notification.find(query).select('readBy');
    const unreadCount = allDocs.filter(
      (n) => !(n.readBy || []).some((r) => String(r) === userIdStr)
    ).length;

    return res.json({
      success: true,
      data: items,
      unreadCount,
      unread: unreadCount,
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

/**
 * PUT /read-all - Mark all visible notifications as read for current user
 */
router.put('/read-all', authenticateToken, async (req, res, next) => {
  try {
    const visibilityFilter = getAudienceFilter(req.user);
    const userId = req.user.id;

    const result = await Notification.updateMany(
      visibilityFilter,
      { $addToSet: { readBy: userId } }
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id/read - Mark specific notification as read
 */
router.put('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const notifId = req.params.id;
    const notification = await Notification.findById(notifId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    await Notification.findByIdAndUpdate(notifId, {
      $addToSet: { readBy: req.user.id },
    });

    return res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id - Delete a notification
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const notifId = req.params.id;
    const notification = await Notification.findById(notifId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    const isStaff = ['admin', 'librarian'].includes(req.user.role);
    const isMemberTarget =
      String(notification.member) === String(req.user.memberId) ||
      String(notification.member) === String(req.user.id);

    if (!isStaff && !isMemberTarget) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to delete this notification',
      });
    }

    await Notification.findByIdAndDelete(notifId);

    return res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
