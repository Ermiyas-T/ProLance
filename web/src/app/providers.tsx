"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";

import { login as apiLogin, logout as apiLogout } from "@/features/auth/api";
import { meQueryOptions } from "@/features/auth/queries";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/lib/theme";
import type { User } from "@/types/entities";

interface SessionContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// expose session state only to components rendered beneath the provider tree
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}

// compose application-wide query, theme, and authenticated-session providers once
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// derive authentication from the HttpOnly-cookie-backed current-user request
export function SessionProvider({ children }: { children: ReactNode }) {
  const activeQueryClient = useQueryClient();

  // resolve the browser's cookie-backed identity immediately without mirroring token state
  const { data: userData, isError } = useQuery(meQueryOptions(true));
  const user = userData ?? null;

  // redirect only after access renewal has failed, never for an ordinary API error
  useEffect(() => {
    const handleSessionExpired = () => {
      activeQueryClient.clear();
      window.location.replace("/login");
    };
    window.addEventListener("prolance:session-expired", handleSessionExpired);
    return () => window.removeEventListener("prolance:session-expired", handleSessionExpired);
  }, [activeQueryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      // authenticate first so the following identity request uses fresh HttpOnly cookies
      await apiLogin({ email, password });
      await activeQueryClient.fetchQuery({ ...meQueryOptions(true), staleTime: 0 });
    },
    [activeQueryClient],
  );

  const logout = useCallback(async () => {
    // clear cached private data even if an offline browser cannot reach the revoke endpoint
    await apiLogout().catch(() => undefined);
    activeQueryClient.clear();
  }, [activeQueryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      // a hard-load waits for /auth/me, while a rejected identity check lets layouts redirect
      isLoading: !user && !isError,
      isAuthenticated: !!user,
      login,
      logout,
    }),
    [user, isError, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
