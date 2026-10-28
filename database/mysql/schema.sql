-- ============================================================================
-- SMARTLIB — Library Management System
-- Complete MySQL Relational Database Schema
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci | Engine: InnoDB
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smartlib CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartlib;

-- Safely disable foreign key checks during schema creation/reset
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Drop existing tables in reverse dependency order
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS fine_payments;
DROP TABLE IF EXISTS fines;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS shelves;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. USERS TABLE
-- Authentication & Authorization table for Admin, Librarians, and Members
-- ============================================================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'librarian', 'member') NOT NULL DEFAULT 'member',
    avatar VARCHAR(500) DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. MEMBERS TABLE
-- Extended member profiles linked 1:1 with users
-- ============================================================================
CREATE TABLE members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    membership_number VARCHAR(20) NOT NULL UNIQUE,
    phone VARCHAR(20) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    joined_at DATE NOT NULL DEFAULT (CURRENT_DATE),
    membership_status ENUM('active', 'suspended', 'expired') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    INDEX idx_members_membership_number (membership_number),
    INDEX idx_members_status (membership_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. CATEGORIES TABLE
-- Book genres and subject classifications
-- ============================================================================
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    icon VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. SHELVES TABLE
-- Physical library shelving locations mapped to floors, sections, and coordinates
-- ============================================================================
CREATE TABLE shelves (
    shelf_id INT AUTO_INCREMENT PRIMARY KEY,
    floor INT NOT NULL,
    section VARCHAR(10) NOT NULL,
    section_name VARCHAR(100) DEFAULT NULL,
    rack_number INT NOT NULL,
    shelf_number INT NOT NULL,
    capacity INT NOT NULL DEFAULT 50,
    notes TEXT DEFAULT NULL,
    map_x DECIMAL(5,2) DEFAULT NULL,
    map_y DECIMAL(5,2) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_shelf_location UNIQUE (floor, section, rack_number, shelf_number),
    INDEX idx_shelves_floor_section (floor, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. BOOKS TABLE
-- Library catalog inventory with real-time copy counts and physical shelf placement
-- ============================================================================
CREATE TABLE books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(300) NOT NULL,
    isbn VARCHAR(20) DEFAULT NULL UNIQUE,
    category_id INT DEFAULT NULL,
    publisher VARCHAR(300) DEFAULT NULL,
    publication_year INT DEFAULT NULL,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    shelf_id INT DEFAULT NULL,
    cover_image VARCHAR(500) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    pages INT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_books_total_copies CHECK (total_copies >= 1),
    CONSTRAINT chk_books_available_copies CHECK (available_copies >= 0),
    CONSTRAINT chk_books_available_le_total CHECK (available_copies <= total_copies),
    CONSTRAINT fk_books_category FOREIGN KEY (category_id) 
        REFERENCES categories(category_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT fk_books_shelf FOREIGN KEY (shelf_id) 
        REFERENCES shelves(shelf_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    INDEX idx_books_title (title),
    INDEX idx_books_author (author),
    INDEX idx_books_category_id (category_id),
    INDEX idx_books_shelf_id (shelf_id),
    INDEX idx_books_isbn (isbn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. LOANS TABLE
-- Book circulation records tracking checkouts, due dates, and returns
-- ============================================================================
CREATE TABLE loans (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    member_id INT NOT NULL,
    issued_by INT DEFAULT NULL,
    issue_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    due_date DATE NOT NULL,
    return_date DATE DEFAULT NULL,
    status ENUM('issued', 'returned', 'overdue') NOT NULL DEFAULT 'issued',
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_loans_book FOREIGN KEY (book_id) 
        REFERENCES books(book_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_loans_member FOREIGN KEY (member_id) 
        REFERENCES members(member_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_loans_issued_by FOREIGN KEY (issued_by) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    INDEX idx_loans_member_status (member_id, status),
    INDEX idx_loans_book_status (book_id, status),
    INDEX idx_loans_due_date (due_date),
    INDEX idx_loans_issue_date (issue_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. RESERVATIONS TABLE
-- Member hold queue for books with single active hold constraint per member-book
-- ============================================================================
CREATE TABLE reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    member_id INT NOT NULL,
    reservation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'fulfilled', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
    queue_position INT DEFAULT NULL,
    expiry_date DATE DEFAULT NULL,
    fulfilled_at DATETIME DEFAULT NULL,
    -- Virtual generated column enabling filtered uniqueness in MySQL:
    -- Evaluates to 'pending' if pending, NULL otherwise (NULLs do not violate UNIQUE in InnoDB)
    active_reservation_status VARCHAR(10) GENERATED ALWAYS AS (IF(status = 'pending', 'pending', NULL)) VIRTUAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservations_book FOREIGN KEY (book_id) 
        REFERENCES books(book_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_reservations_member FOREIGN KEY (member_id) 
        REFERENCES members(member_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT uq_active_book_member_reservation UNIQUE (book_id, member_id, active_reservation_status),
    INDEX idx_reservations_status (status),
    INDEX idx_reservations_book_queue (book_id, queue_position),
    INDEX idx_reservations_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. FINES TABLE
-- Penalty assessments for overdue loans
-- ============================================================================
CREATE TABLE fines (
    fine_id INT AUTO_INCREMENT PRIMARY KEY,
    loan_id INT NOT NULL,
    member_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('unpaid', 'partial', 'paid', 'waived') NOT NULL DEFAULT 'unpaid',
    assessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_fines_amount CHECK (amount >= 0),
    CONSTRAINT chk_fines_paid_amount CHECK (paid_amount >= 0),
    CONSTRAINT chk_fines_paid_le_amount CHECK (paid_amount <= amount),
    CONSTRAINT fk_fines_loan FOREIGN KEY (loan_id) 
        REFERENCES loans(loan_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_fines_member FOREIGN KEY (member_id) 
        REFERENCES members(member_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    INDEX idx_fines_loan_id (loan_id),
    INDEX idx_fines_member_status (member_id, status),
    INDEX idx_fines_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. FINE_PAYMENTS TABLE
-- Transaction ledger for fine settlements
-- ============================================================================
CREATE TABLE fine_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    fine_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) DEFAULT NULL,
    received_by INT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fine_payments_amount CHECK (amount > 0),
    CONSTRAINT fk_fine_payments_fine FOREIGN KEY (fine_id) 
        REFERENCES fines(fine_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_fine_payments_received_by FOREIGN KEY (received_by) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    INDEX idx_fine_payments_fine_id (fine_id),
    INDEX idx_fine_payments_received_by (received_by),
    INDEX idx_fine_payments_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
