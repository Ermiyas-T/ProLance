"use client";

// SessionProvider manages the auth lifecycle: token storage (in-memory only,
// never localStorage), user state, login/logout, and the event-bus that the
// ReauthModal and api-client use for silent re-login (Architecture.md §3.3).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";

import { login as apiLogin } from "@/features/auth/api";
import { authKeys, meQueryOptions } from "@/features/auth/queries";
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
  setUser: (user: User) => void;
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

  // In-memory token — null means unauthenticated
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Fetch the current user whenever we have a token
  const { data: userData, isLoading: isUserLoading } = useQuery(
    meQueryOptions(!!token),
  );

  // Sync the query result into session state
  useEffect(() => {
    if (userData) setUser(userData);
  }, [userData]);

  // Keep the lib/session.ts store in sync so apiFetch can read the token
  useEffect(() => {
    sessionStore.token = token;
  }, [token]);

  // Wire the ReauthModal open signal — when api-client calls session.openReauth(),
  // we set a flag the ReauthModal component can read
  const [reauthRequested, setReauthRequested] = useState(false);
  useEffect(() => {
    sessionStore.openReauth = () => setReauthRequested(true);
  }, []);

  // Login: exchange credentials for a token, then fetch the user
  const login = useCallback(
    async (email: string, password: string) => {
      const res: TokenResponse = await apiLogin({ email, password });
      setToken(res.access_token);
      // Invalidate and re-fetch /auth/me with the new token
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
    [queryClient],
  );

  // Logout: clear token + user, purge all cached data
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    sessionStore.token = null;
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      token,
      user,
      isLoading: isUserLoading && !!token,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      setUser,
    }),
    [token, user, isUserLoading, login, logout],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      {/* ReauthModal reads this flag; we pass it down so the modal can clear it */}
      {reauthRequested && (
        <ReauthModalShell
          onResolved={() => {
            setReauthRequested(false);
            queryClient.invalidateQueries({ queryKey: authKeys.me() });
          }}
          onDismiss={() => setReauthRequested(false)}
        />
      )}
    </SessionContext.Provider>
  );
}

// Lightweight inline re-auth prompt — captures password and retries
function ReauthModalShell({
  onResolved,
  onDismiss,
}: {
  onResolved: () => void;
  onDismiss: () => void;
}) {
  const { user } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiLogin({ email: user.email, password });
      // Import resolvePendingReauth to unblock queued requests
      const { resolvePendingReauth } = await import("@/lib/api-client");
      resolvePendingReauth();
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
        <h2 className="text-lg font-semibold mb-2">Session expired</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your session has expired. Enter your password to continue where you left off.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm
              placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log out
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg
                font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Authenticating…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
