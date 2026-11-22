import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setError('');
      return data.user;
    } catch (requestError) {
      if (requestError.status === 401) { setUser(null); return null; }
      setError(requestError.message);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    setError('');
    await authApi.login({ email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila' });
    return refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (email, password) => {
    setError('');
    const data = await authApi.register({ email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila' });
    if (data.confirmationRequired) return { confirmationRequired: true };
    await refreshUser();
    return { confirmationRequired: false };
  }, [refreshUser]);

  const verifySignup = useCallback(async (email, token) => {
    setError('');
    await authApi.verifySignup({ email, token, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila' });
    return true;
  }, []);

  const resendSignupCode = useCallback(async (email) => {
    setError('');
    await authApi.resendSignupCode({ email });
  }, []);

  const logout = useCallback(async () => { await authApi.logout(); setUser(null); }, []);
  const value = useMemo(() => ({ user, loading, error, setError, login, register, verifySignup, resendSignupCode, logout, refreshUser }), [user, loading, error, login, register, verifySignup, resendSignupCode, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
