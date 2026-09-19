"use client";

// SessionProvider manages the auth lifecycle: token storage (cookie-backed,
// 7-day JWT from the backend), user state, login/logout. On token expiry the
// api-client clears the session and the user is redirected to /login — there
// is deliberately no in-page password recovery dialog.
//
// Auth-state design (race-free by construction):
// - `token` is mirrored state, hydrated once from the cookie on mount.
// - `user` is derived DIRECTLY from the /auth/me query result — never
//   mirrored into separate state. Mirroring caused a one-render window where
//   "loading" was already false but `user` was still null, which made
//   AppLayout bounce logged-in users from /profile and other deep links.
//   Derived data exists in the same render the query resolves, so the
//   loading gate below is always truthful.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";

import { login as apiLogin } from "@/features/auth/api";
import { authKeys, meQueryOptions } from "@/features/auth/queries";
import { ApiError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/lib/theme";
import type { User } from "@/types/entities";
import { session as sessionStore } from "@/lib/session";
import type { TokenResponse } from "@/features/auth/types";

interface SessionContextValue {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Hook for consuming the session — throws if used outside SessionProvider
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

// Top-level provider stack: QueryClient → Theme → Session
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Guard: the token-sync effect below must not run on the very first pass,
  // or it would wipe the cookie the mount sync is about to read.
  const mountedRef = useRef(false);

  // On initial client mount, hydrate token state from the auth cookie.
  useEffect(() => {
    const existingToken = sessionStore.token;
    if (existingToken) {
      setToken(existingToken);
    }
    setIsInitializing(false);
  }, []);

  // Single source of truth for the authenticated user.
  const {
    data: userData,
    isError: isUserError,
    error: userError,
  } = useQuery(meQueryOptions(!!token));

  const user: User | null = userData ?? null;

  // If /auth/me explicitly rejects with 401, the token is invalid/expired —
  // clear it (the api-client has already redirected to /login).
  // Non-401 errors (network hiccups, 500s) must NOT clear the session.
  useEffect(() => {
    const is401 =
      isUserError && userError instanceof ApiError && userError.status === 401;
    if (is401 && token) {
      sessionStore.setToken(null);
      setToken(null);
    }
  }, [isUserError, userError, token]);

  // Keep lib/session.ts store in sync with token state — but only after
  // mount, so an initial render with local `null` doesn't delete the cookie
  // that was just read from disk.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    sessionStore.setToken(token);
  }, [token]);

  // A non-401 failure of /auth/me (network blip, 5xx) means "could not
  // determine auth state" — surfaces as not-loading so AppLayout can decide.
  const meQueryFailedNon401 =
    isUserError && !(userError instanceof ApiError && userError.status === 401);

  // Login: exchange credentials for a token, set cookie, then fetch the user
  const login = useCallback(
    async (email: string, password: string) => {
      const res: TokenResponse = await apiLogin({ email, password });
      // Sync session store + cookie BEFORE invalidating queries so /auth/me reads token
      sessionStore.setToken(res.access_token);
      setToken(res.access_token);
      // Invalidate and re-fetch /auth/me with the new token
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
    [queryClient],
  );

  // Logout: clear token + cookie, purge all cached data
  const logout = useCallback(() => {
    setToken(null);
    sessionStore.setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      token,
      user,
      // TRUTHY loading gate — the auth-state contract AppLayout relies on:
      // - initializing (cookie not yet read)   → loading
      // - token present, user not resolved yet → loading (hard page-loads of
      //   /profile etc. wait for /auth/me instead of bouncing to /login)
      // - no token, or non-401 query failure   → not loading (decide: redirect)
      isLoading:
        isInitializing || (!!token && !user && !meQueryFailedNon401),
      isAuthenticated: !!token && !!user,
      login,
      logout,
    }),
    [token, user, isInitializing, meQueryFailedNon401, login, logout],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
