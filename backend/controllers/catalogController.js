// Authors, Categories and Shelves
const mongoose = require('mongoose');
const Author = require('../models/Author');
const Category = require('../models/Category');
const Shelf = require('../models/Shelf');
const Book = require('../models/Book');
const { ApiError, asyncHandler, nextId, escapeRegex, pick } = require('../utils/helpers');
const { findShelf } = require('../utils/lookup');
const { recalcShelf, recalcAllShelves } = require('../utils/library');

const byIdOrCode = (field, ref) => (mongoose.isValidObjectId(ref) && String(ref).length === 24 ? { _id: ref } : { [field]: String(ref).toUpperCase() });

/* ---------------------------- Authors ---------------------------- */

exports.listAuthors = asyncHandler(async (req, res) => {
  const filter = req.query.search ? { name: new RegExp(escapeRegex(req.query.search), 'i') } : {};
  const [authors, counts] = await Promise.all([
    Author.find(filter).sort({ name: 1 }).lean(),
    Book.aggregate([{ $group: { _id: '$author', books: { $sum: 1 }, copies: { $sum: '$quantity' }, borrowed: { $sum: '$timesBorrowed' } } }]),
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  const data = authors.map((a) => ({
    ...a,
    bookCount: map[String(a._id)]?.books || 0,
    totalCopies: map[String(a._id)]?.copies || 0,
    timesBorrowed: map[String(a._id)]?.borrowed || 0,
  }));
  res.json({ success: true, data });
});

exports.getAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findOne(byIdOrCode('authorId', req.params.id)).lean();
  if (!author) throw new ApiError(404, 'Author not found');
  const books = await Book.find({ author: author._id }).sort({ title: 1 }).lean();
  res.json({ success: true, data: { ...author, bookCount: books.length }, books });
});

exports.createAuthor = asyncHandler(async (req, res) => {
  const exists = await Author.findOne({ name: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') });
  if (exists) throw new ApiError(409, 'An author with this name already exists');
  const author = await Author.create({ ...pick(req.body, ['name', 'biography', 'country', 'profileImage']), authorId: await nextId('author', 'AUT', 3) });
  res.status(201).json({ success: true, data: author });
});

exports.updateAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findOne(byIdOrCode('authorId', req.params.id));
  if (!author) throw new ApiError(404, 'Author not found');
  Object.assign(author, pick(req.body, ['name', 'biography', 'country', 'profileImage']));
  await author.save();
  if (req.body.name) await Book.updateMany({ author: author._id }, { authorName: author.name });
  res.json({ success: true, data: author });
});

exports.deleteAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findOne(byIdOrCode('authorId', req.params.id));
  if (!author) throw new ApiError(404, 'Author not found');
  const count = await Book.countDocuments({ author: author._id });
  if (count) throw new ApiError(400, `Cannot delete: ${count} book(s) are linked to this author`);
  await author.deleteOne();
  res.json({ success: true, message: 'Author deleted' });
});

/* --------------------------- Categories -------------------------- */

exports.listCategories = asyncHandler(async (_req, res) => {
  const [cats, stats] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Book.aggregate([
      {
        $group: {
          _id: '$category',
          titles: { $sum: 1 },
          total: { $sum: '$quantity' },
          available: { $sum: '$availableCopies' },
          issued: { $sum: '$issuedCopies' },
          reserved: { $sum: '$reservedCopies' },
        },
      },
    ]),
  ]);
  const map = Object.fromEntries(stats.map((s) => [String(s._id), s]));
  const data = cats.map((c) => {
    const s = map[String(c._id)] || {};
    return { ...c, titles: s.titles || 0, totalBooks: s.total || 0, availableBooks: s.available || 0, issuedBooks: s.issued || 0, reservedBooks: s.reserved || 0 };
  });
  res.json({ success: true, data });
});

