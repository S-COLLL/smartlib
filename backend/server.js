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
  app.set('trust proxy', 1); // behind Render / other reverse proxies
  app.use(cors({ origin: process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== '*' ? process.env.CLIENT_ORIGIN.split(',') : true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date() }));
  app.get('/api/v1/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date() }));

  const registerRoutes = (prefix) => {
    app.use(`${prefix}/auth`, require('./routes/auth'));
    app.use(`${prefix}/books`, require('./routes/books'));
    app.use(`${prefix}/authors`, require('./routes/authors'));
    app.use(`${prefix}/categories`, require('./routes/categories'));
    app.use(`${prefix}/shelves`, require('./routes/shelves'));
    app.use(`${prefix}/members`, require('./routes/members'));
    app.use(`${prefix}/issues`, require('./routes/issues'));
    app.use(`${prefix}/loans`, require('./routes/loans'));
    app.use(`${prefix}/returns`, require('./routes/returns'));
    app.use(`${prefix}/reservations`, require('./routes/reservations'));
    app.use(`${prefix}/fines`, require('./routes/fines'));
    app.use(`${prefix}/payments`, require('./routes/payments'));
    app.use(`${prefix}/notifications`, require('./routes/notifications'));
    app.use(`${prefix}/reviews`, require('./routes/reviews'));
    app.use(`${prefix}/reports`, require('./routes/reports'));
    app.use(`${prefix}/settings`, require('./routes/settings'));
    app.use(`${prefix}/ai`, require('./routes/ai'));
  };

  registerRoutes('/api');
  registerRoutes('/api/v1');

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

  // Hosted deployments (e.g. Render) have no shell to run `npm run seed`:
  // with AUTO_SEED=true the demo data is loaded once, only if the database is empty.
  if (process.env.AUTO_SEED === 'true') {
    const User = require('./models/User');
    if ((await User.estimatedDocumentCount()) === 0) {
      console.log('Empty database — loading demo data (AUTO_SEED=true)…');
      await require('./seed/seed').seedDatabase();
    }
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
