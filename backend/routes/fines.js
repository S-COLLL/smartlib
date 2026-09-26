const router = require('express').Router();
const c = require('../controllers/financeController');
const { protect, staffOnly, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { FINE_TYPES } = require('../models/Fine');

router.use(protect);
router.get('/', c.listFines);
router.get('/summary', c.fineSummary);
router.post(
  '/',
  staffOnly,
  validateBody({
    member: { required: true, label: 'Member' },
    type: { required: true, enum: FINE_TYPES, label: 'Type' },
    amount: { required: true, type: 'number', min: 1, label: 'Amount' },
  }),
  c.createFine
);
router.patch('/:id/discount', authorize('admin', 'librarian'), validateBody({ discount: { required: true, type: 'number', min: 0, label: 'Discount' } }), c.discountFine);
router.patch('/:id/waive', authorize('admin', 'librarian'), c.waiveFine);
router.delete('/:id', authorize('admin'), c.deleteFine);

module.exports = router;
