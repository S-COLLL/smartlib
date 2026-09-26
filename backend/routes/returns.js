const router = require('express').Router();
const c = require('../controllers/circulationController');
const { protect, staffOnly } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(protect);
router.get('/', c.listReturns);
router.get('/lookup', staffOnly, c.lookup);
router.post(
  '/',
  staffOnly,
  validateBody({
    issue: { required: true, label: 'Transaction' },
    condition: { enum: ['Good', 'Damaged', 'Lost'], label: 'Condition' },
    returnDate: { type: 'date', label: 'Return date' },
  }),
  c.createReturn
);

module.exports = router;
