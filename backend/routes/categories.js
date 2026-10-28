const express = require('express');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate, validateCategory } = require('../middleware/validate');

const router = express.Router();

/**
 * GET / - List all categories with book counts
 */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        c.created_at,
        c.updated_at,
        COUNT(b.id) AS book_count,
        COALESCE(SUM(b.total_copies), 0) AS total_copies,
        COALESCE(SUM(b.available_copies), 0) AS available_copies
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    try {
      const fs = require('fs');
      const path = require('path');
      const catFile = path.join(__dirname, '..', 'data', 'categories.json');
      const bookFile = path.join(__dirname, '..', 'data', 'books.json');
      if (fs.existsSync(catFile)) {
        const categories = JSON.parse(fs.readFileSync(catFile, 'utf8'));
        const books = fs.existsSync(bookFile) ? JSON.parse(fs.readFileSync(bookFile, 'utf8')) : [];
        const enriched = categories.map((c) => {
          const catBooks = books.filter(
            (b) =>
              b.category_id === c.id ||
              (b.category_name && b.category_name.toLowerCase() === c.name.toLowerCase())
          );
          const totalCopies = catBooks.reduce((sum, b) => sum + (Number(b.total_copies) || 1), 0);
          const availableCopies = catBooks.reduce(
            (sum, b) => sum + (Number(b.available_copies) || 1),
            0
          );
          return {
            ...c,
            book_count: catBooks.length,
            total_copies: totalCopies,
            available_copies: availableCopies,
          };
        });
        return res.json({ success: true, data: enriched });
      }
    } catch (_) {}
    next(error);
  }
});

/**
 * GET /:id - Get category with its books
 */
router.get('/:id', async (req, res, next) => {
  try {
    const catId = req.params.id;

    const [catRows] = await pool.query(
      `SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        c.created_at,
        c.updated_at,
        COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON c.id = b.category_id
       WHERE c.id = ? OR c.name = ?
       GROUP BY c.id`,
      [catId, catId]
    );

    if (catRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const category = catRows[0];

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
        s.shelf_code,
        s.floor,
        s.section
       FROM books b
       LEFT JOIN shelves s ON b.shelf_id = s.id
       WHERE b.category_id = ?
       ORDER BY b.title ASC`,
      [category.id]
    );

    return res.json({
      success: true,
      data: {
        ...category,
        books,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST / - Create category (admin/librarian only)
 */
router.post('/', authenticateToken, authorizeRoles('admin', 'librarian'), validate(validateCategory), async (req, res, next) => {
  try {
    const { name, description, icon } = req.body;
    const cleanName = String(name).trim();

    const [existing] = await pool.query(
      'SELECT id FROM categories WHERE name = ?',
      [cleanName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A category with this name already exists',
      });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)',
      [cleanName, description ? description.trim() : null, icon || '📚']
    );

    const newId = result.insertId;
    const [newCat] = await pool.query('SELECT * FROM categories WHERE id = ?', [newId]);

    ActivityLog.create({
      action: 'CATEGORY_CREATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { categoryId: newId, name: cleanName },
      targetType: 'Category',
      targetId: newId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCat[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id - Update category (admin/librarian only)
 */
router.put('/:id', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const catId = req.params.id;
    const { name, description, icon } = req.body;

    const [catRows] = await pool.query('SELECT * FROM categories WHERE id = ?', [catId]);
    if (catRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (name) {
      const cleanName = String(name).trim();
      const [existing] = await pool.query(
        'SELECT id FROM categories WHERE name = ? AND id != ?',
        [cleanName, catId]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Another category with this name already exists',
        });
      }
    }

    await pool.query(
      `UPDATE categories SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon)
       WHERE id = ?`,
      [name ? name.trim() : null, description ? description.trim() : null, icon || null, catId]
    );

    const [updated] = await pool.query('SELECT * FROM categories WHERE id = ?', [catId]);

    ActivityLog.create({
      action: 'CATEGORY_UPDATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { categoryId: catId, name: updated[0].name },
      targetType: 'Category',
      targetId: catId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Category updated successfully',
      data: updated[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id - Delete category (admin/librarian only, check no books)
 */
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'librarian'), async (req, res, next) => {
  try {
    const catId = req.params.id;

    const [catRows] = await pool.query('SELECT * FROM categories WHERE id = ?', [catId]);
    if (catRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const [bookRows] = await pool.query(
      'SELECT COUNT(*) as count FROM books WHERE category_id = ?',
      [catId]
    );

    if (bookRows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${bookRows[0].count} book(s) belong to it. Reassign or delete them first.`,
      });
    }

    await pool.query('DELETE FROM categories WHERE id = ?', [catId]);

    ActivityLog.create({
      action: 'CATEGORY_DELETED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { categoryId: catId, name: catRows[0].name },
      targetType: 'Category',
      targetId: catId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
