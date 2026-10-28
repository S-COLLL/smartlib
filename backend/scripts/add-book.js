/**
 * SMARTLIB - Backend Book Management & Ingestion Script
 * Adds books to the backend storage (JSON repository + MySQL if active).
 *
 * Usage from CLI:
 *   node backend/scripts/add-book.js --title "Atomic Habits" --author "James Clear" --isbn "9780735211292" --category "Non-Fiction" --price 450
 *
 * Usage as a Node.js module:
 *   const { addBook, getBooks, findBookByIsbn } = require('./backend/scripts/add-book');
 *   await addBook({ title: '...', author: '...', isbn: '...' });
 */

const fs = require('fs');
const path = require('path');

const BOOKS_FILE = path.join(__dirname, '..', 'data', 'books.json');
const CATEGORIES_FILE = path.join(__dirname, '..', 'data', 'categories.json');
const SHELVES_FILE = path.join(__dirname, '..', 'data', 'shelves.json');

// Ensure data directory exists
const dataDir = path.dirname(BOOKS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load all books from backend storage
 * @returns {Array} List of book objects
 */
function getBooks() {
  try {
    if (fs.existsSync(BOOKS_FILE)) {
      const raw = fs.readFileSync(BOOKS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading books.json:', err.message);
  }
  return [];
}

/**
 * Save books array to backend storage
 * @param {Array} books 
 */
function saveBooks(books) {
  fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2), 'utf8');
}

/**
 * Find a book by ISBN
 * @param {string} isbn 
 * @returns {object|null}
 */
function findBookByIsbn(isbn) {
  if (!isbn) return null;
  const cleanIsbn = String(isbn).replace(/[-\s]/g, '').trim();
  const books = getBooks();
  return books.find(b => String(b.isbn).replace(/[-\s]/g, '').trim() === cleanIsbn) || null;
}

/**
 * Add a book to backend storage and sync to MySQL if available
 * @param {object} bookData 
 * @returns {Promise<object>} Created book record
 */
async function addBook(bookData) {
  const books = getBooks();

  if (!bookData.title || !bookData.author || !bookData.isbn) {
    throw new Error('Title, Author, and ISBN are required to add a book.');
  }

  const cleanIsbn = String(bookData.isbn).replace(/[-\s]/g, '').trim();

  // Check unique ISBN
  const existing = books.find(b => String(b.isbn).replace(/[-\s]/g, '').trim() === cleanIsbn);
  if (existing) {
    throw new Error(`A book with ISBN ${bookData.isbn} already exists ("${existing.title}").`);
  }

  // Generate next ID
  const maxId = books.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0);
  const nextId = maxId + 1;

  // Resolve category
  let categoryId = Number(bookData.category_id) || 1;
  let categoryName = bookData.category_name || bookData.category || 'General';
  if (fs.existsSync(CATEGORIES_FILE)) {
    try {
      const categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
      const foundCat = categories.find(c => 
        (bookData.category_id && c.id === Number(bookData.category_id)) ||
        (bookData.category && c.name.toLowerCase() === String(bookData.category).toLowerCase())
      );
      if (foundCat) {
        categoryId = foundCat.id;
        categoryName = foundCat.name;
      }
    } catch (_) {}
  }

  // Resolve shelf
  let shelfId = Number(bookData.shelf_id) || 1;
  let shelfCode = bookData.shelf_code || 'GEN-01';
  let shelfName = bookData.shelf_name || 'General Shelf';
  let floor = Number(bookData.floor) || 1;
  let section = bookData.section || categoryName;

  if (fs.existsSync(SHELVES_FILE)) {
    try {
      const shelves = JSON.parse(fs.readFileSync(SHELVES_FILE, 'utf8'));
      const foundShelf = shelves.find(s => 
        (bookData.shelf_id && s.id === Number(bookData.shelf_id)) ||
        (bookData.shelf_code && s.shelf_code.toUpperCase() === String(bookData.shelf_code).toUpperCase())
      );
      if (foundShelf) {
        shelfId = foundShelf.id;
        shelfCode = foundShelf.shelf_code;
        shelfName = foundShelf.name;
        floor = foundShelf.floor;
        section = foundShelf.section;
      }
    } catch (_) {}
  }

  const totalCopies = parseInt(bookData.total_copies || bookData.copies || bookData.quantity, 10) || 1;
  const availableCopies = bookData.available_copies !== undefined 
    ? parseInt(bookData.available_copies, 10) 
    : totalCopies;

  const newBook = {
    id: nextId,
    title: bookData.title.trim(),
    isbn: cleanIsbn,
    author: bookData.author.trim(),
    publisher: bookData.publisher ? bookData.publisher.trim() : 'SmartLib Press',
    publication_year: Number(bookData.publication_year || bookData.year) || new Date().getFullYear(),
    category_id: categoryId,
    category_name: categoryName,
    shelf_id: shelfId,
    shelf_code: shelfCode,
    shelf_name: shelfName,
    floor: floor,
    section: section,
    total_copies: totalCopies,
    available_copies: availableCopies,
    issued_copies: totalCopies - availableCopies,
    description: bookData.description ? bookData.description.trim() : `A book on ${categoryName} titled ${bookData.title}.`,
    cover_image: bookData.cover_image || bookData.coverImage || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500',
    price: bookData.price !== undefined ? parseFloat(bookData.price) : 399.00,
    pages: Number(bookData.pages) || 280,
    language: bookData.language || 'English',
    created_at: new Date().toISOString(),
  };

  // Append and save to JSON
  books.push(newBook);
  saveBooks(books);

  console.log(`✅ [Backend] Successfully added book ID #${newBook.id}: "${newBook.title}" by ${newBook.author}`);

  // Also sync to MySQL if connection pool is available
  try {
    const { pool } = require('../config/db');
    if (pool && typeof pool.query === 'function') {
      await pool.query(
        `INSERT INTO books 
         (title, isbn, author, publisher, publication_year, category_id, shelf_id, total_copies, available_copies, description, cover_image, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), author = VALUES(author)`,
        [
          newBook.title,
          newBook.isbn,
          newBook.author,
          newBook.publisher,
          newBook.publication_year,
          newBook.category_id,
          newBook.shelf_id,
          newBook.total_copies,
          newBook.available_copies,
          newBook.description,
          newBook.cover_image,
          newBook.price
        ]
      ).catch(() => {});
    }
  } catch (_) {
    // MySQL optional sync silently handled
  }

  return newBook;
}

