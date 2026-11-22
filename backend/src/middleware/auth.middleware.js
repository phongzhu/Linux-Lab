import { createAuthClient } from '../config/database.js';
import AppError from './AppError.js';

export async function requireAuth(req, _res, next) {
  try {
    const session = req.session?.auth;
    if (!session?.accessToken) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const auth = createAuthClient();
    let { data, error } = await auth.auth.getUser(session.accessToken);
    if (error && session.refreshToken) {
      const refreshed = await auth.auth.refreshSession({ refresh_token: session.refreshToken });
      if (!refreshed.error && refreshed.data.session) {
        req.session.auth = { accessToken: refreshed.data.session.access_token, refreshToken: refreshed.data.session.refresh_token, user: refreshed.data.user, timezone: session.timezone };
        data = { user: refreshed.data.user };
        error = null;
      }
    }
    if (error || !data.user) throw new AppError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.');
    req.user = data.user;
    req.accessToken = req.session.auth.accessToken;
    next();
  } catch (error) { next(error); }
}
