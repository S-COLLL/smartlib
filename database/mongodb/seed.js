/**
 * ============================================================================
 * SMARTLIB — MongoDB Database Seed Script
 * ============================================================================
 * WARNING: DEVELOPMENT-ONLY SEED DATA — DO NOT RUN IN PRODUCTION!
 *
 * This script initializes the SMARTLIB MongoDB document collections:
 * 1. Connects to MongoDB using MONGODB_URI from .env
 * 2. Purges existing collections for a clean idempotent reset
 * 3. Seeds sample member book reviews (1-5 ratings & comments)
 * 4. Seeds comprehensive activity audit logs with realistic actor events
 * 5. Seeds user notification inbox alerts (due, overdue, reservations, fines)
 * 6. Seeds catalog search history queries and facet filters
 *
 * Usage:
 *   npm run seed:mongodb
 *   or: node database/mongodb/seed.js
 * ============================================================================
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import Mongoose Models
const Review = require('../../backend/models/mongodb/Review');
const ActivityLog = require('../../backend/models/mongodb/ActivityLog');
const Notification = require('../../backend/models/mongodb/Notification');
const SearchHistory = require('../../backend/models/mongodb/SearchHistory');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartlib';

/**
 * Utility helper to shift current date by +/- days
 */
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function runSeed() {
  console.log('------------------------------------------------------------');
  console.log('🍃 SMARTLIB — Starting MongoDB Collections Initialization & Seed');
  console.log('------------------------------------------------------------');
  console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000
    });
    console.log('✅ Connected to MongoDB successfully.');

    // ------------------------------------------------------------------------
    // Step 1: Purge existing collections
    // ------------------------------------------------------------------------
    console.log('\n🧹 Clearing existing MongoDB collections...');
    await Promise.all([
      Review.deleteMany({}),
      ActivityLog.deleteMany({}),
      Notification.deleteMany({}),
      SearchHistory.deleteMany({})
    ]);
    console.log('   ✓ Cleared Review, ActivityLog, Notification, SearchHistory collections.');

    // ------------------------------------------------------------------------
    // Step 2: Seed Reviews (7 sample reviews)
    // ------------------------------------------------------------------------
    console.log('\n⭐ Seeding sample book reviews...');
    const sampleReviews = [
      {
        bookId: 1, // Clean Code
        memberId: 1, // Rahul Sharma
        userId: 3,
        memberName: 'Rahul Sharma',
        rating: 5,
        reviewText:
          'An absolute essential for every software engineer! Uncle Bob\'s principles on meaningful variable naming, concise single-responsibility functions, and pragmatic test coverage transformed how I structure applications.',
        isEdited: false
      },
      {
        bookId: 10, // 1984
        memberId: 2, // Priya Patel
        userId: 4,
        memberName: 'Priya Patel',
        rating: 5,
        reviewText:
          'Chilling and prophetic. George Orwell\'s portrayal of state surveillance, Thought Police, and Doublethink remains the definitive masterpiece on political totalitarianism.',
        isEdited: false
      },
      {
        bookId: 5, // Sapiens
        memberId: 4, // Sneha Reddy
        userId: 6,
        memberName: 'Sneha Reddy',
        rating: 5,
        reviewText:
          'Harari weaves evolutionary biology, cognitive anthropology, and historical geopolitics into a breathtaking narrative. A profoundly thought-provoking read that stays with you.',
        isEdited: true
      },
      {
        bookId: 4, // The Great Gatsby
        memberId: 3, // Amit Kumar
        userId: 5,
        memberName: 'Amit Kumar',
        rating: 4,
        reviewText:
          'A haunting and lyrical critique of the American Dream during the Roaring Twenties. The poetic prose and symbolism of Gatsby\'s green light are truly immortal.',
        isEdited: false
      },
      {
        bookId: 13, // The Pragmatic Programmer
        memberId: 5, // Vikram Singh
        userId: 7,
        memberName: 'Vikram Singh',
        rating: 5,
        reviewText:
          'Packed with pragmatic wisdom from real engineering trenches. Chapters on tracer bullets, orthodoxy avoidance, and DRY principle should be required reading for all developers.',
        isEdited: false
      },
      {
        bookId: 15, // Meditations
        memberId: 1, // Rahul Sharma
        userId: 3,
        memberName: 'Rahul Sharma',
        rating: 5,
        reviewText:
          'The ultimate handbook on Stoic resilience, self-discipline, and emotional balance. Marcus Aurelius writing reminders to himself 1,800 years ago feels as modern and relevant as today\'s news.',
        isEdited: false
      },
      {
        bookId: 6, // A Brief History of Time
        memberId: 4, // Sneha Reddy
        userId: 6,
        memberName: 'Sneha Reddy',
        rating: 4,
        reviewText:
          'Stephen Hawking brilliantly bridges the gap between quantum mechanics, general relativity, and cosmological origin for curious general readers.',
        isEdited: false
      }
    ];

    const insertedReviews = await Review.insertMany(sampleReviews);
    console.log(`   ✓ Inserted ${insertedReviews.length} book reviews.`);

    // ------------------------------------------------------------------------
    // Step 3: Seed Activity Logs (14 sample audit entries)
    // ------------------------------------------------------------------------
    console.log('\n📋 Seeding comprehensive activity logs...');
    const sampleActivityLogs = [
      {
        actorId: 1,
        actorName: 'Admin User',
        actorRole: 'admin',
        action: 'system.initialize',
        entityType: 'system',
        entityId: null,
        description: 'Initialized SMARTLIB database schema and generated baseline library records',
        metadata: { version: '1.0.0', environment: 'development' },
        ipAddress: '127.0.0.1',
        correlationId: 'req-sys-init-001',
        status: 'success'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'book.create',
        entityType: 'book',
        entityId: 1,
        description: 'Cataloged new acquisition: "Clean Code" by Robert C. Martin into Floor 1, Section B',
        metadata: { isbn: '978-0132350884', total_copies: 5, shelf_id: 3 },
        ipAddress: '192.168.1.15',
        correlationId: 'req-book-add-001',
        status: 'success'
      },
      {
        actorId: 3,
        actorName: 'Rahul Sharma',
        actorRole: 'member',
        action: 'auth.login',
        entityType: 'user',
        entityId: 3,
        description: 'Member authenticated successfully via web portal session',
        metadata: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0' },
        ipAddress: '103.21.124.50',
        correlationId: 'req-auth-login-001',
        status: 'success'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'loan.issue',
        entityType: 'loan',
        entityId: 1,
        description: 'Issued "Clean Code" to member Rahul Sharma (SL-2024-001)',
        metadata: { bookId: 1, memberId: 1, loanPeriodDays: 14 },
        ipAddress: '192.168.1.15',
        correlationId: 'req-loan-issue-001',
        status: 'success'
      },
      {
        actorId: 4,
        actorName: 'Priya Patel',
        actorRole: 'member',
        action: 'reservation.create',
        entityType: 'reservation',
        entityId: 1,
        description: 'Placed reservation hold on "Clean Code" (Queue position: 1)',
        metadata: { bookId: 1, queuePosition: 1 },
        ipAddress: '103.21.124.77',
        correlationId: 'req-res-create-001',
        status: 'success'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'loan.return',
        entityType: 'loan',
        entityId: 2,
        description: 'Processed return checkout for "1984" from Priya Patel',
        metadata: { bookId: 10, memberId: 2, condition: 'good' },
        ipAddress: '192.168.1.15',
        correlationId: 'req-loan-return-002',
        status: 'success'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'loan.issue',
        entityType: 'loan',
        entityId: 3,
        description: 'Issued "The Great Gatsby" to member Amit Kumar',
        metadata: { bookId: 4, memberId: 3, loanPeriodDays: 14 },
        ipAddress: '192.168.1.15',
        correlationId: 'req-loan-issue-003',
        status: 'success'
      },
      {
        actorId: 1,
        actorName: 'Admin User',
        actorRole: 'admin',
        action: 'system.cron_overdue',
        entityType: 'system',
        entityId: null,
        description: 'Nightly automation cron: scanned loans, marked 2 overdue loans, calculated fine amounts',
        metadata: { overdueCount: 2, totalFineAssessed: 72.00 },
        ipAddress: '127.0.0.1',
        correlationId: 'cron-overdue-scan-001',
        status: 'success'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'fine.assess',
        entityType: 'fine',
        entityId: 1,
        description: 'Assessed ₹22.00 overdue fine on loan #3 for member Amit Kumar',
        metadata: { loanId: 3, daysOverdue: 11, fineRatePerDay: 2 },
        ipAddress: '192.168.1.15',
        correlationId: 'req-fine-assess-001',
        status: 'success'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'fine.payment',
        entityType: 'fine',
        entityId: 2,
        description: 'Recorded fine payment of ₹50.00 from Vikram Singh via UPI',
        metadata: { fineId: 2, method: 'UPI', amount: 50.00, remainingDue: 0.00 },
        ipAddress: '192.168.1.15',
        correlationId: 'req-fine-pay-002',
        status: 'success'
      },
      {
        actorId: 6,
        actorName: 'Sneha Reddy',
        actorRole: 'member',
        action: 'review.create',
        entityType: 'book',
        entityId: 5,
        description: 'Submitted a 5-star review for "Sapiens: A Brief History of Humankind"',
        metadata: { bookId: 5, rating: 5 },
        ipAddress: '103.44.55.66',
        correlationId: 'req-rev-create-005',
        status: 'success'
      },
      {
        actorId: 5,
        actorName: 'Amit Kumar',
        actorRole: 'member',
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: 5,
        description: 'Failed login attempt: invalid password credential supplied',
        metadata: { attemptedEmail: 'amit.kumar@example.com' },
        ipAddress: '182.73.11.20',
        correlationId: 'req-auth-fail-002',
        status: 'failure'
      },
      {
        actorId: 2,
        actorName: 'Sarah Johnson',
        actorRole: 'librarian',
        action: 'shelf.relocate',
        entityType: 'book',
        entityId: 13,
        description: 'Relocated "The Pragmatic Programmer" to Floor 1, Section B, Rack 2, Shelf 1',
        metadata: { previousShelfId: 4, newShelfId: 5 },
        ipAddress: '192.168.1.15',
        correlationId: 'req-shelf-reloc-013',
        status: 'success'
      },
      {
        actorId: 7,
        actorName: 'Vikram Singh',
        actorRole: 'member',
        action: 'search.execute',
        entityType: 'search',
        entityId: null,
        description: 'Executed catalog query: "system architecture" with category filter: Computer Science',
        metadata: { query: 'system architecture', resultsFound: 3 },
        ipAddress: '115.110.22.4',
        correlationId: 'req-search-vikram-001',
        status: 'success'
      }
    ];

    const insertedLogs = await ActivityLog.insertMany(sampleActivityLogs);
    console.log(`   ✓ Inserted ${insertedLogs.length} activity audit log records.`);

    // ------------------------------------------------------------------------
    // Step 4: Seed Notifications (6 sample member & staff alerts)
    // ------------------------------------------------------------------------
    console.log('\n🔔 Seeding member notification inbox entries...');
    const sampleNotifications = [
      {
        recipientId: 3, // Rahul Sharma
        type: 'welcome',
        title: 'Welcome to SMARTLIB Library Portal!',
        message: 'Your membership SL-2024-001 has been activated. Explore our virtual 3D floor map and discover thousands of titles.',
        isRead: true,
        deliveryStatus: 'delivered'
      },
      {
        recipientId: 3, // Rahul Sharma
        type: 'loan_due',
        title: 'Upcoming Book Return Due Date',
        message: `Friendly reminder: "Clean Code" is due for return on ${addDays(4).toISOString().split('T')[0]}. Please return or renew on time.`,
        isRead: false,
        relatedEntity: {
          type: 'loan',
          id: 1
        },
        deliveryStatus: 'delivered'
      },
      {
        recipientId: 4, // Priya Patel
        type: 'reservation_ready',
        title: 'Reserved Book Ready for Pickup',
        message: 'Your hold on "Clean Code: A Handbook of Agile Software Craftsmanship" is ready at the circulation counter! Please collect within 7 days.',
        isRead: false,
        relatedEntity: {
          type: 'reservation',
          id: 1
        },
        deliveryStatus: 'delivered'
      },
      {
        recipientId: 5, // Amit Kumar
        type: 'loan_overdue',
        title: 'Overdue Book Notice & Fine Assessed',
        message: `Your loan for "The Great Gatsby" was due on ${addDays(-11).toISOString().split('T')[0]} and is currently 11 days overdue. An overdue fine of ₹22.00 has been assessed to your account.`,
        isRead: false,
        relatedEntity: {
          type: 'loan',
          id: 3
        },
        deliveryStatus: 'delivered'
      },
      {
        recipientId: 7, // Vikram Singh
        type: 'fine_paid',
        title: 'Fine Payment Confirmation Receipt',
        message: 'Your payment of ₹50.00 via UPI has been confirmed. Thank you for settling your outstanding account balance.',
        isRead: true,
        relatedEntity: {
          type: 'fine',
          id: 2
        },
        deliveryStatus: 'delivered'
      },
      {
        recipientId: 6, // Sneha Reddy
        type: 'system',
        title: 'Library Extended Reading Hours',
        message: 'The central study reading hall on Floor 2 will remain open until 10:00 PM during upcoming midterm examination periods.',
        isRead: false,
        deliveryStatus: 'delivered'
      }
    ];

    const insertedNotifications = await Notification.insertMany(sampleNotifications);
    console.log(`   ✓ Inserted ${insertedNotifications.length} notification entries.`);

    // ------------------------------------------------------------------------
    // Step 5: Seed Search History (8 sample search history records)
    // ------------------------------------------------------------------------
    console.log('\n🔍 Seeding catalog search history entries...');
    const sampleSearchHistory = [
      {
        userId: 3,
        query: 'Clean Code',
        filters: { category: 'Computer Science', author: 'Robert C. Martin', available: true, floor: 1 },
        resultsCount: 1
      },
      {
        userId: 3,
        query: 'Algorithms and Data Structures',
        filters: { category: 'Computer Science', author: null, available: true, floor: 1 },
        resultsCount: 2
      },
      {
        userId: 4,
        query: 'George Orwell',
        filters: { category: 'Fiction', author: 'George Orwell', available: true, floor: 1 },
        resultsCount: 1
      },
      {
        userId: 5,
        query: 'The Great Gatsby',
        filters: { category: 'Literature', author: null, available: false, floor: 3 },
        resultsCount: 1
      },
      {
        userId: 6,
        query: 'Sapiens Harari',
        filters: { category: 'History', author: 'Yuval Noah Harari', available: true, floor: 2 },
        resultsCount: 1
      },
      {
        userId: 6,
        query: 'Cosmology & Black Holes',
        filters: { category: 'Science & Technology', author: null, available: true, floor: 2 },
        resultsCount: 1
      },
      {
        userId: 7,
        query: 'Pragmatic Programmer',
        filters: { category: 'Computer Science', author: null, available: false, floor: 1 },
        resultsCount: 1
      },
      {
        userId: null, // Anonymous guest search
        query: 'Stoic Philosophy Meditations',
        filters: { category: 'Philosophy', author: null, available: true, floor: 3 },
        resultsCount: 2
      }
    ];

    const insertedSearchHistory = await SearchHistory.insertMany(sampleSearchHistory);
    console.log(`   ✓ Inserted ${insertedSearchHistory.length} search history records.`);

    console.log('\n------------------------------------------------------------');
    console.log('🎉 SMARTLIB — MongoDB Database Seed Completed Successfully!');
    console.log('------------------------------------------------------------');
    console.log('Summary of Seeded Documents:');
    console.log(` • Reviews:        ${insertedReviews.length} User Ratings & Reviews`);
    console.log(` • Activity Logs:  ${insertedLogs.length} Audit Trail Events`);
    console.log(` • Notifications:  ${insertedNotifications.length} In-App Alerts`);
    console.log(` • Search History: ${insertedSearchHistory.length} User Search Queries`);
    console.log('------------------------------------------------------------\n');

  } catch (err) {
    console.error('❌ Error during MongoDB seeding:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔒 Disconnected from MongoDB.');
  }
}

// Execute the seed script
runSeed().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
