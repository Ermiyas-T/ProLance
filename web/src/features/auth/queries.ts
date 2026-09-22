// Query keys + queryOptions for auth — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { getMe } from "./api";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

// Fetches the current user after client hydration; cookies authenticate the request invisibly.
export const meQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: getMe,
    enabled,
    // Never cache a stale user — re-validate on every mount/focus
    staleTime: 0,
  });
