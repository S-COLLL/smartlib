const router = require('express').Router();
const c = require('../controllers/bookController');
const { protect, authorize, staffOnly } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const bookRules = {
  title: { required: true, min: 1, max: 200, label: 'Book name' },
  isbn: { required: true, label: 'ISBN' },
  price: { required: true, type: 'number', min: 0, label: 'Price' },
  purchasePrice: { type: 'number', min: 0, label: 'Purchase price' },
  currentValue: { type: 'number', min: 0, label: 'Current value' },
  quantity: { required: true, type: 'number', min: 1, max: 10000, label: 'Quantity' },
  pages: { type: 'number', min: 0, label: 'Pages' },
  lostCopies: { type: 'number', min: 0, label: 'Lost copies' },
  damagedCopies: { type: 'number', min: 0, label: 'Damaged copies' },
  publicationDate: { type: 'date', label: 'Publication date' },
};

router.use(protect);
router.get('/', c.list);
router.get('/meta', c.meta);
router.get('/recommendations', c.recommendations);
router.post('/bulk', authorize('admin', 'librarian'), c.bulk);
router.get('/:id', c.get);
router.post('/', authorize('admin', 'librarian'), validateBody(bookRules), c.create);
router.put('/:id', authorize('admin', 'librarian'), validateBody(bookRules, { partial: true }), c.update);
router.patch(
  '/:id/location',
  staffOnly,
  validateBody({
    shelf: { required: true, label: 'Shelf' },
    rack: { required: true, label: 'Rack' },
    row: { required: true, label: 'Row' },
    position: { required: true, label: 'Position' },
  }),
  c.move
);
router.delete('/:id', authorize('admin', 'librarian'), c.remove);

module.exports = router;