exports.getCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findOne(byIdOrCode('categoryId', req.params.id)).lean();
  if (!cat) throw new ApiError(404, 'Category not found');
  const books = await Book.find({ category: cat._id }).sort({ title: 1 }).lean();
  res.json({ success: true, data: cat, books });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const cat = await Category.create({
    ...pick(req.body, ['name', 'description', 'icon', 'subcategories']),
    categoryId: await nextId('category', 'CAT', 3),
  });
  res.status(201).json({ success: true, data: cat });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findOne(byIdOrCode('categoryId', req.params.id));
  if (!cat) throw new ApiError(404, 'Category not found');
  Object.assign(cat, pick(req.body, ['name', 'description', 'icon', 'subcategories']));
  await cat.save();
  if (req.body.name) await Book.updateMany({ category: cat._id }, { categoryName: cat.name });
  res.json({ success: true, data: cat });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findOne(byIdOrCode('categoryId', req.params.id));
  if (!cat) throw new ApiError(404, 'Category not found');
  const count = await Book.countDocuments({ category: cat._id });
  if (count) throw new ApiError(400, `Cannot delete: ${count} book(s) belong to this category`);
  await Shelf.updateMany({ category: cat._id }, { $unset: { category: 1 } });
  await cat.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});

/* ----------------------------- Shelves --------------------------- */

const SHELF_FIELDS = ['code', 'name', 'floor', 'section', 'racks', 'rowsPerRack', 'category', 'capacity', 'status'];

exports.listShelves = asyncHandler(async (req, res) => {
  await recalcAllShelves();
  const filter = {};
  if (req.query.floor) filter.floor = Number(req.query.floor);
  const shelves = await Shelf.find(filter).populate('category', 'name icon').sort({ floor: 1, section: 1, code: 1 });
  const titles = await Book.aggregate([{ $group: { _id: '$location.shelf', titles: { $sum: 1 } } }]);
  const map = Object.fromEntries(titles.map((t) => [String(t._id), t.titles]));
  res.json({ success: true, data: shelves.map((s) => ({ ...s.toJSON(), titles: map[String(s._id)] || 0 })) });
});

exports.getShelf = asyncHandler(async (req, res) => {
  const shelf = await findShelf(req.params.id);
  await recalcShelf(shelf._id);
  const fresh = await Shelf.findById(shelf._id).populate('category', 'name icon');
  const books = await Book.find({ 'location.shelf': shelf._id }).sort({ 'location.rack': 1, 'location.row': 1, 'location.position': 1 }).lean();
  res.json({ success: true, data: { ...fresh.toJSON(), titles: books.length }, books });
});

async function validateShelfBody(body) {
  if (body.category) {
    if (!mongoose.isValidObjectId(body.category) || !(await Category.exists({ _id: body.category }))) throw new ApiError(400, 'Category does not exist');
  } else if (body.category === '') {
    body.category = undefined;
  }
}

exports.createShelf = asyncHandler(async (req, res) => {
  await validateShelfBody(req.body);
  const shelf = await Shelf.create(pick(req.body, SHELF_FIELDS));
  res.status(201).json({ success: true, data: shelf });
});

exports.updateShelf = asyncHandler(async (req, res) => {
  const shelf = await findShelf(req.params.id);
  await validateShelfBody(req.body);
  const oldCode = shelf.code;
  Object.assign(shelf, pick(req.body, SHELF_FIELDS));
  if (req.body.capacity !== undefined && Number(req.body.capacity) < shelf.occupied) {
    throw new ApiError(400, `Capacity cannot be less than the ${shelf.occupied} books currently stored`);
  }
  if (req.body.code && req.body.code.toUpperCase() !== oldCode) {
    shelf.shelfId = `SH-${shelf.code}`;
    if (!req.body.name) shelf.name = `Shelf ${shelf.code}`;
  }
  await shelf.save();
  await Book.updateMany(
    { 'location.shelf': shelf._id },
    { 'location.shelfCode': shelf.code, 'location.floor': shelf.floor, 'location.section': shelf.section }
  );
  res.json({ success: true, data: shelf });
});

exports.deleteShelf = asyncHandler(async (req, res) => {
  const shelf = await findShelf(req.params.id);
  const count = await Book.countDocuments({ 'location.shelf': shelf._id });
  if (count) throw new ApiError(400, `Cannot delete: ${count} book title(s) are stored on ${shelf.name}. Move them first.`);
  await shelf.deleteOne();
  res.json({ success: true, message: 'Shelf deleted' });
});
