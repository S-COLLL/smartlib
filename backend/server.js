const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

// Import database configurations
const { pool, testConnection } = require('./config/db');
const { connect: connectMongoDB } = require('./config/mongodb');

// Import route modules
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const categoriesRoutes = require('./routes/categories');
const shelvesRoutes = require('./routes/shelves');
const membersRoutes = require('./routes/members');
const loansRoutes = require('./routes/loans');
const reservationsRoutes = require('./routes/reservations');
const finesRoutes = require('./routes/fines');
const reviewsRoutes = require('./routes/reviews');
const notificationsRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const statsRoutes = require('./routes/stats');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');

// Import centralized error handler
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. Security & Parsing Middleware
// ==========================================
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow frontend fonts, SVGs, and inline modules
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // limit each IP to 600 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again later.',
  },
});
app.use('/api', apiLimiter);

// ==========================================
// 2. Static Assets
// ==========================================
const frontendDir = path.join(__dirname, '..', 'frontend');
const uploadsDir = path.join(frontendDir, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.static(frontendDir));
app.use('/uploads', express.static(uploadsDir));

// Root route explicitly serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ==========================================
// 3. API Routes Mounting
// ==========================================
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/books', booksRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/shelves', shelvesRoutes);
apiRouter.use('/members', membersRoutes);
apiRouter.use('/loans', loansRoutes);
apiRouter.use('/issues', loansRoutes); // Route alias for issues -> loans
apiRouter.use('/reservations', reservationsRoutes);
apiRouter.use('/fines', finesRoutes);
apiRouter.use('/reviews', reviewsRoutes);
apiRouter.use('/notifications', notificationsRoutes);
apiRouter.use('/activity', activityRoutes);
apiRouter.use('/stats', statsRoutes);
apiRouter.use('/search', searchRoutes);
apiRouter.use('/upload', uploadRoutes);

// Mount under /api/v1/ as requested
app.use('/api/v1', apiRouter);

// Also mount under /api for seamless frontend client compatibility
app.use('/api', apiRouter);

// 404 handler for unrecognized /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Fallback for HTML page navigation (e.g. books.html, members.html, etc.)
app.get('*', (req, res, next) => {
  const filePath = path.join(frontendDir, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ==========================================
// 4. Centralized Error Handler
// ==========================================
app.use(errorHandler);

// ==========================================
// 5. Database Connection & Server Startup
// ==========================================
async function startServer() {
  try {
    console.log('Connecting to databases...');

    // Connect to MySQL
    try {
      await testConnection();
    } catch (err) {
      console.warn('⚠️  MySQL Connection Note:', err.message);
      console.warn('   (Ensure MySQL is running on port 3306 with the password specified in .env)');
    }

    // Connect to MongoDB
    try {
      await connectMongoDB();
    } catch (err) {
      console.warn('⚠️  MongoDB Connection Note:', err.message);
      console.warn('   (Ensure MongoDB is running on port 27017 or MONGODB_URI in .env is configured)');
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`  SMARTLIB Library Management System Backend Running`);
      console.log(`  Port:             ${PORT}`);
      console.log(`  Frontend URL:     http://localhost:${PORT}`);
      console.log(`  API v1 Base URL:  http://localhost:${PORT}/api/v1`);
      console.log(`  Environment:      ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await mongoose.connection.close();
          console.log('MongoDB connection closed.');
          await pool.end();
          console.log('MySQL connection pool closed.');
          console.log('SMARTLIB shutdown complete.');
          process.exit(0);
        } catch (err) {
          console.error('Error during database teardown:', err.message);
          process.exit(1);
        }
      });

      // Force close after 10s if graceful shutdown hangs
      setTimeout(() => {
        console.error('Shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Critical failure during server startup:', error.message);
    process.exit(1);
  }
}

if (require.main === module) startServer();

module.exports = app;
