import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('hms_token'));

  // Restore the session after a page refresh
  useEffect(() => {
    if (!localStorage.getItem('hms_token')) return;
    authApi.me()
      .then((res) => setUser(res.data.data))
      .catch(() => localStorage.removeItem('hms_token'))
      .finally(() => setLoading(false));
  }, []);

  // Axios fires this when the token expires or the account is disabled
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('hms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hms:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await authApi.login(username, password);
    const { token, user: u } = res.data.data;
    localStorage.setItem('hms_token', token);
    setUser(u);
    return u;
  }, []);

  // reload the user from the server, optionally storing a new token first (after a password change)
  const refresh = useCallback(async (token) => {
    if (token) localStorage.setItem('hms_token', token);
    const res = await authApi.me();
    setUser(res.data.data);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('hms_token');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}