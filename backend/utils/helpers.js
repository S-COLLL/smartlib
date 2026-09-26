const Counter = require('../models/Counter');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Wrap async express handlers so rejected promises reach the error middleware
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function nextId(name, prefix, width = 4) {
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${prefix}${String(c.seq).padStart(width, '0')}`;
}

const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
const daysBetween = (from, to) => Math.max(0, Math.floor((startOfDay(to) - startOfDay(from)) / DAY));

function paginate(req, defaultLimit = 10, maxLimit = 200) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Keep only allowed keys from an input object
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

module.exports = { ApiError, asyncHandler, nextId, escapeRegex, DAY, startOfDay, addDays, daysBetween, paginate, pick, round2 };
