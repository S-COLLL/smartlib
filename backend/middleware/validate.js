const mongoose = require('mongoose');
const { ApiError } = require('../utils/helpers');

/**
 * Tiny declarative validator for request bodies.
 * rules: { field: { required, type: 'string'|'number'|'email'|'date'|'id', min, max, enum, label } }
 */
function validateBody(rules, { partial = false } = {}) {
  return (req, _res, next) => {
    const errors = {};
    const body = req.body || {};
    for (const [field, r] of Object.entries(rules)) {
      const label = r.label || field;
      const v = body[field];
      const empty = v === undefined || v === null || v === '';
      if (empty) {
        if (r.required && !partial) errors[field] = `${label} is required`;
        continue;
      }
      switch (r.type) {
        case 'number': {
          const n = Number(v);
          if (Number.isNaN(n)) errors[field] = `${label} must be a number`;
          else if (r.min !== undefined && n < r.min) errors[field] = `${label} must be at least ${r.min}`;
          else if (r.max !== undefined && n > r.max) errors[field] = `${label} must be at most ${r.max}`;
          else body[field] = n;
          break;
        }
        case 'email':
          if (!/^\S+@\S+\.\S+$/.test(String(v))) errors[field] = `${label} is invalid`;
          break;
        case 'date':
          if (Number.isNaN(new Date(v).getTime())) errors[field] = `${label} is not a valid date`;
          break;
        case 'id':
          if (!mongoose.isValidObjectId(v)) errors[field] = `${label} is invalid`;
          break;
        default:
          if (typeof v !== 'string') errors[field] = `${label} must be text`;
          else if (r.min !== undefined && v.trim().length < r.min) errors[field] = `${label} must be at least ${r.min} characters`;
          else if (r.max !== undefined && v.length > r.max) errors[field] = `${label} must be at most ${r.max} characters`;
      }
      if (!errors[field] && r.enum && !r.enum.includes(v)) errors[field] = `${label} must be one of: ${r.enum.join(', ')}`;
    }
    if (Object.keys(errors).length) return next(new ApiError(400, Object.values(errors)[0], errors));
    next();
  };
}

module.exports = { validateBody };
