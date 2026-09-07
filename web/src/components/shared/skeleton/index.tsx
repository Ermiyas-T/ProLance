// Skeleton primitives and shape presets (Architecture.md §2).
// Used on every list view while data is loading.

import type { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-muted rounded ${className}`}
      aria-hidden="true"
    />
  );
}

// Preset shapes for common patterns

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3" aria-hidden="true">
      {children ?? (
        <>
          <Skeleton className="h-5 w-1/3" />
          <SkeletonText lines={2} />
        </>
      )}
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-4 p-4" aria-hidden="true">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
