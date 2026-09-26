const router = require('express').Router();
const c = require('../controllers/memberController');
const { protect, authorize, staffOnly } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const rules = {
  name: { required: true, min: 2, max: 100, label: 'Name' },
  email: { required: true, type: 'email', label: 'Email' },
  membershipType: { enum: ['Student', 'Faculty', 'Staff', 'Premium', 'Guest'], label: 'Membership type' },
  membershipStart: { type: 'date', label: 'Membership start' },
  membershipExpiry: { type: 'date', label: 'Membership expiry' },
  status: { enum: ['Active', 'Expired', 'Suspended'], label: 'Status' },
};

router.use(protect);
router.get('/', staffOnly, c.list);
router.get('/:id', c.get); // students may view their own profile (checked in controller)
router.post('/', staffOnly, validateBody(rules), c.create);
router.put('/:id', staffOnly, validateBody(rules, { partial: true }), c.update);
router.patch('/:id/renew', staffOnly, validateBody({ months: { type: 'number', min: 1, max: 60, label: 'Months' } }, { partial: true }), c.renew);
router.delete('/:id', authorize('admin', 'librarian'), c.remove);

module.exports = router;
