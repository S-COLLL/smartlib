const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate, validateShelf } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /floors - Get unique floors with sections
 */
router.get('/floors', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT floor, section FROM shelves ORDER BY floor ASC, section ASC'
    );

    const floorsMap = {};
    rows.forEach((row) => {
      if (!floorsMap[row.floor]) {
        floorsMap[row.floor] = [];
      }
      if (row.section && !floorsMap[row.floor].includes(row.section)) {
        floorsMap[row.floor].push(row.section);
      }
    });

    const uniqueFloors = Object.keys(floorsMap)
      .map(Number)
      .sort((a, b) => a - b);

    return res.json({
      success: true,
      data: {
        floors: uniqueFloors,
        sectionsByFloor: floorsMap,
      },
    });
  } catch (error) {
    try {
      const fs = require('fs');
      const path = require('path');
      const shFile = path.join(__dirname, '..', 'data', 'shelves.json');
      if (fs.existsSync(shFile)) {
        const shelves = JSON.parse(fs.readFileSync(shFile, 'utf8'));
        const floorsMap = {};
        shelves.forEach((s) => {
          if (!floorsMap[s.floor]) floorsMap[s.floor] = [];
          if (s.section && !floorsMap[s.floor].includes(s.section)) floorsMap[s.floor].push(s.section);
        });
        const uniqueFloors = Object.keys(floorsMap).map(Number).sort((a, b) => a - b);
        return res.json({ success: true, data: { floors: uniqueFloors, sectionsByFloor: floorsMap } });
      }
    } catch (_) {}
    next(error);
  }
});

/**
 * GET / - List all shelves with book counts, filterable by floor/section
 */
