/**
 * Helper to convert a date to YYYY-MM-DD in the specified timezone
 */
function toDateOnlyString(date, timeZone = 'Asia/Kolkata') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date(date));
  } catch (e) {
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
}

/**
 * Calculates fine amount for overdue book returns
 * @param {Date|string} dueDate - Scheduled due date for the loan
 * @param {Date|string} [returnDate=new Date()] - Actual or current return date
 * @returns {number} Fine amount in currency units (non-negative)
 */
function calculateFine(dueDate, returnDate = new Date()) {
  if (!dueDate) return 0;

  const timeZone = process.env.LIBRARY_TIMEZONE || 'Asia/Kolkata';
  const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 2;

  const dueStr = toDateOnlyString(dueDate, timeZone);
  const retStr = toDateOnlyString(returnDate, timeZone);

  if (!dueStr || !retStr) return 0;

  const dueMs = Date.parse(dueStr);
  const retMs = Date.parse(retStr);

  if (isNaN(dueMs) || isNaN(retMs)) return 0;

  const diffTime = retMs - dueMs;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 0;
  }

  return Math.round(diffDays * finePerDay * 100) / 100;
}

module.exports = {
  calculateFine,
  toDateOnlyString,
};
