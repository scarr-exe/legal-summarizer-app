'use client';

/**
 * Client-side auth state for the Next.js frontend talking to the Django +
 * SimpleJWT backend. Tokens live in localStorage (see api.ts) rather than
 * httpOnly cookies — a deliberate simplification for this project's scope,
 * traded off against XSS exposure (see Chapter 5 limitations).
 *
 * The access token is short-lived (1 hour, set in backend/config/settings.py).
 * Rather than log the user out when it expires, a timer silently exchanges
 * the refresh token (7 days) for a new access token shortly before expiry.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import * as api from './api';

const REFRESH_MARGIN_MS = 60_000; // refresh 1 minute before the access token actually expires

interface AuthUser {
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Returns an access token guaranteed to be valid for the next request,
   * refreshing first if it's close to expiry. Pages should call this right
   * before hitting the API rather than reading a token from state directly. */
  getValidAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const clearRefreshTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const logout = useCallback(() => {
    clearRefreshTimer();
    accessRef.current = null;
    refreshRef.current = null;
    api.clearSession();
    setUser(null);
    router.push('/login');
  }, [router]);

  // applyTokens re-arms the refresh timer, and the timer's callback needs
  // to call applyTokens again for the *next* cycle. These refs break that
  // cycle without a stale closure — a direct mutual reference between two
  // useCallbacks would leave one capturing an outdated version of the other.
  const applyTokensRef = useRef<((access: string, refresh: string) => void) | null>(null);
  const logoutRef = useRef(logout);

  const applyTokens = useCallback((access: string, refresh: string) => {
    accessRef.current = access;
    refreshRef.current = refresh;

    clearRefreshTimer();
    const expiryMs = api.getTokenExpiryMs(access);
    if (!expiryMs) return;

    const delay = Math.max(expiryMs - Date.now() - REFRESH_MARGIN_MS, 5_000);
    timerRef.current = setTimeout(async () => {
      const currentRefresh = refreshRef.current;
      if (!currentRefresh) return;
      try {
        const newAccess = await api.refreshAccessToken(currentRefresh);
        // Persist the rotated access token — without this, a reload after a
        // silent refresh would rehydrate from a stale token in localStorage.
        const session = api.getStoredSession();
        api.storeSession({ access: newAccess, refresh: currentRefresh }, session?.username ?? '');
        applyTokensRef.current?.(newAccess, currentRefresh);
      } catch {
        logoutRef.current();
      }
    }, delay);
  }, []);

  useEffect(() => {
    applyTokensRef.current = applyTokens;
    logoutRef.current = logout;
  }, [applyTokens, logout]);

  useEffect(() => {
    const session = api.getStoredSession();
    if (!session) {
      setIsLoading(false);
      return;
    }

    const expiryMs = api.getTokenExpiryMs(session.access);
    const rehydrate = async () => {
      try {
        if (expiryMs && expiryMs - Date.now() > REFRESH_MARGIN_MS) {
          applyTokens(session.access, session.refresh);
        } else {
          const newAccess = await api.refreshAccessToken(session.refresh);
          api.storeSession({ access: newAccess, refresh: session.refresh }, session.username ?? '');
          applyTokens(newAccess, session.refresh);
        }
        setUser({ username: session.username ?? '' });
      } catch {
        api.clearSession();
      } finally {
        setIsLoading(false);
      }
    };
    rehydrate();

    return clearRefreshTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const tokens = await api.login(username, password);
      api.storeSession(tokens, username);
      applyTokens(tokens.access, tokens.refresh);
      setUser({ username });
    },
    [applyTokens]
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await api.register(username, email, password);
      await login(username, password);
    },
    [login]
  );

  const getValidAccessToken = useCallback(async () => {
    const access = accessRef.current;
    const refresh = refreshRef.current;
    if (!access || !refresh) {
      throw new api.ApiError('Not authenticated.', 401);
    }
    const expiryMs = api.getTokenExpiryMs(access);
    if (expiryMs && expiryMs - Date.now() < REFRESH_MARGIN_MS) {
      const newAccess = await api.refreshAccessToken(refresh);
      const session = api.getStoredSession();
      api.storeSession({ access: newAccess, refresh }, session?.username ?? '');
      applyTokens(newAccess, refresh);
      return newAccess;
    }
    return access;
  }, [applyTokens]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, getValidAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Redirects to /login once the initial auth rehydration finishes and no
 * user was found. Pages under protected routes call this and render nothing
 * (or a spinner) while isLoading/redirecting. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.replace('/login');
    }
  }, [auth.isLoading, auth.user, router]);

  return auth;
}
