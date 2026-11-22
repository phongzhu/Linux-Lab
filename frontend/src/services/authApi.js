import { request } from './apiClient';

export const authApi = {
  me: () => request('/auth/me'),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  verifySignup: (body) => request('/auth/verify-signup', { method: 'POST', body }),
  resendSignupCode: (body) => request('/auth/resend-signup-code', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
