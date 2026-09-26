const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../utils/helpers');

const STAFF_ROLES = ['admin', 'librarian', 'staff'];

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Not authenticated. Please log in.');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Session expired or invalid. Please log in again.');
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled.');
  req.user = user;
  next();
});

// Role-based authorization: authorize('admin', 'librarian')
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, `This action requires one of the roles: ${roles.join(', ')}`));
    }
    next();
  };

const staffOnly = authorize(...STAFF_ROLES);
const isStaff = (user) => user && STAFF_ROLES.includes(user.role);

module.exports = { protect, authorize, staffOnly, isStaff, STAFF_ROLES };
