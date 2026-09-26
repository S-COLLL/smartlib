const router = require('express').Router();
const c = require('../controllers/circulationController');
const { protect, staffOnly, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(protect);
router.get('/', c.listReservations);
router.post('/', validateBody({ book: { required: true, label: 'Book' } }), c.createReservation);
router.patch('/:id/cancel', c.cancelReservation);
router.patch('/:id/collect', staffOnly, c.collectReservation);
router.delete('/:id', authorize('admin', 'librarian'), c.deleteReservation);

module.exports = router;
