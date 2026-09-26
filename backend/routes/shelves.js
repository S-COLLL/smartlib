const router = require('express').Router();
const c = require('../controllers/catalogController');
const { protect, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const rules = {
  code: { required: true, min: 1, max: 3, label: 'Shelf code' },
  floor: { required: true, type: 'number', min: 0, max: 20, label: 'Floor' },
  section: { required: true, min: 2, label: 'Section' },
  racks: { type: 'number', min: 1, max: 50, label: 'Racks' },
  rowsPerRack: { type: 'number', min: 1, max: 26, label: 'Rows per rack' },
  capacity: { required: true, type: 'number', min: 1, label: 'Capacity' },
  status: { enum: ['Active', 'Maintenance', 'Closed'], label: 'Status' },
};

router.use(protect);
router.get('/', c.listShelves);
router.get('/:id', c.getShelf);
router.post('/', authorize('admin', 'librarian'), validateBody(rules), c.createShelf);
router.put('/:id', authorize('admin', 'librarian'), validateBody(rules, { partial: true }), c.updateShelf);
router.delete('/:id', authorize('admin', 'librarian'), c.deleteShelf);

module.exports = router;
