const router = require('express').Router();
const c = require('../controllers/circulationController');
const { protect, staffOnly } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(protect);
router.get('/', c.listIssues);
router.get('/:id', c.getIssue);
router.post(
  '/',
  staffOnly,
  validateBody({
    member: { required: true, label: 'Member' },
    book: { required: true, label: 'Book' },
    dueDate: { type: 'date', label: 'Due date' },
    days: { type: 'number', min: 1, max: 180, label: 'Loan days' },
  }),
  c.createIssue
);
router.patch('/:id/renew', c.renewIssue); // students can renew their own loans (scoped in controller)

module.exports = router;
