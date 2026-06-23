import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { storage } from '../lib/storage';
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore token from secure store and validate it
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getToken();
        if (!token) return;
        setAccessToken(token);
        const { user: me } = await apiGet<{ user: User }>('/api/auth/me');
        setUser(me);
      } catch {
        await storage.clearToken();
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/login',
      { email, password },
    );
    await storage.setToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function register(email: string, username: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/register',
      { email, username, password },
    );
    await storage.setToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    await apiPost('/api/auth/logout').catch(() => {});
    await storage.clearToken();
    setAccessToken(null);
    setUser(null);
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
