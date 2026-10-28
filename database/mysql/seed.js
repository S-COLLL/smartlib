/**
 * ============================================================================
 * SMARTLIB — MySQL Database Seed Script
 * ============================================================================
 * WARNING: DEVELOPMENT-ONLY SEED DATA — DO NOT RUN IN PRODUCTION!
 *
 * This script initializes the smartlib MySQL database:
 * 1. Executes schema.sql (tables, indexes, foreign keys, triggers/constraints)
 * 2. Seeds initial administrative, librarian, and member users with bcrypt hashes
 * 3. Seeds library classifications, physical shelf layout, books catalog
 * 4. Seeds sample circulation transactions (loans, reservations, fines, payments)
 *
 * Usage:
 *   npm run seed:mysql
 *   or: node database/mysql/seed.js
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10),
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : (process.env.DB_PASSWORD || ''),
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'smartlib',
  multipleStatements: true,
  charset: 'utf8mb4'
};

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Utility helper to format a Date into MySQL 'YYYY-MM-DD' format
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Utility helper to format a Date into MySQL 'YYYY-MM-DD HH:mm:ss' format
 */
function formatDateTime(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Shift current date by +/- days
 */
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function runSeed() {
  console.log('------------------------------------------------------------');
  console.log('🚀 SMARTLIB — Starting MySQL Database Initialization & Seed');
  console.log('------------------------------------------------------------');
  console.log(`Connecting to MySQL at ${DB_CONFIG.host}:${DB_CONFIG.port} as user "${DB_CONFIG.user}"...`);

  // Step 1: Connect to server without specific database to ensure CREATE DATABASE works
  const initialConnection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at path: ${schemaPath}`);
    }

    console.log(`📖 Reading schema file from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚙️  Executing schema.sql multi-statement script...');
    await initialConnection.query(schemaSql);
    console.log('✅ Schema tables, constraints, and indexes created successfully.');
  } finally {
    await initialConnection.end();
  }

  // Step 2: Connect directly to the created smartlib database for seed data insertion
  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    console.log('\n🔒 Hashing default passwords with bcrypt...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', BCRYPT_SALT_ROUNDS);
    const librarianPasswordHash = await bcrypt.hash('Librarian@123', BCRYPT_SALT_ROUNDS);
    const memberPasswordHash = await bcrypt.hash('Member@123', BCRYPT_SALT_ROUNDS);

    // ------------------------------------------------------------------------
    // 1. SEED USERS
    // ------------------------------------------------------------------------
    console.log('👤 Seeding users (Admin, Librarian, Members)...');
    const usersData = [
      ['Admin User', 'admin@smartlib.com', adminPasswordHash, 'admin', null, true],
      ['Sarah Johnson', 'librarian@smartlib.com', librarianPasswordHash, 'librarian', null, true],
      ['Rahul Sharma', 'rahul.sharma@example.com', memberPasswordHash, 'member', null, true],
      ['Priya Patel', 'priya.patel@example.com', memberPasswordHash, 'member', null, true],
      ['Amit Kumar', 'amit.kumar@example.com', memberPasswordHash, 'member', null, true],
      ['Sneha Reddy', 'sneha.reddy@example.com', memberPasswordHash, 'member', null, true],
      ['Vikram Singh', 'vikram.singh@example.com', memberPasswordHash, 'member', null, true]
    ];

    const [userInsertResult] = await connection.query(
      `INSERT INTO users (name, email, password_hash, role, avatar, is_active) VALUES ?`,
      [usersData]
    );
    console.log(`   ✓ Inserted ${userInsertResult.affectedRows} users.`);

    // Map inserted user IDs by email for referential safety
    const [userRows] = await connection.query(`SELECT user_id, email, name, role FROM users`);
    const userMap = {};
    for (const u of userRows) {
      userMap[u.email] = u;
    }

    const librarianUserId = userMap['librarian@smartlib.com'].user_id;

    // ------------------------------------------------------------------------
    // 2. SEED MEMBERS
    // ------------------------------------------------------------------------
    console.log('💳 Seeding member profiles...');
    const membersData = [
      [
        userMap['rahul.sharma@example.com'].user_id,
        'SL-2024-001',
        '+91 98765 43210',
        '123 MG Road, Indiranagar, Bengaluru, Karnataka 560038',
        formatDate(addDays(-180)),
        'active'
      ],
      [
        userMap['priya.patel@example.com'].user_id,
        'SL-2024-002',
        '+91 98765 43211',
        '456 SG Highway, Satellite, Ahmedabad, Gujarat 380015',
        formatDate(addDays(-120)),
        'active'
      ],
      [
        userMap['amit.kumar@example.com'].user_id,
        'SL-2024-003',
        '+91 98765 43212',
        '789 Park Street, Central Kolkata, West Bengal 700016',
        formatDate(addDays(-90)),
        'active'
      ],
      [
        userMap['sneha.reddy@example.com'].user_id,
        'SL-2024-004',
        '+91 98765 43213',
        '101 Jubilee Hills, Road No. 36, Hyderabad, Telangana 500033',
        formatDate(addDays(-60)),
        'active'
      ],
      [
        userMap['vikram.singh@example.com'].user_id,
        'SL-2024-005',
        '+91 98765 43214',
        '202 Civil Lines, Sansar Chandra Road, Jaipur, Rajasthan 302006',
        formatDate(addDays(-45)),
        'active'
      ]
    ];

    const [memberInsertResult] = await connection.query(
      `INSERT INTO members (user_id, membership_number, phone, address, joined_at, membership_status) VALUES ?`,
      [membersData]
    );
    console.log(`   ✓ Inserted ${memberInsertResult.affectedRows} members.`);

    const [memberRows] = await connection.query(`SELECT member_id, user_id, membership_number FROM members`);
    const memberMap = {};
    for (const m of memberRows) {
      memberMap[m.membership_number] = m;
    }

    // ------------------------------------------------------------------------
    // 3. SEED CATEGORIES
    // ------------------------------------------------------------------------
    console.log('📂 Seeding 8 book categories...');
    const categoriesData = [
      ['Fiction', 'Novels, literary narrative fiction, and story anthologies', 'book-open'],
      ['Non-Fiction', 'Biographies, memoirs, essays, and factual treatises', 'compass'],
      ['Science & Technology', 'Physics, cosmology, biology, and applied modern sciences', 'cpu'],
      ['Computer Science', 'Software engineering, algorithms, programming, and architecture', 'terminal'],
      ['History', 'World history, civilizations, ancient records, and socio-political events', 'landmark'],
      ['Philosophy', 'Ethics, moral philosophy, logic, epistemology, and stoicism', 'feather'],
      ['Mathematics', 'Pure and applied mathematics, discrete math, statistics, and analysis', 'percent'],
      ['Literature', 'Classical literature, poetry, Shakespearean drama, and critical literary works', 'award']
    ];

    const [catInsertResult] = await connection.query(
      `INSERT INTO categories (category_name, description, icon) VALUES ?`,
      [categoriesData]
    );
    console.log(`   ✓ Inserted ${catInsertResult.affectedRows} categories.`);

    const [catRows] = await connection.query(`SELECT category_id, category_name FROM categories`);
    const categoryMap = {};
    for (const c of catRows) {
      categoryMap[c.category_name] = c.category_id;
    }

    // ------------------------------------------------------------------------
    // 4. SEED SHELVES (13 Shelves across 3 Floors)
    // ------------------------------------------------------------------------
    console.log('🏛️  Seeding 13 library physical shelves across 3 floors...');
    const shelvesData = [
      // Floor 1: General & Computer Science
      [1, 'A', 'General Reading & Fiction', 1, 1, 50, 'Ground floor front aisle near entrance', 10.50, 20.00],
      [1, 'A', 'General Reading & Fiction', 1, 2, 50, 'Ground floor front aisle second tier', 10.50, 25.00],
      [1, 'B', 'Computer Science & Software', 1, 1, 60, 'Ground floor tech hub east wing', 30.00, 20.00],
      [1, 'B', 'Computer Science & Software', 1, 2, 60, 'Ground floor tech hub east wing', 30.00, 25.00],
      [1, 'B', 'Computer Science & Software', 2, 1, 60, 'Ground floor tech hub north aisle', 35.00, 20.00],
      // Floor 2: Science & History
      [2, 'C', 'Pure & Applied Sciences', 1, 1, 50, 'Second floor science corner', 15.00, 40.00],
      [2, 'C', 'Pure & Applied Sciences', 1, 2, 50, 'Second floor research aisle', 15.00, 45.00],
      [2, 'D', 'World History & Civilizations', 1, 1, 40, 'Second floor archives section', 45.00, 40.00],
      [2, 'D', 'World History & Civilizations', 1, 2, 40, 'Second floor historical records', 45.00, 45.00],
      // Floor 3: Literature & Philosophy
      [3, 'E', 'Classical Literature & Poetry', 1, 1, 45, 'Third floor quiet study hall', 20.00, 60.00],
      [3, 'E', 'Classical Literature & Poetry', 1, 2, 45, 'Third floor classics alcove', 20.00, 65.00],
      [3, 'F', 'Philosophy & Ethics', 1, 1, 35, 'Third floor humanities study bay', 50.00, 60.00],
      [3, 'F', 'Philosophy & Ethics', 1, 2, 35, 'Third floor humanities study bay', 50.00, 65.00]
    ];

    const [shelfInsertResult] = await connection.query(
      `INSERT INTO shelves (floor, section, section_name, rack_number, shelf_number, capacity, notes, map_x, map_y) VALUES ?`,
      [shelvesData]
    );
    console.log(`   ✓ Inserted ${shelfInsertResult.affectedRows} shelves.`);

    const [shelfRows] = await connection.query(`SELECT shelf_id, floor, section, rack_number, shelf_number FROM shelves`);
    const shelfMap = {};
    for (const s of shelfRows) {
      shelfMap[`${s.floor}-${s.section}-${s.rack_number}-${s.shelf_number}`] = s.shelf_id;
    }

    // ------------------------------------------------------------------------
    // 5. SEED BOOKS (16 comprehensive titles)
    // ------------------------------------------------------------------------
    console.log('📚 Seeding 16 catalog books with full metadata...');
    const booksData = [
      [
        'Clean Code: A Handbook of Agile Software Craftsmanship',
        'Robert C. Martin',
        '978-0132350884',
        categoryMap['Computer Science'],
        'Prentice Hall',
        2008,
        5,
        3, // 1 on active loan, 1 reserved
        shelfMap['1-B-1-1'],
        'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=500',
        'Even bad code can function. But if code isn\'t clean, it can bring a development organization to its knees. Learn how to write agile, testable, and maintainable software.',
        'English',
        464
      ],
      [
        'Design Patterns: Elements of Reusable Object-Oriented Software',
        'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
        '978-0201633610',
        categoryMap['Computer Science'],
        'Addison-Wesley Professional',
        1994,
        4,
        3,
        shelfMap['1-B-1-2'],
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500',
        'Capturing a wealth of experience about the design of object-oriented software, four top-notch designers present a catalog of simple and succinct solutions to commonly occurring design problems.',
        'English',
        395
      ],
      [
        'Introduction to Algorithms',
        'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
        '978-0262033848',
        categoryMap['Computer Science'],
        'MIT Press',
        2009,
        6,
        5,
        shelfMap['1-B-2-1'],
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
        'A comprehensive update of the leading algorithms text, with new material on trees, dynamic programming, greedy algorithms, and flow networks.',
        'English',
        1312
      ],
      [
        'The Great Gatsby',
        'F. Scott Fitzgerald',
        '978-0743273565',
        categoryMap['Literature'],
        'Charles Scribner\'s Sons',
        1925,
        4,
        2, // 1 on overdue loan, 1 reserved
        shelfMap['3-E-1-1'],
        'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500',
        'The story of the mysteriously wealthy Jay Gatsby and his unrequited love for Daisy Buchanan set against the glitz and disillusionment of the Roaring Twenties.',
        'English',
        180
      ],
      [
        'Sapiens: A Brief History of Humankind',
        'Yuval Noah Harari',
        '978-0062316097',
        categoryMap['History'],
        'Harper',
        2014,
        5,
        4, // 1 on active loan
        shelfMap['2-D-1-1'],
        'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=500',
        'A landmark narrative exploring how biology and history have defined humans and enhanced our understanding of what it means to be human.',
        'English',
        443
      ],
      [
        'A Brief History of Time',
        'Stephen Hawking',
        '978-0553380163',
        categoryMap['Science & Technology'],
        'Bantam Books',
        1988,
        4,
        3,
        shelfMap['2-C-1-1'],
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500',
        'Stephen Hawking explores the most profound questions about the universe: How did the universe begin? What is the nature of black holes and the arrow of time?',
        'English',
        212
      ],
      [
        'The Art of War',
        'Sun Tzu',
        '978-1590302255',
        categoryMap['Philosophy'],
        'Shambhala',
        2005,
        3,
        2,
        shelfMap['3-F-1-1'],
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500',
        'An ancient Chinese military treatise dating from the Spring and Autumn Period. Its lessons remain the definitive foundation for strategic thinking worldwide.',
        'English',
        176
      ],
      [
        'Pride and Prejudice',
        'Jane Austen',
        '978-0141439518',
        categoryMap['Literature'],
        'T. Egerton',
        1813,
        4,
        4,
        shelfMap['3-E-1-2'],
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500',
        'The romantic clash between the opinionated Elizabeth Bennet and her proud beau, Mr. Darcy, celebrating the triumph of mutual understanding.',
        'English',
        432
      ],
      [
        'The Alchemist',
        'Paulo Coelho',
        '978-0062315007',
        categoryMap['Fiction'],
        'HarperTorch',
        1988,
        5,
        4,
        shelfMap['1-A-1-1'],
        'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=500',
        'An inspiring fable following an Andalusian shepherd boy named Santiago who journeys through Egypt in search of worldly treasure and spiritual wisdom.',
        'English',
        208
      ],
      [
        '1984',
        'George Orwell',
        '978-0451524935',
        categoryMap['Fiction'],
        'Secker & Warburg',
        1949,
        6,
        4,
        shelfMap['1-A-1-2'],
        'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=500',
        'The definitive dystopian novel examining totalitarianism, mass surveillance, and the complete suppression of individuality by Big Brother and the Party.',
        'English',
        328
      ],
      [
        'To Kill a Mockingbird',
        'Harper Lee',
        '978-0060935467',
        categoryMap['Fiction'],
        'J. B. Lippincott & Co.',
        1960,
        4,
        3,
        shelfMap['1-A-1-1'],
        'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=500',
        'Atticus Finch defends a falsely accused Black man in depression-era Alabama, illustrating the timeless moral courage required to conquer racial prejudice.',
        'English',
        281
      ],
      [
        'Thinking, Fast and Slow',
        'Daniel Kahneman',
        '978-0374533557',
        categoryMap['Non-Fiction'],
        'Farrar, Straus and Giroux',
        2011,
        5,
        4,
        shelfMap['2-C-1-2'],
        'https://images.unsplash.com/photo-1507842229451-9f7ea71a8069?w=500',
        'Nobel laureate Daniel Kahneman explains the two cognitive systems driving human decisions: intuitive System 1 and deliberate System 2.',
        'English',
        499
      ],
      [
        'The Pragmatic Programmer: Your Journey To Mastery',
        'Andrew Hunt, David Thomas',
        '978-0135957059',
        categoryMap['Computer Science'],
        'Addison-Wesley Professional',
        2019,
        5,
        4, // 1 on overdue loan
        shelfMap['1-B-2-1'],
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500',
        'Straight from the trenches of development, this 20th Anniversary Edition illustrates core principles of software craftsmanship and modular architecture.',
        'English',
        352
      ],
      [
        'Structure and Interpretation of Computer Programs',
        'Harold Abelson, Gerald Jay Sussman',
        '978-0262510875',
        categoryMap['Computer Science'],
        'MIT Press',
        1996,
        3,
        3,
        shelfMap['1-B-1-2'],
        'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500',
        'The legendary SICP textbook teaching foundational computational abstractions, procedural decomposition, and interpreter construction in Scheme.',
        'English',
        657
      ],
      [
        'Meditations',
        'Marcus Aurelius',
        '978-0812968255',
        categoryMap['Philosophy'],
        'Modern Library',
        2002,
        4,
        3,
        shelfMap['3-F-1-2'],
        'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=500',
        'Private personal reflections and journal entries of the Roman Emperor Marcus Aurelius detailing Stoic discipline, resilience, and ethical self-mastery.',
        'English',
        256
      ],
      [
        'Principles of Mathematical Analysis',
        'Walter Rudin',
        '978-0070542358',
        categoryMap['Mathematics'],
        'McGraw-Hill',
        1976,
        3,
        3,
        shelfMap['2-C-1-1'],
        'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=500',
        'The gold standard reference in mathematical analysis covering topological spaces, series convergence, Riemann-Stieltjes integrals, and multivariable calculus.',
        'English',
        342
      ]
    ];

    const [bookInsertResult] = await connection.query(
      `INSERT INTO books 
      (title, author, isbn, category_id, publisher, publication_year, total_copies, available_copies, shelf_id, cover_image, description, language, pages) 
      VALUES ?`,
      [booksData]
    );
    console.log(`   ✓ Inserted ${bookInsertResult.affectedRows} books.`);

    const [bookRows] = await connection.query(`SELECT book_id, title, isbn FROM books`);
    const bookMap = {};
    for (const b of bookRows) {
      bookMap[b.title] = b.book_id;
    }

    // ------------------------------------------------------------------------
    // 6. SEED LOANS (5 sample circulation transactions)
    // ------------------------------------------------------------------------
    console.log('🔄 Seeding 5 sample book loans (Issued, Returned, Overdue)...');
    const loansData = [
      // Loan 1: Clean Code to Rahul Sharma (Active Issued)
      [
        bookMap['Clean Code: A Handbook of Agile Software Craftsmanship'],
        memberMap['SL-2024-001'].member_id,
        librarianUserId,
        formatDate(addDays(-10)),
        formatDate(addDays(4)),
        null,
        'issued',
        'Checked out for academic semester coursework'
      ],
      // Loan 2: 1984 to Priya Patel (Successfully Returned)
      [
        bookMap['1984'],
        memberMap['SL-2024-002'].member_id,
        librarianUserId,
        formatDate(addDays(-30)),
        formatDate(addDays(-16)),
        formatDate(addDays(-15)),
        'returned',
        'Returned in excellent condition'
      ],
      // Loan 3: The Great Gatsby to Amit Kumar (Overdue by 11 days)
      [
        bookMap['The Great Gatsby'],
        memberMap['SL-2024-003'].member_id,
        librarianUserId,
        formatDate(addDays(-25)),
        formatDate(addDays(-11)),
        null,
        'overdue',
        'Automatic overdue alert sent to member email'
      ],
      // Loan 4: Sapiens to Sneha Reddy (Active Issued)
      [
        bookMap['Sapiens: A Brief History of Humankind'],
        memberMap['SL-2024-004'].member_id,
        librarianUserId,
        formatDate(addDays(-5)),
        formatDate(addDays(9)),
        null,
        'issued',
        'Standard 14-day checkout loan'
      ],
      // Loan 5: The Pragmatic Programmer to Vikram Singh (Overdue by 21 days)
      [
        bookMap['The Pragmatic Programmer: Your Journey To Mastery'],
        memberMap['SL-2024-005'].member_id,
        librarianUserId,
        formatDate(addDays(-35)),
        formatDate(addDays(-21)),
        null,
        'overdue',
        'Overdue fine assessed per day policy'
      ]
    ];

    const [loanInsertResult] = await connection.query(
      `INSERT INTO loans (book_id, member_id, issued_by, issue_date, due_date, return_date, status, notes) VALUES ?`,
      [loansData]
    );
    console.log(`   ✓ Inserted ${loanInsertResult.affectedRows} loans.`);

    const [loanRows] = await connection.query(`SELECT loan_id, member_id, status FROM loans ORDER BY loan_id ASC`);

    // ------------------------------------------------------------------------
    // 7. SEED RESERVATIONS (3 sample holds)
    // ------------------------------------------------------------------------
    console.log('📌 Seeding 3 sample book reservations...');
    const reservationsData = [
      // Pending hold 1: Priya Patel holds Clean Code
      [
        bookMap['Clean Code: A Handbook of Agile Software Craftsmanship'],
        memberMap['SL-2024-002'].member_id,
        formatDateTime(addDays(-2)),
        'pending',
        1,
        formatDate(addDays(7)),
        null
      ],
      // Pending hold 2: Sneha Reddy holds The Great Gatsby
      [
        bookMap['The Great Gatsby'],
        memberMap['SL-2024-004'].member_id,
        formatDateTime(addDays(-1)),
        'pending',
        1,
        formatDate(addDays(7)),
        null
      ],
      // Fulfilled hold 3: Rahul Sharma fulfilled reservation on 1984
      [
        bookMap['1984'],
        memberMap['SL-2024-001'].member_id,
        formatDateTime(addDays(-35)),
        'fulfilled',
        null,
        formatDate(addDays(-30)),
        formatDateTime(addDays(-30))
      ]
    ];

    const [resInsertResult] = await connection.query(
      `INSERT INTO reservations (book_id, member_id, reservation_date, status, queue_position, expiry_date, fulfilled_at) VALUES ?`,
      [reservationsData]
    );
    console.log(`   ✓ Inserted ${resInsertResult.affectedRows} reservations.`);

    // ------------------------------------------------------------------------
    // 8. SEED FINES (2 sample overdue fines)
    // ------------------------------------------------------------------------
    console.log('💰 Seeding 2 overdue fines...');
    const overdueLoan1 = loanRows.find(l => l.loan_id === 3); // Amit Kumar - Great Gatsby
    const overdueLoan2 = loanRows.find(l => l.loan_id === 5); // Vikram Singh - Pragmatic Programmer

    const finesData = [
      // Fine 1: Amit Kumar - 11 days overdue * ₹2.00/day = ₹22.00 unpaid
      [
        overdueLoan1.loan_id,
        overdueLoan1.member_id,
        22.00,
        0.00,
        'unpaid',
        formatDateTime(addDays(-11)),
        null,
        'Overdue penalty for 11 days past due date'
      ],
      // Fine 2: Vikram Singh - 21 days overdue * ₹2.00/day + administrative fee = ₹50.00 (₹50 paid)
      [
        overdueLoan2.loan_id,
        overdueLoan2.member_id,
        50.00,
        50.00,
        'paid',
        formatDateTime(addDays(-21)),
        formatDateTime(addDays(-2)),
        'Settled fine at library circulation counter'
      ]
    ];

    const [fineInsertResult] = await connection.query(
      `INSERT INTO fines (loan_id, member_id, amount, paid_amount, status, assessed_at, paid_at, notes) VALUES ?`,
      [finesData]
    );
    console.log(`   ✓ Inserted ${fineInsertResult.affectedRows} fines.`);

    // ------------------------------------------------------------------------
    // 9. SEED FINE PAYMENTS
    // ------------------------------------------------------------------------
    console.log('🧾 Seeding fine payment receipt...');
    const [fineRows] = await connection.query(`SELECT fine_id, status FROM fines WHERE status = 'paid'`);
    const paidFineId = fineRows[0].fine_id;

    await connection.query(
      `INSERT INTO fine_payments (fine_id, amount, payment_date, payment_method, received_by, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paidFineId, 50.00, formatDateTime(addDays(-2)), 'UPI', librarianUserId, 'Digital UPI payment confirmed via counter QR']
    );
    console.log('   ✓ Inserted 1 fine payment record.');

    console.log('------------------------------------------------------------');
    console.log('🎉 SMARTLIB — MySQL Database Seed Completed Successfully!');
    console.log('------------------------------------------------------------');
    console.log('Summary of Seeded Data:');
    console.log(` • Users:        ${usersData.length} (1 Admin, 1 Librarian, 5 Members)`);
    console.log(` • Members:      ${membersData.length} Active Profiles`);
    console.log(` • Categories:   ${categoriesData.length} Subjects`);
    console.log(` • Shelves:      ${shelvesData.length} Physical Shelves across 3 Floors`);
    console.log(` • Books:        ${booksData.length} Titles`);
    console.log(` • Loans:        ${loansData.length} Circulation Records (Issued, Returned, Overdue)`);
    console.log(` • Reservations: ${reservationsData.length} Reservation Queue Records`);
    console.log(` • Fines:        ${finesData.length} Overdue Assessments`);
    console.log(` • Payments:     1 Payment Transaction Recorded`);
    console.log('------------------------------------------------------------');
    console.log('🔐 Login Credentials (Development Only):');
    console.log('   Admin:     admin@smartlib.com     / Admin@123');
    console.log('   Librarian: librarian@smartlib.com / Librarian@123');
    console.log('   Member:    rahul.sharma@example.com / Member@123');
    console.log('------------------------------------------------------------\n');

  } catch (err) {
    console.error('❌ Error during MySQL seeding:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Execute the seed script
runSeed().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
