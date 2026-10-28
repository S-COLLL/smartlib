/**
 * SMARTLIB - Backend Book Service
 * Unified data provider for book catalog management.
 * Operates with dual-layer architecture:
 * 1. Primary: JSON data repository (backend/data/books.json) ensures 100% catalog availability offline or online.
 * 2. Secondary: Live MySQL integration syncs changes to relational tables whenever MySQL is active.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const BOOKS_FILE = path.join(__dirname, '..', 'data', 'books.json');
const CATEGORIES_FILE = path.join(__dirname, '..', 'data', 'categories.json');
const SHELVES_FILE = path.join(__dirname, '..', 'data', 'shelves.json');

/**
 * Load all books from storage
 */
function readBooksFromDisk() {
  try {
    if (fs.existsSync(BOOKS_FILE)) {
      const data = fs.readFileSync(BOOKS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading books storage:', err.message);
  }
  return [];
}

/**
 * Persist books to storage
 */
function writeBooksToDisk(books) {
  try {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing books storage:', err.message);
    return false;
  }
}

/**
 * Query books with filtering, searching, sorting, and pagination
 */
async function queryBooks(filters = {}) {
  const {
    search,
    category,
    author,
    available,
    shelf,
    floor,
    sort,
    page = 1,
    limit = 12,
  } = filters;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));

  // Try MySQL first if connected
  try {
    const conditions = ['1=1'];
    const params = [];

    if (search) {
      const term = `%${search.trim()}%`;
      conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.publisher LIKE ?)');
      params.push(term, term, term, term);
    }

    if (category) {
      if (/^\d+$/.test(category)) {
        conditions.push('b.category_id = ?');
        params.push(parseInt(category, 10));
      } else {
        conditions.push('c.name = ?');
        params.push(category.trim());
      }
    }

    if (author) {
      conditions.push('b.author LIKE ?');
      params.push(`%${author.trim()}%`);
    }

    if (available !== undefined && available !== '') {
      if (available === 'true' || available === '1') {
        conditions.push('b.available_copies > 0');
      } else if (available === 'false' || available === '0') {
        conditions.push('b.available_copies = 0');
      }
    }

    if (shelf) {
      if (/^\d+$/.test(shelf)) {
        conditions.push('b.shelf_id = ?');
        params.push(parseInt(shelf, 10));
      } else {
        conditions.push('s.shelf_code = ?');
        params.push(shelf.trim().toUpperCase());
      }
    }

    if (floor !== undefined && floor !== '') {
      conditions.push('s.floor = ?');
      params.push(parseInt(floor, 10));
    }

    const whereClause = conditions.join(' AND ');
    const offset = (currentPage - 1) * pageLimit;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       WHERE ${whereClause}`,
      params
    );

    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
         b.id, b.title, b.isbn, b.author, b.publisher, b.publication_year,
         b.category_id, b.shelf_id, b.total_copies, b.available_copies,
         (b.total_copies - b.available_copies) AS issued_copies,
         b.description, b.cover_image, b.price, b.created_at, b.updated_at,
         c.name AS category_name, c.icon AS category_icon,
         s.shelf_code, s.name AS shelf_name, s.floor, s.section
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       WHERE ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    if (rows && rows.length > 0) {
      return {
        books: rows,
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit) || 1,
      };
    }
  } catch (_) {
    // MySQL unavailable, proceed to JSON store
  }

  // Fallback: in-memory JSON filtering
  let books = readBooksFromDisk();

  // Search
  if (search) {
    const s = search.toLowerCase().trim();
    books = books.filter(
      (b) =>
        (b.title && b.title.toLowerCase().includes(s)) ||
        (b.author && b.author.toLowerCase().includes(s)) ||
        (b.isbn && b.isbn.replace(/[-\s]/g, '').includes(s.replace(/[-\s]/g, ''))) ||
        (b.publisher && b.publisher.toLowerCase().includes(s))
    );
  }

  // Category
  if (category) {
    const catStr = String(category).toLowerCase().trim();
    books = books.filter(
      (b) =>
        String(b.category_id) === catStr ||
        (b.category_name && b.category_name.toLowerCase() === catStr)
    );
  }

  // Author
  if (author) {
    const a = author.toLowerCase().trim();
    books = books.filter((b) => b.author && b.author.toLowerCase().includes(a));
  }

  // Available
  if (available !== undefined && available !== '') {
    const isAvail = available === 'true' || available === '1';
    books = books.filter((b) => (isAvail ? b.available_copies > 0 : b.available_copies === 0));
  }

  // Shelf
  if (shelf) {
    const shStr = String(shelf).toUpperCase().trim();
    books = books.filter(
      (b) =>
        String(b.shelf_id) === shStr ||
        (b.shelf_code && b.shelf_code.toUpperCase() === shStr)
    );
  }

  // Floor
  if (floor !== undefined && floor !== '') {
    const fl = parseInt(floor, 10);
    books = books.filter((b) => Number(b.floor) === fl);
  }

  // Sort
  if (sort === 'title_asc') {
    books.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sort === 'title_desc') {
    books.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  } else if (sort === 'price_asc') {
    books.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sort === 'price_desc') {
    books.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else {
    // Default newest first
    books.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  const total = books.length;
  const offset = (currentPage - 1) * pageLimit;
  const pagedBooks = books.slice(offset, offset + pageLimit);

  return {
    books: pagedBooks,
    total,
    page: currentPage,
    limit: pageLimit,
    totalPages: Math.ceil(total / pageLimit) || 1,
  };
}

/**
 * Get featured books
 */
async function getFeaturedBooks(limit = 8) {
  try {
    const [rows] = await pool.query(
      `SELECT 
         b.id, b.title, b.isbn, b.author, b.publisher, b.publication_year,
         b.category_id, b.shelf_id, b.total_copies, b.available_copies,
         (b.total_copies - b.available_copies) AS issued_copies,
         b.description, b.cover_image, b.price, b.created_at, b.updated_at,
         c.name AS category_name, c.icon AS category_icon,
         s.shelf_code, s.name AS shelf_name, s.floor, s.section
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       ORDER BY b.id DESC
       LIMIT ?`,
      [limit]
    );
    if (rows && rows.length > 0) return rows;
  } catch (_) {}

  const books = readBooksFromDisk();
  return books.slice(0, limit);
}

/**
 * Get recently added books
 */
async function getRecentBooks(limit = 10) {
  try {
    const [rows] = await pool.query(
      `SELECT 
         b.id, b.title, b.isbn, b.author, b.publisher, b.publication_year,
         b.category_id, b.shelf_id, b.total_copies, b.available_copies,
         (b.total_copies - b.available_copies) AS issued_copies,
         b.description, b.cover_image, b.price, b.created_at, b.updated_at,
         c.name AS category_name, c.icon AS category_icon,
         s.shelf_code, s.name AS shelf_name, s.floor, s.section
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       ORDER BY b.created_at DESC
       LIMIT ?`,
      [limit]
    );
    if (rows && rows.length > 0) return rows;
  } catch (_) {}

  const books = readBooksFromDisk();
  return [...books]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, limit);
}

/**
 * Get book statistics
 */
async function getBookStats() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_titles,
        COALESCE(SUM(total_copies), 0) AS total_books,
        COALESCE(SUM(available_copies), 0) AS available_books,
        COALESCE(SUM(total_copies - available_copies), 0) AS issued_books
      FROM books
    `);
    if (rows && rows[0] && rows[0].total_titles > 0) {
      return {
        totalTitles: Number(rows[0].total_titles),
        totalBooks: Number(rows[0].total_books),
        availableBooks: Number(rows[0].available_books),
        issuedBooks: Number(rows[0].issued_books),
      };
    }
  } catch (_) {}

  const books = readBooksFromDisk();
  const totalTitles = books.length;
  const totalBooks = books.reduce((sum, b) => sum + (Number(b.total_copies) || 0), 0);
  const availableBooks = books.reduce((sum, b) => sum + (Number(b.available_copies) || 0), 0);
  const issuedBooks = totalBooks - availableBooks;

  return {
    totalTitles,
    totalBooks,
    availableBooks,
    issuedBooks,
  };
}

