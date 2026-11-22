import * as authService from '../services/authService.js';

export async function register(req, res) {
  const result = await authService.register(req);
  res.status(result.confirmationRequired ? 202 : 201).json(result);
}

export async function verifySignup(req, res) { res.json(await authService.verifySignup(req)); }
export async function resendSignupCode(req, res) { res.json(await authService.resendSignupCode(req)); }

export async function login(req, res) { res.json(await authService.login(req)); }
export async function logout(req, res) { await authService.logout(req); res.clearCookie('linux.sid'); res.json({ ok: true }); }
export function me(req, res) { res.json({ user: { id: req.user.id, email: req.user.email } }); }
