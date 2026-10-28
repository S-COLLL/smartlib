const express = require('express');
const { pool } = require('../config/db');
const SearchHistory = require('../models/SearchHistory');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');

const router = express.Router();

/**
 * GET /autocomplete - Quick autocomplete results (title, author, isbn matches)
 */
router.get('/autocomplete', async (req, res, next) => {
  try {
    const q = req.query.q || req.query.term || '';
    const term = String(q).trim();

    if (!term || term.length < 1) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const likeTerm = `%${term}%`;
    const startTerm = `${term}%`;

    const [rows] = await pool.query(
      `SELECT 
        b.id,
        b.title,
        b.author,
        b.isbn,
        b.cover_image,
        b.available_copies,
        c.name AS category_name,
        CASE 
          WHEN b.title LIKE ? THEN 'title'
          WHEN b.author LIKE ? THEN 'author'
          ELSE 'isbn'
        END AS match_field
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?
       ORDER BY 
         CASE WHEN b.title LIKE ? THEN 1 WHEN b.author LIKE ? THEN 2 ELSE 3 END,
         b.available_copies DESC
       LIMIT 8`,
      [startTerm, startTerm, likeTerm, likeTerm, likeTerm, startTerm, startTerm]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    try {
      const bookService = require('../services/bookService');
      const all = bookService.readBooksFromDisk();
      const term = String(req.query.q || req.query.term || '').toLowerCase().trim();
      const matches = all
        .filter(
          (b) =>
            (b.title && b.title.toLowerCase().includes(term)) ||
            (b.author && b.author.toLowerCase().includes(term)) ||
            (b.isbn && b.isbn.includes(term))
        )
        .slice(0, 8);
      return res.json({ success: true, data: matches });
    } catch (_) {}
    next(error);
  }
});

/**
 * GET / - Search books with full filters and pagination
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const q = req.query.q || req.query.search || '';
    const { category, author, available, page, limit } = req.query;
    const { offset, limit: pageLimit, page: currentPage } = paginate(page, limit || 12);

    const conditions = ['1=1'];
    const params = [];

    const term = String(q).trim();
    if (term) {
      const likeTerm = `%${term}%`;
      conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.publisher LIKE ? OR b.description LIKE ?)');
      params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    if (category) {
      if (/^\d+$/.test(category)) {
        conditions.push('b.category_id = ?');
        params.push(parseInt(category, 10));
      } else {
        conditions.push('c.name = ?');
        params.push(category.trim());
      }
    }

    if (author) {
      conditions.push('b.author LIKE ?');
      params.push(`%${author.trim()}%`);
    }

    if (available === 'true' || available === '1') {
      conditions.push('b.available_copies > 0');
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        b.id,
        b.title,
        b.isbn,
        b.author,
        b.publisher,
        b.publication_year,
        b.category_id,
        b.shelf_id,
        b.total_copies,
        b.available_copies,
        b.description,
        b.cover_image,
        b.price,
        c.name AS category_name,
        c.icon AS category_icon,
        s.shelf_code,
        s.floor,
        s.section
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       WHERE ${whereClause}
       ORDER BY 
         CASE WHEN b.title LIKE ? THEN 1 ELSE 2 END,
         b.available_copies DESC,
         b.id DESC
       LIMIT ? OFFSET ?`,
      [`${term}%`, ...params, pageLimit, offset]
    );

    // Save to search history if authenticated and has search term
    if (req.user && term.length >= 2) {
      SearchHistory.create({
        userId: req.user.id,
        term,
        resultsCount: total,
      }).catch(() => {});
    }

    return res.json({
      success: true,
      query: term,
      data: rows,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    try {
      const bookService = require('../services/bookService');
      const result = await bookService.queryBooks({
        search: req.query.q || req.query.search,
        category: req.query.category,
        author: req.query.author,
        available: req.query.available,
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.json({
        success: true,
        query: req.query.q || req.query.search || '',
        data: result.books,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (_) {}
    next(error);
  }
});

/**
 * POST /history - Save a search term to user search history (authenticated)
 */
router.post('/history', authenticateToken, async (req, res, next) => {
  try {
    const term = String(req.body.term || req.body.query || '').trim().slice(0, 100);
    const resultsCount = parseInt(req.body.results_count || req.body.resultsCount, 10) || 0;

    if (!term || term.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters long',
      });
    }

    const item = await SearchHistory.create({
      userId: req.user.id,
      term,
      resultsCount,
    });

    return res.status(201).json({
      success: true,
      message: 'Search history recorded',
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /history - Get search history for current user (authenticated)
 */
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));

    const history = await SearchHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get unique terms
    const seen = new Set();
    const uniqueHistory = [];
    for (const h of history) {
      const lower = h.term.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueHistory.push(h);
      }
    }

    return res.json({
      success: true,
      data: uniqueHistory,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
