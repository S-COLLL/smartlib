const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'smartlib',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: (process.env.LIBRARY_TIMEZONE && process.env.LIBRARY_TIMEZONE.includes('/')) ? '+05:30' : (process.env.LIBRARY_TIMEZONE || '+05:30'),
  decimalNumbers: true,
});

async function initTables() {
  const connection = await pool.getConnection();
  try {
    // 1. Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'librarian', 'member') NOT NULL DEFAULT 'member',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Members table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NULL,
        membership_number VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        phone VARCHAR(50) NULL,
        department VARCHAR(100) NULL,
        course VARCHAR(100) NULL,
        year VARCHAR(50) NULL,
        status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT NULL,
        icon VARCHAR(50) DEFAULT '📚',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Shelves table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shelves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shelf_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        floor INT NOT NULL DEFAULT 1,
        section VARCHAR(100) NOT NULL DEFAULT 'General',
        capacity INT NOT NULL DEFAULT 100,
        occupied INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Books table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        isbn VARCHAR(30) UNIQUE NOT NULL,
        author VARCHAR(150) NOT NULL,
        publisher VARCHAR(150) NULL,
        publication_year INT NULL,
        category_id INT NULL,
        shelf_id INT NULL,
        total_copies INT NOT NULL DEFAULT 1,
        available_copies INT NOT NULL DEFAULT 1,
        description TEXT NULL,
        cover_image VARCHAR(500) NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Loans table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        member_id INT NOT NULL,
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        return_date DATE NULL,
        status ENUM('issued', 'returned', 'overdue') NOT NULL DEFAULT 'issued',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Reservations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        member_id INT NOT NULL,
        reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        queue_position INT NOT NULL DEFAULT 1,
        status ENUM('pending', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Fines table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS fines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        loan_id INT NULL,
        member_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status ENUM('unpaid', 'paid', 'waived') NOT NULL DEFAULT 'unpaid',
        paid_date TIMESTAMP NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Default admin user check
    const [existingUsers] = await connection.query('SELECT id FROM users LIMIT 1');
    if (existingUsers.length === 0) {
      const defaultHash = await bcrypt.hash('Admin@123', 10);
      await connection.query(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
        ['Admin User', 'admin@smartlib.com', defaultHash, 'admin', 1]
      );
      console.log('Default admin user created: admin@smartlib.com / Admin@123');
    }
  } finally {
    connection.release();
  }
}

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Connected successfully');
    connection.release();
    await initTables();
    console.log('MySQL Schema verified / initialized');
    return true;
  } catch (error) {
    console.error('MySQL Connection Error:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
};
