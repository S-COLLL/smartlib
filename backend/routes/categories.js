const router = require('express').Router();
const c = require('../controllers/catalogController');
const { protect, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const rules = { name: { required: true, min: 2, max: 60, label: 'Name' }, description: { max: 500, label: 'Description' } };

router.use(protect);
router.get('/', c.listCategories);
router.get('/:id', c.getCategory);
router.post('/', authorize('admin', 'librarian'), validateBody(rules), c.createCategory);
router.put('/:id', authorize('admin', 'librarian'), validateBody(rules, { partial: true }), c.updateCategory);
router.delete('/:id', authorize('admin', 'librarian'), c.deleteCategory);

module.exports = router;
