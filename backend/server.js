const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');
const { runMaintenance } = require('./utils/library');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== '*' ? process.env.CLIENT_ORIGIN.split(',') : true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date() }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/books', require('./routes/books'));
  app.use('/api/authors', require('./routes/authors'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/shelves', require('./routes/shelves'));
  app.use('/api/members', require('./routes/members'));
  app.use('/api/issues', require('./routes/issues'));
  app.use('/api/returns', require('./routes/returns'));
  app.use('/api/reservations', require('./routes/reservations'));
  app.use('/api/fines', require('./routes/fines'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api', notFound);

  // Serve the frontend from the same origin
  const frontend = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontend, { extensions: ['html'] }));
  app.get('/', (_req, res) => res.sendFile(path.join(frontend, 'index.html')));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('✗ JWT_SECRET is not set in .env');
    process.exit(1);
  }
  try {
    await connectDB();
  } catch (err) {
    console.error(`✗ Could not connect to MongoDB: ${err.message}`);
    console.error('  Make sure MongoDB is running and MONGO_URI in .env is correct.');
    process.exit(1);
  }
  const app = createApp();
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`✓ SmartLib running at http://localhost:${port}`);
  });

  // Overdue detection, reminders, membership & reservation expiry
  const tick = () => runMaintenance().catch((e) => console.error('Maintenance error:', e.message));
  tick();
  setInterval(tick, 60 * 60 * 1000);
}

if (require.main === module) start();

module.exports = { createApp };
