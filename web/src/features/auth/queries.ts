// Query keys + queryOptions for auth — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { getMe } from "./api";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

// Fetches the current user; disabled when no token is set.
// The SessionProvider controls the `enabled` flag based on session.token.
export const meQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: getMe,
    enabled,
    // Never cache a stale user — re-validate on every mount/focus
    staleTime: 0,
  });
