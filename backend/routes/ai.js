const router = require('express').Router();
const c = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.post('/query', protect, c.query);

module.exports = router;
