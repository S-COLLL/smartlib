const express = require('express');
const { pool } = require('../config/db');
const Review = require('../models/Review');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeRoles, optionalAuth } = require('../middleware/auth');
const { validate, validateReview } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /book/:bookId - Get reviews for a specific book
 */
router.get('/book/:bookId', async (req, res, next) => {
  try {
    const bookId = req.params.bookId;

    const reviews = await Review.find({ bookId }).sort({ createdAt: -1 });

    const total = reviews.length;
    let averageRating = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (total > 0) {
      const sum = reviews.reduce((acc, r) => {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        return acc + r.rating;
      }, 0);
      averageRating = Math.round((sum / total) * 10) / 10;
    }

    return res.json({
      success: true,
      data: reviews,
      stats: {
        totalReviews: total,
        averageRating,
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /my - Get current user's reviews
 */
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const reviews = await Review.find({ userId: req.user.id }).sort({ createdAt: -1 });

    const bookIds = [...new Set(reviews.map((r) => r.bookId).filter(Boolean))];
    let booksMap = {};
    if (bookIds.length > 0) {
      try {
        const [books] = await pool.query(
          `SELECT id, title, author, cover_image, isbn FROM books WHERE id IN (?)`,
          [bookIds]
        );
        books.forEach((b) => {
          booksMap[b.id] = b;
        });
      } catch (err) {
        // Fallback if database query fails
      }
    }

    const data = reviews.map((r) => {
      const b = booksMap[r.bookId] || {};
      return {
        _id: r._id,
        id: r._id,
        book_id: r.bookId,
        bookId: r.bookId,
        title: b.title || 'Untitled Book',
        author: b.author || 'Unknown Author',
        cover_image: b.cover_image || null,
        isbn: b.isbn || null,
        rating: r.rating,
        comment: r.comment,
        created_at: r.createdAt,
        createdAt: r.createdAt,
        updated_at: r.updatedAt,
        updatedAt: r.updatedAt,
      };
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST / - Create a review for a book (authenticated member)
 */
router.post('/', authenticateToken, validate(validateReview), async (req, res, next) => {
  try {
    const bookId = req.body.book_id || req.body.bookId;
    const { rating, comment } = req.body;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: 'Book ID is required to submit a review',
      });
    }

    // Verify book exists in MySQL
    const [bookRows] = await pool.query('SELECT id, title FROM books WHERE id = ?', [bookId]);
    if (bookRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    // Prevent duplicate review by same user on same book
    const existing = await Review.findOne({
      bookId,
      userId: req.user.id,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this book. You can update your existing review instead.',
      });
    }

    const review = await Review.create({
      bookId,
      userId: req.user.id,
      userName: req.user.name,
      rating: parseInt(rating, 10),
      comment: String(comment).trim(),
    });

    ActivityLog.create({
      action: 'REVIEW_CREATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: {
        reviewId: review._id,
        bookId,
        bookTitle: bookRows[0].title,
        rating,
      },
      targetType: 'Review',
      targetId: review._id.toString(),
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id - Update own review
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const { rating, comment } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check ownership
    if (String(review.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only edit your own reviews',
      });
    }

    if (rating !== undefined) {
      const parsedRating = parseInt(rating, 10);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be an integer between 1 and 5',
        });
      }
      review.rating = parsedRating;
    }

    if (comment !== undefined) {
      if (!String(comment).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Review comment cannot be empty',
        });
      }
      review.comment = String(comment).trim();
    }

    await review.save();

    ActivityLog.create({
      action: 'REVIEW_UPDATED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { reviewId: review._id, bookId: review.bookId },
      targetType: 'Review',
      targetId: review._id.toString(),
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id - Delete review (own or admin)
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const reviewId = req.params.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const isOwner = String(review.userId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to delete this review',
      });
    }

    await Review.findByIdAndDelete(reviewId);

    ActivityLog.create({
      action: 'REVIEW_DELETED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      details: { reviewId, bookId: review.bookId },
      targetType: 'Review',
      targetId: reviewId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
