const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    term: {
      type: String,
      required: true,
      trim: true,
    },
    resultsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

searchHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
