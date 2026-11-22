import { createAuthClient } from '../config/database.js';
import AppError from '../middleware/AppError.js';
import { requireString, requireTimezone } from '../middleware/validate.middleware.js';

function normalizeEmail(value) {
  const email = requireString(value, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  return email;
}

function saveSession(req, session, timezone) {
  req.session.auth = {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    user: session.user,
    timezone,
  };
}

export async function register(req) {
  const email = normalizeEmail(req.body.email);
  const password = requireString(req.body.password, 'Password', { min: 8, max: 72 });
  const timezone = requireTimezone(req.body.timezone);
  const client = createAuthClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new AppError(400, 'REGISTRATION_FAILED', error.message);
  if (data.session) saveSession(req, data.session, timezone);
  return { user: data.user, confirmationRequired: !data.session };
}

export async function verifySignup(req) {
  const email = normalizeEmail(req.body.email);
  const token = req.body.token;
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    throw new AppError(400, 'INVALID_OTP', 'Enter the 6-digit code from your email.');
  }
  const client = createAuthClient();
  const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.session) {
    throw new AppError(400, 'INVALID_OTP', 'That code is invalid or expired. Request a new code and try again.');
  }
  saveSession(req, data.session, requireTimezone(req.body.timezone));
  return { user: data.user };
}

export async function resendSignupCode(req) {
  const email = normalizeEmail(req.body.email);
  const client = createAuthClient();
  const { error } = await client.auth.resend({ type: 'signup', email });
  if (error) throw new AppError(400, 'RESEND_FAILED', 'The confirmation code could not be sent. Check your email settings and try again later.');
  return { sent: true };
}

export async function login(req) {
  const email = normalizeEmail(req.body.email);
  const password = requireString(req.body.password, 'Password', { min: 1, max: 72 });
  const timezone = requireTimezone(req.body.timezone);
  const client = createAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new AppError(401, 'LOGIN_FAILED', 'Email or password is incorrect.');
  saveSession(req, data.session, timezone);
  return { user: data.user };
}

export function logout(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => error ? reject(error) : resolve());
  });
}
