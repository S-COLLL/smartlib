const crypto = require('crypto');

/**
 * Generates a membership number in the SL-YYYY-XXX format
 * @returns {string} e.g. "SL-2026-482"
 */
function generateMembershipNumber() {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `SL-${year}-${randomSuffix}`;
}

/**
 * Formats a Date or date string to YYYY-MM-DD
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Computes offset and limit for SQL queries and pagination
 * @param {number|string} page - 1-based page number
 * @param {number|string} limit - Items per page
 * @returns {{ offset: number, limit: number, page: number }}
 */
function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(500, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (p - 1) * l;
  return {
    offset,
    limit: l,
    page: p,
  };
}

/**
 * Sanitizes user object by removing password_hash and sensitive properties
 * @param {object} user
 * @returns {object}
 */
function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const clone = { ...user };
  delete clone.password_hash;
  delete clone.password;
  return clone;
}

/**
 * Generates a UUID v4 or random correlation ID
 * @returns {string}
 */
function generateCorrelationId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  generateMembershipNumber,
  formatDate,
  paginate,
  sanitizeUser,
  generateCorrelationId,
};
