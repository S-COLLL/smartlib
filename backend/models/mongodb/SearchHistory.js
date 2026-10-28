/**
 * ============================================================================
 * SMARTLIB — SearchHistory Model (MongoDB)
 * ============================================================================
 * Records user catalog search queries, facet filters, and result counts.
 * Enables search suggestions, analytics, and personalized recommendation feeds.
 * Includes a TTL (Time-To-Live) index to automatically prune history older than 90 days.
 * ============================================================================
 */

const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      index: true,
      default: null // Optional for anonymous guest searches
    },
    query: {
      type: String,
      required: [true, 'Search query is required'],
      trim: true
    },
    filters: {
      category: { type: String, trim: true, default: null },
      author: { type: String, trim: true, default: null },
      available: { type: Boolean, default: null },
      floor: { type: Number, default: null }
    },
    resultsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// TTL index: auto-delete search history after 90 days (7776000 seconds)
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

// Index for retrieving recent search history per user
searchHistorySchema.index({ userId: 1, createdAt: -1 });

// Index for aggregate analytics on top searched queries
searchHistorySchema.index({ query: 'text' });

const SearchHistory = mongoose.models.SearchHistory || mongoose.model('SearchHistory', searchHistorySchema);

module.exports = SearchHistory;
