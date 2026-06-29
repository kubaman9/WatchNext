import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../services/api';
import { clearState } from '../services/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on first load.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
  }

  async function signup(email, password, name) {
    const { token, user } = await api.signup(email, password, name);
    setToken(token);
    setUser(user);
  }

  function logout() {
    setToken(null);
    setUser(null);
    // Clear local cache + session so the next sign-in starts clean (no data leak).
    clearState();
    sessionStorage.removeItem('wn_fired');
    location.reload();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
