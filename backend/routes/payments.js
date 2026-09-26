const router = require('express').Router();
const c = require('../controllers/financeController');
const { protect, staffOnly } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { PAYMENT_METHODS } = require('../models/Payment');

router.use(protect);
router.get('/', c.listPayments);
router.get('/:id', c.getPayment);
router.post(
  '/',
  staffOnly,
  validateBody({
    amount: { required: true, type: 'number', min: 1, label: 'Amount' },
    method: { required: true, enum: PAYMENT_METHODS, label: 'Payment method' },
    status: { enum: ['Paid', 'Pending'], label: 'Status' },
  }),
  c.createPayment
);
router.patch('/:id/confirm', staffOnly, c.confirmPayment);

module.exports = router;
