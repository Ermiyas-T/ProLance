// Thin top progress line shown during background refetch (Architecture.md §2).
// Uses TanStack Query's global fetching state.

import { useIsFetching } from "@tanstack/react-query";

export function RefreshIndicator() {
  const isFetching = useIsFetching();

  if (!isFetching) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20">
      <div className="h-full bg-primary animate-[shimmer_1.5s_infinite]" />
    </div>
  );
}
