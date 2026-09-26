const router = require('express').Router();
const c = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { ROLES } = require('../models/User');

router.post(
  '/register',
  validateBody({
    name: { required: true, min: 2, max: 80, label: 'Name' },
    email: { required: true, type: 'email', label: 'Email' },
    password: { required: true, min: 6, label: 'Password' },
  }),
  c.register
);
router.post('/login', validateBody({ email: { required: true, type: 'email', label: 'Email' }, password: { required: true, label: 'Password' } }), c.login);
router.get('/me', protect, c.me);
router.put('/profile', protect, validateBody({ name: { min: 2, max: 80, label: 'Name' } }, { partial: true }), c.updateProfile);
router.patch('/password', protect, c.changePassword);
router.post('/search-history', protect, c.addSearchTerm);

router.get('/users', protect, authorize('admin'), c.listUsers);
router.post(
  '/users',
  protect,
  authorize('admin'),
  validateBody({
    name: { required: true, min: 2, label: 'Name' },
    email: { required: true, type: 'email', label: 'Email' },
    password: { required: true, min: 6, label: 'Password' },
    role: { required: true, enum: ROLES, label: 'Role' },
  }),
  c.createUser
);
router.patch('/users/:id', protect, authorize('admin'), validateBody({ role: { enum: ROLES, label: 'Role' } }, { partial: true }), c.updateUser);

module.exports = router;
