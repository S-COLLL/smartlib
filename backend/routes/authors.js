const router = require('express').Router();
const c = require('../controllers/catalogController');
const { protect, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const rules = { name: { required: true, min: 2, max: 120, label: 'Name' }, biography: { max: 3000, label: 'Biography' } };

router.use(protect);
router.get('/', c.listAuthors);
router.get('/:id', c.getAuthor);
router.post('/', authorize('admin', 'librarian'), validateBody(rules), c.createAuthor);
router.put('/:id', authorize('admin', 'librarian'), validateBody(rules, { partial: true }), c.updateAuthor);
router.delete('/:id', authorize('admin', 'librarian'), c.deleteAuthor);

module.exports = router;
