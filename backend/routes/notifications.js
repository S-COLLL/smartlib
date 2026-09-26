const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect, staffOnly } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(protect);
router.get('/', c.list);
router.get('/unread-count', c.unreadCount);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', c.markRead);
router.post(
  '/',
  staffOnly,
  validateBody({
    title: { required: true, min: 2, max: 120, label: 'Title' },
    message: { required: true, min: 2, max: 500, label: 'Message' },
    audience: { enum: ['staff', 'member', 'all'], label: 'Audience' },
  }),
  c.create
);
router.delete('/:id', staffOnly, c.remove);

module.exports = router;
