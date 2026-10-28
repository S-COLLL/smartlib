/**
 * ============================================================================
 * SMARTLIB — Review Model (MongoDB)
 * ============================================================================
 * Stores member book reviews, ratings (1-5 stars), and review comments.
 * Cross-references relational IDs from MySQL: book_id, member_id, user_id.
 * Enforces one review per member per book via a compound unique index.
 * ============================================================================
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    bookId: {
      type: Number,
      required: [true, 'bookId referencing MySQL books.book_id is required'],
      index: true
    },
    memberId: {
      type: Number,
      required: [true, 'memberId referencing MySQL members.member_id is required'],
      index: true
    },
    userId: {
      type: Number,
      required: [true, 'userId referencing MySQL users.user_id is required']
    },
    memberName: {
      type: String,
      required: [true, 'Member name is required'],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    reviewText: {
      type: String,
      maxlength: [2000, 'Review cannot exceed 2000 characters'],
      trim: true,
      default: ''
    },
    isEdited: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound unique index: Ensure a member can only review a given book once
reviewSchema.index({ bookId: 1, memberId: 1 }, { unique: true });

// Index for sorting latest reviews by book
reviewSchema.index({ bookId: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;
