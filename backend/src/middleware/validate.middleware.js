import AppError from './AppError.js';

export function requireString(value, field, { min = 1, max = 256 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new AppError(400, 'INVALID_INPUT', `${field} must be between ${min} and ${max} characters.`);
  }
  return value.trim();
}

export function requireTimezone(value) {
  const timezone = typeof value === 'string' ? value : 'Asia/Manila';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); return timezone; }
  catch { throw new AppError(400, 'INVALID_TIMEZONE', 'Enter a valid IANA timezone.'); }
}
