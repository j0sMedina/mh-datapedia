import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { apiPost, apiGet, setAccessToken, setRefreshCallback, ApiError } from '../lib/api';
import type { User } from '@mh-datapedia/shared';
import type { BanDetails } from '../lib/types';
import { BannedModal } from '../components/ui/BannedModal';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  bannedDetails: BanDetails | null;
  clearBannedDetails: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function extractBanDetails(body: unknown): BanDetails | null {
  if (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    (body as Record<string, unknown>).code === 'BANNED'
  ) {
    const b = body as Record<string, unknown>;
    return {
      bannedReason: (b.bannedReason as string) ?? 'No reason provided',
      bannedAt: (b.bannedAt as string | null) ?? null,
      bannedUntil: (b.bannedUntil as string | null) ?? null,
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bannedDetails, setBannedDetails] = useState<BanDetails | null>(null);

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const data = await apiPost<{ accessToken: string }>('/api/auth/refresh');
      setToken(data.accessToken);
      setAccessToken(data.accessToken);
      const me = await apiGet<{ user: User }>('/api/auth/me');
      setUser(me.user);
      return data.accessToken;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const details = extractBanDetails(e.body);
        if (details) setBannedDetails(details);
      }
      setToken(null);
      setUser(null);
      setAccessToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setRefreshCallback(silentRefresh);
    silentRefresh().finally(() => setIsLoading(false));
  }, [silentRefresh]);

  async function login(email: string, password: string): Promise<void> {
    try {
      const data = await apiPost<{ user: User; accessToken: string }>(
        '/api/auth/login',
        { email, password },
      );
      setToken(data.accessToken);
      setUser(data.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const details = extractBanDetails(e.body);
        if (details) {
          setBannedDetails(details);
          return;
        }
      }
      throw e;
    }
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

  function clearBannedDetails() {
    setBannedDetails(null);
  }

  async function handleBannedLogout() {
    await logout();
    clearBannedDetails();
    window.location.replace('/');
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, bannedDetails, clearBannedDetails, login, register, logout }}
    >
      {children}
      {bannedDetails && (
        <BannedModal
          bannedReason={bannedDetails.bannedReason}
          bannedAt={bannedDetails.bannedAt}
          bannedUntil={bannedDetails.bannedUntil}
          onLogout={handleBannedLogout}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
