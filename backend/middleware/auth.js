const jwt = require('jsonwebtoken');

function extractToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return null;
}

function authenticateToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: No token provided',
    });
  }

  const secret = process.env.JWT_SECRET || 'smartlib_default_secret_key_2026';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token has expired. Please log in again.'
          : 'Invalid authentication token.';
      return res.status(401).json({
        success: false,
        message,
      });
    }

    req.user = {
      id: decoded.id || decoded.userId,
      role: decoded.role || 'member',
      name: decoded.name || '',
      email: decoded.email || '',
      memberId: decoded.memberId || null,
    };

    next();
  });
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Role check: admin has universal access, or role must match one of the allowed roles
    const userRole = (req.user.role || '').toLowerCase();
    const allowed = roles.map((r) => r.toLowerCase());

    if (userRole === 'admin' || allowed.includes(userRole)) {
      return next();
    }

    // Support alias: 'student' maps to 'member', 'staff' maps to 'librarian'
    if (
      (userRole === 'member' && allowed.includes('student')) ||
      (userRole === 'student' && allowed.includes('member')) ||
      (userRole === 'librarian' && allowed.includes('staff')) ||
      (userRole === 'staff' && allowed.includes('librarian'))
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied: requires one of the roles: ${roles.join(', ')}`,
    });
  };
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  const secret = process.env.JWT_SECRET || 'smartlib_default_secret_key_2026';
  jwt.verify(token, secret, (err, decoded) => {
    if (!err && decoded) {
      req.user = {
        id: decoded.id || decoded.userId,
        role: decoded.role || 'member',
        name: decoded.name || '',
        email: decoded.email || '',
        memberId: decoded.memberId || null,
      };
    } else {
      req.user = null;
    }
    next();
  });
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
};
