const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const num = (label, min = 0) => ({ type: 'number', min, label });

router.use(protect);
router.get('/', c.getSettings);
router.put(
  '/',
  authorize('admin'),
  validateBody(
    {
      libraryName: { min: 2, max: 100, label: 'Library name' },
      finePerDay: num('Fine per day'),
      loanDays: num('Loan days', 1),
      maxRenewals: num('Max renewals'),
      maxBooksPerMember: num('Max books per member', 1),
      maxPendingFine: num('Max pending fine'),
      reservationHoldDays: num('Reservation hold days', 1),
      reservationValidityDays: num('Reservation validity days', 1),
      lostProcessingFee: num('Lost processing fee'),
      damageChargePercent: { type: 'number', min: 0, max: 100, label: 'Damage charge %' },
      membershipFee: num('Membership fee'),
      dueSoonDays: num('Due soon days', 1),
    },
    { partial: true }
  ),
  c.updateSettings
);

module.exports = router;
