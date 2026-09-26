const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    shelf: { type: mongoose.Schema.Types.ObjectId, ref: 'Shelf' },
    shelfCode: { type: String, uppercase: true, trim: true },
    floor: Number,
    section: String,
    rack: { type: String, trim: true }, // "03"
    row: { type: String, uppercase: true, trim: true }, // "B"
    position: { type: String, trim: true }, // "07"
  },
  { _id: false }
);

const bookSchema = new mongoose.Schema(
  {
    bookId: { type: String, unique: true, index: true },
    title: { type: String, required: [true, 'Book name is required'], trim: true, maxlength: 200 },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
      match: [/^(97[89])?\d{9}[\dX]$/, 'ISBN must be a valid ISBN-10 or ISBN-13 (digits only)'],
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: [true, 'Author is required'] },
    authorName: { type: String, trim: true },
    publisher: { type: String, default: '', trim: true },
    publicationDate: Date,
    edition: { type: String, default: '1st', trim: true },
    language: { type: String, default: 'English', trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    categoryName: { type: String, trim: true },
    subcategory: { type: String, default: '', trim: true },
    description: { type: String, default: '', maxlength: 5000 },
    coverImage: { type: String, default: '' },
    pages: { type: Number, min: 0, default: 0 },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    purchasePrice: { type: Number, min: 0, default: 0 },
    currentValue: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, required: [true, 'Quantity is required'], min: [1, 'Quantity must be at least 1'] },
    availableCopies: { type: Number, default: 0, min: 0 },
    issuedCopies: { type: Number, default: 0, min: 0 },
    reservedCopies: { type: Number, default: 0, min: 0 },
    lostCopies: { type: Number, default: 0, min: 0 },
    damagedCopies: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Available', 'Issued', 'Reserved', 'Lost', 'Damaged', 'Unavailable'],
      default: 'Available',
    },
    timesBorrowed: { type: Number, default: 0 },
    location: { type: locationSchema, default: () => ({}) },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true } // createdAt = Date Added, updatedAt = Last Updated
);

bookSchema.index(
  {
    title: 'text',
    authorName: 'text',
    publisher: 'text',
    categoryName: 'text',
    description: 'text',
  },
  // `language` holds the book's language (e.g. Hindi), not a MongoDB stemming language
  { language_override: 'textSearchLanguage', default_language: 'english' }
);
bookSchema.index({ category: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ 'location.shelf': 1 });
bookSchema.index({ 'location.floor': 1 });
bookSchema.index({ price: 1 });
bookSchema.index({ timesBorrowed: -1 });

module.exports = mongoose.model('Book', bookSchema);
