/**
 * SMARTLIB - Dedicated MySQL Book Seeding Script
 * Inserts all 45 curated books into the MySQL database tables.
 *
 * Usage:
 *   node database/mysql/seed-books.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : '',
  database: process.env.MYSQL_DATABASE || 'smartlib',
};

async function seedMySQLBooks() {
  console.log('----------------------------------------------------');
  console.log('📚 SMARTLIB — Seeding Books into MySQL Database');
  console.log(`Connecting to MySQL database "${DB_CONFIG.database}" at ${DB_CONFIG.host}:${DB_CONFIG.port}...`);

  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL database successfully.');

    const booksFile = path.resolve(__dirname, '../../backend/data/books.json');
    if (!fs.existsSync(booksFile)) {
      throw new Error(`Books file not found at ${booksFile}`);
    }

    const books = JSON.parse(fs.readFileSync(booksFile, 'utf8'));
    console.log(`Found ${books.length} books in backend repository.`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const book of books) {
      try {
        const [result] = await connection.query(
          `INSERT INTO books 
           (id, title, isbn, author, publisher, publication_year, category_id, shelf_id, total_copies, available_copies, description, cover_image, price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             title = VALUES(title),
             author = VALUES(author),
             publisher = VALUES(publisher),
             publication_year = VALUES(publication_year),
             total_copies = VALUES(total_copies),
             available_copies = VALUES(available_copies),
             description = VALUES(description),
             cover_image = VALUES(cover_image),
             price = VALUES(price)`,
          [
            book.id,
            book.title,
            book.isbn,
            book.author,
            book.publisher,
            book.publication_year,
            book.category_id,
            book.shelf_id,
            book.total_copies,
            book.available_copies,
            book.description,
            book.cover_image,
            book.price,
          ]
        );

        if (result.affectedRows === 1) insertedCount++;
        else if (result.affectedRows === 2) updatedCount++;
      } catch (err) {
        console.warn(`⚠️  Could not insert book "${book.title}":`, err.message);
      }
    }

    console.log(`✅ Finished seeding books: ${insertedCount} inserted, ${updatedCount} updated.`);
    console.log('----------------------------------------------------');
  } catch (error) {
    console.warn('⚠️  MySQL Connection Note:', error.message);
    console.log('   (Books remain 100% available via backend JSON repository at backend/data/books.json)');
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  seedMySQLBooks();
}

module.exports = { seedMySQLBooks };