/**
 * Bulk add multiple books
 * @param {Array<object>} booksList 
 * @returns {Promise<Array>} List of added books
 */
async function bulkAddBooks(booksList) {
  const added = [];
  for (const item of booksList) {
    try {
      const book = await addBook(item);
      added.push(book);
    } catch (err) {
      console.warn(`⚠️  Skipping "${item.title || 'Unknown'}":`, err.message);
    }
  }
  return added;
}

// CLI Execution support
if (require.main === module) {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--?/, '');
    const val = args[i + 1];
    if (key && val) parsed[key] = val;
  }

  if (parsed.title && parsed.author && parsed.isbn) {
    addBook(parsed)
      .then((b) => {
        console.log('Book added successfully:');
        console.log(JSON.stringify(b, null, 2));
      })
      .catch((err) => {
        console.error('Error adding book:', err.message);
        process.exit(1);
      });
  } else {
    console.log(`
📚 SMARTLIB Backend Book Management CLI
---------------------------------------
Total books currently stored: ${getBooks().length}

To add a new book:
  node backend/scripts/add-book.js --title "<Title>" --author "<Author>" --isbn "<ISBN>" [--category "<Category>"] [--price <Price>] [--copies <Count>]

Example:
  node backend/scripts/add-book.js --title "Atomic Habits" --author "James Clear" --isbn "9780735211292" --category "Business" --price 450
`);
  }
}

module.exports = {
  getBooks,
  saveBooks,
  findBookByIsbn,
  addBook,
  bulkAddBooks,
};

