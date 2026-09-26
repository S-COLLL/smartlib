const mongoose = require('mongoose');
const Book = require('../models/Book');
const Member = require('../models/Member');
const Shelf = require('../models/Shelf');
const { ApiError } = require('./helpers');

// Resolve a document by Mongo _id or its human readable code (BK0001, MEM0001, SH-A)
async function findByRef(Model, codeField, ref, label) {
  if (!ref) throw new ApiError(400, `${label} is required`);
  const query = mongoose.isValidObjectId(ref) && String(ref).length === 24 ? { _id: ref } : { [codeField]: String(ref).trim().toUpperCase() };
  const doc = await Model.findOne(query);
  if (!doc) throw new ApiError(404, `${label} not found`);
  return doc;
}

const findBook = (ref) => findByRef(Book, 'bookId', ref, 'Book');
const findMember = (ref) => findByRef(Member, 'memberId', ref, 'Member');
const findShelf = async (ref) => {
  if (!ref) throw new ApiError(400, 'Shelf is required');
  if (mongoose.isValidObjectId(ref) && String(ref).length === 24) {
    const s = await Shelf.findById(ref);
    if (s) return s;
  }
  const code = String(ref).trim().toUpperCase().replace(/^SH-/, '').replace(/^SHELF\s+/, '');
  const s = await Shelf.findOne({ code });
  if (!s) throw new ApiError(404, 'Shelf not found');
  return s;
};

module.exports = { findBook, findMember, findShelf };