router.get('/', async (req, res, next) => {
  try {
    const { floor, section } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (floor !== undefined && floor !== '') {
      conditions.push('s.floor = ?');
      params.push(parseInt(floor, 10));
    }

    if (section) {
      conditions.push('s.section = ?');
      params.push(section.trim());
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query(
      `SELECT 
        s.id,
        s.shelf_code,
        s.name,
        s.floor,
        s.section,
        s.capacity,
        s.created_at,
        s.updated_at,
        COUNT(b.id) AS titles_count,
        COALESCE(SUM(b.total_copies), 0) AS occupied,
        GREATEST(0, s.capacity - COALESCE(SUM(b.total_copies), 0)) AS available_space,
        CASE 
          WHEN s.capacity > 0 THEN ROUND((COALESCE(SUM(b.total_copies), 0) / s.capacity) * 100, 1)
          ELSE 0 
        END AS occupancy_percentage
       FROM shelves s
       LEFT JOIN books b ON s.id = b.shelf_id
       WHERE ${whereClause}
       GROUP BY s.id
       ORDER BY s.floor ASC, s.shelf_code ASC`,
      params
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    try {
      const fs = require('fs');
      const path = require('path');
      const shFile = path.join(__dirname, '..', 'data', 'shelves.json');
      const bookFile = path.join(__dirname, '..', 'data', 'books.json');
      if (fs.existsSync(shFile)) {
        let shelves = JSON.parse(fs.readFileSync(shFile, 'utf8'));
        const books = fs.existsSync(bookFile) ? JSON.parse(fs.readFileSync(bookFile, 'utf8')) : [];
        if (req.query.floor) {
          shelves = shelves.filter((s) => Number(s.floor) === parseInt(req.query.floor, 10));
        }
        if (req.query.section) {
          shelves = shelves.filter((s) => s.section.toLowerCase() === req.query.section.toLowerCase());
        }
        const enriched = shelves.map((s) => {
          const shelfBooks = books.filter((b) => b.shelf_id === s.id || b.shelf_code === s.shelf_code);
          const occupied = shelfBooks.reduce((sum, b) => sum + (Number(b.total_copies) || 1), 0);
          return {
            ...s,
            titles_count: shelfBooks.length,
            occupied,
            available_space: Math.max(0, s.capacity - occupied),
            occupancy_percentage: s.capacity > 0 ? Math.round((occupied / s.capacity) * 1000) / 10 : 0,
          };
        });
        return res.json({ success: true, data: enriched });
      }
    } catch (_) {}
    next(error);
  }
});

/**
 * GET /:id - Get shelf details with books on it
 */
router.get('/:id', async (req, res, next) => {
  try {
    const shelfId = req.params.id;

    const [shelfRows] = await pool.query(
      `SELECT 
        s.id,
        s.shelf_code,
        s.name,
        s.floor,
        s.section,
        s.capacity,
        s.created_at,
        s.updated_at,
        COUNT(b.id) AS titles_count,
        COALESCE(SUM(b.total_copies), 0) AS occupied,
        GREATEST(0, s.capacity - COALESCE(SUM(b.total_copies), 0)) AS available_space
       FROM shelves s
       LEFT JOIN books b ON s.id = b.shelf_id
       WHERE s.id = ? OR s.shelf_code = ?
       GROUP BY s.id`,
      [shelfId, shelfId]
    );

    if (shelfRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shelf not found',
      });
    }

    const shelf = shelfRows[0];

    const [books] = await pool.query(
      `SELECT 
        b.id,
        b.title,
        b.isbn,
        b.author,
        b.publisher,
        b.publication_year,
        b.total_copies,
        b.available_copies,
        b.price,
        b.cover_image,
        c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.shelf_id = ?
       ORDER BY b.title ASC`,
      [shelf.id]
    );

    return res.json({
      success: true,
      data: {
        ...shelf,
        books,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST / - Create shelf (admin/librarian)
 */
router.post('/', authenticateToken, authorizeRoles('admin', 'librarian'), validate(validateShelf), async (req, res, next) => {
  try {
    const { shelf_code, name, floor, section, capacity } = req.body;
    const cleanCode = String(shelf_code).trim().toUpperCase();

    const [existing] = await pool.query(
      'SELECT id FROM shelves WHERE shelf_code = ?',
      [cleanCode]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A shelf with this code already exists',
      });
    }

    const [result] = await pool.query(
      'INSERT INTO shelves (shelf_code, name, floor, section, capacity, occupied) VALUES (?, ?, ?, ?, ?, ?)',
      [
        cleanCode,
        name.trim(),
        floor !== undefined ? parseInt(floor, 10) : 1,
        section ? section.trim() : 'General',
        capacity !== undefined ? parseInt(capacity, 10) : 100,
        0,
      ]
    );

    const newId = result.insertId;
    const [newShelf] = await pool.query('SELECT * FROM shelves WHERE id = ?', [newId]);

    ActivityLog.create({
      action: 'SHELF_CREATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { shelfId: newId, shelfCode: cleanCode },
      targetType: 'Shelf',
      targetId: newId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Shelf created successfully',
      data: newShelf[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id - Update shelf (admin/librarian)
 */
router.put('/:id', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const shelfId = req.params.id;
    const { shelf_code, name, floor, section, capacity } = req.body;

    const [shelfRows] = await pool.query('SELECT * FROM shelves WHERE id = ?', [shelfId]);
    if (shelfRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shelf not found',
      });
    }

    if (shelf_code) {
      const cleanCode = String(shelf_code).trim().toUpperCase();
      const [existing] = await pool.query(
        'SELECT id FROM shelves WHERE shelf_code = ? AND id != ?',
        [cleanCode, shelfId]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Another shelf with this code already exists',
        });
      }
    }

    await pool.query(
      `UPDATE shelves SET
        shelf_code = COALESCE(?, shelf_code),
        name = COALESCE(?, name),
        floor = COALESCE(?, floor),
        section = COALESCE(?, section),
        capacity = COALESCE(?, capacity)
       WHERE id = ?`,
      [
        shelf_code ? shelf_code.trim().toUpperCase() : null,
        name ? name.trim() : null,
        floor !== undefined ? parseInt(floor, 10) : null,
        section ? section.trim() : null,
        capacity !== undefined ? parseInt(capacity, 10) : null,
        shelfId,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM shelves WHERE id = ?', [shelfId]);

    ActivityLog.create({
      action: 'SHELF_UPDATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { shelfId, shelfCode: updated[0].shelf_code },
      targetType: 'Shelf',
      targetId: shelfId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Shelf updated successfully',
      data: updated[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id - Delete shelf (admin/librarian, verify no books on it)
 */
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const shelfId = req.params.id;

    const [shelfRows] = await pool.query('SELECT * FROM shelves WHERE id = ?', [shelfId]);
    if (shelfRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shelf not found',
      });
    }

    const [bookRows] = await pool.query(
      'SELECT COUNT(*) as count FROM books WHERE shelf_id = ?',
      [shelfId]
    );

    if (bookRows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete shelf: ${bookRows[0].count} book title(s) are placed on it. Move them to another shelf first.`,
      });
    }

    await pool.query('DELETE FROM shelves WHERE id = ?', [shelfId]);

    ActivityLog.create({
      action: 'SHELF_DELETED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { shelfId, shelfCode: shelfRows[0].shelf_code },
      targetType: 'Shelf',
      targetId: shelfId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Shelf deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