/**
 * Get single book by ID or ISBN
 */
async function getBookById(idOrIsbn) {
  try {
    const [rows] = await pool.query(
      `SELECT 
         b.id, b.title, b.isbn, b.author, b.publisher, b.publication_year,
         b.category_id, b.shelf_id, b.total_copies, b.available_copies,
         (b.total_copies - b.available_copies) AS issued_copies,
         b.description, b.cover_image, b.price, b.created_at, b.updated_at,
         c.name AS category_name, c.icon AS category_icon,
         s.shelf_code, s.name AS shelf_name, s.floor, s.section
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       WHERE b.id = ? OR b.isbn = ?`,
      [idOrIsbn, idOrIsbn]
    );
    if (rows && rows.length > 0) return rows[0];
  } catch (_) {}

  const books = readBooksFromDisk();
  const clean = String(idOrIsbn).replace(/[-\s]/g, '').toLowerCase();
  return (
    books.find(
      (b) =>
        String(b.id) === String(idOrIsbn) ||
        String(b.isbn).replace(/[-\s]/g, '').toLowerCase() === clean
    ) || null
  );
}

/**
 * Get related books in same category
 */
async function getRelatedBooks(bookId, limit = 6) {
  const current = await getBookById(bookId);
  if (!current) return [];

  try {
    const [rows] = await pool.query(
      `SELECT 
         b.id, b.title, b.isbn, b.author, b.publisher, b.publication_year,
         b.category_id, b.shelf_id, b.total_copies, b.available_copies,
         (b.total_copies - b.available_copies) AS issued_copies,
         b.description, b.cover_image, b.price, b.created_at, b.updated_at,
         c.name AS category_name, c.icon AS category_icon,
         s.shelf_code, s.name AS shelf_name, s.floor, s.section
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN shelves s ON b.shelf_id = s.id
       WHERE b.category_id = ? AND b.id != ?
       LIMIT ?`,
      [current.category_id, current.id, limit]
    );
    if (rows && rows.length > 0) return rows;
  } catch (_) {}

  const books = readBooksFromDisk();
  return books
    .filter(
      (b) =>
        String(b.id) !== String(current.id) &&
        (b.category_id === current.category_id ||
          b.category_name === current.category_name)
    )
    .slice(0, limit);
}

