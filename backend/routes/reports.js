const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, staffOnly } = require('../middleware/auth');

router.use(protect);
router.get('/dashboard', c.dashboard);
router.get('/', staffOnly, c.listReports);
router.get('/:type', staffOnly, c.getReport);

module.exports = router;
