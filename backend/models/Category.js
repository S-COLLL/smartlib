const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    categoryId: { type: String, unique: true, index: true },
    name: { type: String, required: [true, 'Category name is required'], unique: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 500 },
    icon: { type: String, default: '📚' },
    subcategories: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
