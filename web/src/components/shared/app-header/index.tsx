"use client";

// AppHeader — sticky top bar for the authenticated shell. Provides the
// mobile hamburger, contextual breadcrumb, a global search trigger, and
// the user controls area (theme toggle + user menu). Designed to feel
// spatial and polished with glassmorphism, subtle separators, and
// micro-interactions matching a senior-level SaaS product.

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useSession } from "@/app/providers";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import type { Role } from "@/types/entities";

// ─── Breadcrumb derivation from pathname ──────────────────────────────

// Human-readable labels for known route segments
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  marketplace: "Marketplace",
  proposals: "Proposals",
  contracts: "Contracts",
  disputes: "Disputes",
  admin: "Admin",
  users: "Users",
  "audit-logs": "Audit Logs",
  profile: "Profile",
  settings: "Settings",
  freelancers: "Freelancers",
  new: "New",
  overview: "Overview",
};

interface Breadcrumb {
  label: string;
  href: string;
  isLast: boolean;
}

// Build breadcrumbs from the current pathname, skipping empty segments
function deriveBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  return segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    // If the segment looks like a numeric ID, show a short label
    const isId = /^\d+$/.test(segment);
    const label = isId
      ? `#${segment}`
      : SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);

    return { label, href, isLast: index === segments.length - 1 };
  });
}

// ─── Page title derivation from pathname ──────────────────────────────

// Pick the contextual page title based on the first meaningful segment
function derivePageTitle(pathname: string, role: Role): string {
  const segments = pathname.split("/").filter(Boolean);
  // Use the first segment to determine the page context
  const first = segments[0] ?? "dashboard";
  const second = segments[1];

  // Admin-scoped routes
  if (first === "admin" && second) {
    return SEGMENT_LABELS[second] ?? second.charAt(0).toUpperCase() + second.slice(1);
  }

  return SEGMENT_LABELS[first] ?? first.charAt(0).toUpperCase() + first.slice(1);
}

// ─── Notification bell (visual-only placeholder for future API) ───────

function NotificationBell() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {/* Activity dot — hidden until notification API is wired */}
    </button>
  );
}

// ─── Search trigger (navigates to search or opens command palette) ─────

function SearchTrigger() {
  return (
    <button
      type="button"
      aria-label="Search"
      className="hidden sm:flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground hover:border-muted-foreground/30 min-w-[180px] lg:min-w-[240px]"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="flex-1 text-left">Search…</span>
      {/* Keyboard shortcut hint */}
      <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}

// ─── Main header component ────────────────────────────────────────────

export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();
  const pathname = usePathname();
  const role = user?.role ?? "CLIENT";

  // Derive contextual breadcrumbs and page title from the current path
  const breadcrumbs = useMemo(() => deriveBreadcrumbs(pathname), [pathname]);
  const pageTitle = useMemo(() => derivePageTitle(pathname, role), [pathname, role]);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-3 px-4 sm:px-6">
        {/* ── Left zone: hamburger + breadcrumb ── */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Mobile menu toggle — sidebar handles desktop persistently */}
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Separator between hamburger and breadcrumb on mobile */}
          <div className="hidden h-5 w-px bg-border lg:block" />

          {/* Breadcrumb navigation — shows page hierarchy */}
          <nav aria-label="Breadcrumb" className="hidden min-w-0 lg:flex items-center">
            <ol className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <li key={crumb.href} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                    </svg>
                  )}
                  {crumb.isLast ? (
                    <span className="truncate font-medium text-foreground">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Mobile: show just the current page title instead of breadcrumbs */}
          <span className="truncate text-sm font-medium text-foreground lg:hidden">
            {pageTitle}
          </span>
        </div>

        {/* ── Center zone: search ── */}
        <SearchTrigger />

        {/* ── Right zone: actions ── */}
        <div className="flex items-center gap-1">
          <NotificationBell />

          {/* Vertical separator */}
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <ThemeToggle />

          {/* Vertical separator */}
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          {user && <UserMenu fullName={user.full_name} />}
        </div>
      </div>
    </header>
  );
}