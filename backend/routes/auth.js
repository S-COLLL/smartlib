const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { validate, validateRegister, validateLogin } = require('../middleware/validate');
const { sanitizeUser, generateMembershipNumber } = require('../utils/helpers');

const router = express.Router();

/**
 * POST /register - Register a new member (creates user + member record)
 */
router.post('/register', validate(validateRegister), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { name, email, password, phone, department, course, year } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);

    // 1. Insert into users
    const [userResult] = await connection.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, cleanEmail, passwordHash, 'member', 1]
    );
    const userId = userResult.insertId;

    // 2. Insert into members
    const membershipNumber = generateMembershipNumber();
    const [memberResult] = await connection.query(
      'INSERT INTO members (user_id, membership_number, name, email, phone, department, course, year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        membershipNumber,
        name,
        cleanEmail,
        phone || null,
        department || null,
        course || null,
        year || null,
        'active',
      ]
    );
    const memberId = memberResult.insertId;

    await connection.commit();

    const [newUserRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const [newMemberRows] = await pool.query('SELECT * FROM members WHERE id = ?', [memberId]);

    const secret = process.env.JWT_SECRET || 'smartlib_default_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      {
        id: userId,
        email: cleanEmail,
        name,
        role: 'member',
        memberId,
      },
      secret,
      { expiresIn }
    );

    // Background Mongo audit and notification
    ActivityLog.create({
      action: 'USER_REGISTER',
      userId,
      userName: name,
      userRole: 'member',
      details: { email: cleanEmail, membershipNumber },
      targetType: 'User',
      targetId: userId,
      ipAddress: req.ip || '',
    }).catch((err) => console.error('ActivityLog error on register:', err.message));

    Notification.create({
      audience: 'staff',
      type: 'membership',
      title: 'New Member Registered',
      message: `${name} (${membershipNumber}) registered for a library account.`,
      link: `/members/${memberId}`,
    }).catch((err) => console.error('Notification error on register:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: sanitizeUser(newUserRows[0]),
      data: {
        token,
        user: sanitizeUser(newUserRows[0]),
        member: newMemberRows[0],
      },
      member: newMemberRows[0],
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * POST /login - Authenticate user & return JWT token
 */
router.post('/login', validate(validateLogin), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();

    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This account has been disabled. Please contact the administrator.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Retrieve linked member record if any
    const [members] = await pool.query('SELECT * FROM members WHERE user_id = ?', [user.id]);
    const member = members.length > 0 ? members[0] : null;

    const secret = process.env.JWT_SECRET || 'smartlib_default_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        memberId: member ? member.id : null,
      },
      secret,
      { expiresIn }
    );

    ActivityLog.create({
      action: 'USER_LOGIN',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: { email: user.email },
      ipAddress: req.ip || '',
    }).catch((err) => console.error('ActivityLog error on login:', err.message));

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
      member,
      data: {
        token,
        user: sanitizeUser(user),
        member,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /me - Retrieve current authenticated user profile
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const user = users[0];
    const [members] = await pool.query('SELECT * FROM members WHERE user_id = ?', [user.id]);
    const member = members.length > 0 ? members[0] : null;

    return res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        member,
      },
      user: sanitizeUser(user),
      member,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /me - Update current user profile
 */
router.put('/me', authenticateToken, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { name, phone, department, course, year } = req.body;

    await connection.beginTransaction();

    if (name) {
      await connection.query('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    }

    const [members] = await connection.query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
    if (members.length > 0) {
      await connection.query(
        'UPDATE members SET name = COALESCE(?, name), phone = COALESCE(?, phone), department = COALESCE(?, department), course = COALESCE(?, course), year = COALESCE(?, year) WHERE user_id = ?',
        [name || null, phone || null, department || null, course || null, year || null, req.user.id]
      );
    }

    await connection.commit();

    const [updatedUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const [updatedMembers] = await pool.query('SELECT * FROM members WHERE user_id = ?', [req.user.id]);

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: sanitizeUser(updatedUsers[0]),
        member: updatedMembers[0] || null,
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
 * PUT /change-password - Change current user's password
 */
router.put('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const currentPassword = req.body.current_password || req.body.currentPassword || req.body.old_password;
    const newPassword = req.body.new_password || req.body.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    ActivityLog.create({
      action: 'PASSWORD_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
