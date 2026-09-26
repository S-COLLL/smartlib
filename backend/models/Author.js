const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema(
  {
    authorId: { type: String, unique: true, index: true },
    name: { type: String, required: [true, 'Author name is required'], trim: true, maxlength: 120 },
    biography: { type: String, default: '', maxlength: 3000 },
    country: { type: String, default: '', trim: true },
    profileImage: { type: String, default: '' },
  },
  { timestamps: true }
);

authorSchema.index({ name: 1 });

module.exports = mongoose.model('Author', authorSchema);
