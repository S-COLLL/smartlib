const { body, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array().map((e) => ({
        field: e.path || e.param,
        message: e.msg,
      })),
    });
  };
};

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const validateBook = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Book title is required'),
  body('isbn')
    .trim()
    .notEmpty()
    .withMessage('ISBN is required'),
  body('author')
    .trim()
    .notEmpty()
    .withMessage('Author name is required'),
  body('total_copies')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Total copies must be at least 1'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
];

const validateMember = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Member name is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required'),
  body('phone')
    .optional()
    .trim(),
];

const validateLoan = [
  body('book_id')
    .custom((val, { req }) => val || req.body.bookId)
    .withMessage('Book ID is required'),
  body('member_id')
    .custom((val, { req }) => val || req.body.memberId)
    .withMessage('Member ID is required'),
];

const validateReservation = [
  body('book_id')
    .custom((val, { req }) => val || req.body.bookId || val === 0)
    .withMessage('Book ID is required'),
];

const validateCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required'),
];

const validateShelf = [
  body('shelf_code')
    .trim()
    .notEmpty()
    .withMessage('Shelf code is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Shelf name is required'),
  body('floor')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Floor must be a non-negative integer'),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Capacity must be at least 1'),
];

const validateReview = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
  body('comment')
    .trim()
    .notEmpty()
    .withMessage('Review comment is required')
    .isLength({ max: 1000 })
    .withMessage('Review comment cannot exceed 1000 characters'),
];

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateBook,
  validateMember,
  validateLoan,
  validateReservation,
  validateCategory,
  validateShelf,
  validateReview,
};
