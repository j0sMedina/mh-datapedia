import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { apiPost, apiGet, setAccessToken, setRefreshCallback } from '../lib/api';
import type { User } from '@mh-datapedia/shared';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    console.log('[auth] silentRefresh start');
    try {
      const data = await apiPost<{ accessToken: string }>('/api/auth/refresh');
      console.log('[auth] refresh success');
      setToken(data.accessToken);
      setAccessToken(data.accessToken);
      const me = await apiGet<{ user: User }>('/api/auth/me');
      setUser(me.user);
      return data.accessToken;
    } catch (e) {
      console.log('[auth] refresh failed (expected if not logged in):', e);
      setToken(null);
      setUser(null);
      setAccessToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    console.log('[auth] effect running, calling silentRefresh');
    setRefreshCallback(silentRefresh);
    silentRefresh().finally(() => {
      console.log('[auth] setIsLoading(false)');
      setIsLoading(false);
    });
  }, [silentRefresh]);

  async function login(email: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/login',
      { email, password },
    );
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function register(email: string, username: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/register',
      { email, username, password },
    );
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    await apiPost('/api/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
