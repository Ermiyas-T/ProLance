// Reusable, accessible metric stat card with shimmer loading, OKLCH gradient accents, and hover elevation
import Link from "next/link";
import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: string | number | undefined;
  subtitle?: string;
  icon: ReactNode;
  accentColor?: string;
  href?: string;
  loading?: boolean;
  badge?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  accentColor = "from-primary/30 to-primary/5",
  href,
  loading = false,
  badge,
}: StatCardProps) {
  // inner card body shared between linked and non-linked variants
  const cardBody = (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5">
      {/* gradient accent top bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentColor} opacity-80`} />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
              {label}
            </p>
            {badge && (
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            )}
          </div>

          {/* display loading skeleton while metric resolves */}
          {loading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-muted/70 mt-1" />
          ) : (
            <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {value ?? "—"}
            </p>
          )}

          {/* optional descriptive context */}
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* icon container with subtle hover accent */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {icon}
        </div>
      </div>
    </div>
  );

  // wrap in accessible link if an href destination is provided
  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
        {cardBody}
      </Link>
    );
  }

  return cardBody;
}