/**
 * Add a new book to the backend
 */
async function createBook(bookData) {
  const { addBook } = require('../scripts/add-book');
  return await addBook(bookData);
}

/**
 * Update an existing book
 */
async function updateBook(id, updateData) {
  const books = readBooksFromDisk();
  const idx = books.findIndex((b) => String(b.id) === String(id));
  if (idx === -1) {
    throw new Error('Book not found');
  }

  const existing = books[idx];
  const newTotal =
    updateData.total_copies !== undefined
      ? parseInt(updateData.total_copies, 10)
      : existing.total_copies;
  let newAvailable =
    updateData.available_copies !== undefined
      ? parseInt(updateData.available_copies, 10)
      : existing.available_copies;

  if (updateData.total_copies !== undefined && updateData.available_copies === undefined) {
    const diff = newTotal - existing.total_copies;
    newAvailable = Math.max(0, existing.available_copies + diff);
  }

  const updatedBook = {
    ...existing,
    ...updateData,
    id: existing.id,
    total_copies: newTotal,
    available_copies: newAvailable,
    issued_copies: newTotal - newAvailable,
    updated_at: new Date().toISOString(),
  };

  books[idx] = updatedBook;
  writeBooksToDisk(books);

  // Sync to MySQL if available
  try {
    await pool.query(
      `UPDATE books SET
        title = COALESCE(?, title),
        isbn = COALESCE(?, isbn),
        author = COALESCE(?, author),
        publisher = COALESCE(?, publisher),
        publication_year = COALESCE(?, publication_year),
        category_id = COALESCE(?, category_id),
        shelf_id = COALESCE(?, shelf_id),
        total_copies = ?,
        available_copies = ?,
        description = COALESCE(?, description),
        cover_image = COALESCE(?, cover_image),
        price = COALESCE(?, price)
       WHERE id = ?`,
      [
        updateData.title || null,
        updateData.isbn || null,
        updateData.author || null,
        updateData.publisher || null,
        updateData.publication_year || null,
        updateData.category_id || null,
        updateData.shelf_id || null,
        newTotal,
        newAvailable,
        updateData.description || null,
        updateData.cover_image || null,
        updateData.price !== undefined ? parseFloat(updateData.price) : null,
        id,
      ]
    );
  } catch (_) {}

  return updatedBook;
}

/**
 * Delete a book by ID
 */
async function deleteBook(id) {
  const books = readBooksFromDisk();
  const idx = books.findIndex((b) => String(b.id) === String(id));
  if (idx === -1) {
    throw new Error('Book not found');
  }

  const removed = books.splice(idx, 1)[0];
  writeBooksToDisk(books);

  try {
    await pool.query('DELETE FROM books WHERE id = ?', [id]);
  } catch (_) {}

  return removed;
}

module.exports = {
  readBooksFromDisk,
  writeBooksToDisk,
  queryBooks,
  getFeaturedBooks,
  getRecentBooks,
  getBookStats,
  getBookById,
  getRelatedBooks,
  createBook,
  updateBook,
  deleteBook,
};

