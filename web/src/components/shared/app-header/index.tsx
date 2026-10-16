"use client";

// AppHeader — sticky top bar for the authenticated shell. Provides the
// mobile hamburger, contextual breadcrumb, an interactive quick-jump search palette (⌘K),
// and the user controls area (theme toggle + user menu).

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
function derivePageTitle(pathname: string): string {
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

// ─── Quick Jump Item Type ─────────────────────────────────────────────

interface QuickJumpItem {
  label: string;
  href: string;
  category: string;
  description: string;
}

// Role-specific quick navigation items
const QUICK_ITEMS_BY_ROLE: Record<Role, QuickJumpItem[]> = {
  CLIENT: [
    { label: "Dashboard", href: "/dashboard", category: "Workspace", description: "Projects and contracts overview" },
    { label: "My Projects", href: "/projects", category: "Workspace", description: "Manage posted projects and briefs" },
    { label: "Create Project", href: "/projects/new", category: "Actions", description: "Post a new project brief" },
    { label: "Contracts", href: "/contracts", category: "Workspace", description: "Active agreements and deliverables" },
    { label: "Profile", href: "/profile", category: "Account", description: "Client identity and preferences" },
  ],
  FREELANCER: [
    { label: "Dashboard", href: "/dashboard", category: "Workspace", description: "Proposals and opportunities hub" },
    { label: "Marketplace", href: "/marketplace", category: "Discovery", description: "Browse open projects and submit proposals" },
    { label: "My Proposals", href: "/proposals", category: "Workspace", description: "Track submitted proposals status" },
    { label: "Contracts", href: "/contracts", category: "Workspace", description: "Active contracts, tasks, and deliverables" },
    { label: "Profile", href: "/profile", category: "Account", description: "Skills, bio, and portfolio items" },
  ],
  ADMIN: [
    { label: "Dashboard", href: "/dashboard", category: "Moderation", description: "Urgent dispute triage and queue" },
    { label: "Operations Overview", href: "/admin/overview", category: "Operations", description: "Marketplace metrics and queue distribution" },
    { label: "Dispute Queue", href: "/admin/disputes", category: "Moderation", description: "Active disputes awaiting review or resolution" },
    { label: "Contracts", href: "/contracts", category: "Workspace", description: "Review platform contract states" },
  ],
};

// ─── Main header component ────────────────────────────────────────────

export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user } = useSession();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const role = user?.role ?? "CLIENT";
  const quickItems = QUICK_ITEMS_BY_ROLE[role] ?? [];

  // Derive contextual breadcrumbs and page title from the current path
  const breadcrumbs = useMemo(() => deriveBreadcrumbs(pathname), [pathname]);
  const pageTitle = useMemo(() => derivePageTitle(pathname), [pathname]);

  // filter quick items according to search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return quickItems;
    const lower = searchQuery.toLowerCase();
    return quickItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower)
    );
  }, [quickItems, searchQuery]);

  // listen for global keyboard shortcuts (Cmd+K / Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // toggle search on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      // close search modal on Escape
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // handle item selection and navigation
  const handleSelect = (href: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  };

  return (
    <>
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

          {/* ── Center zone: search trigger ── */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Quick jump search"
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

      {/* ── Quick-Jump Search Modal ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <svg className="h-5 w-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to page or section…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                ESC
              </button>
            </div>

            {/* Results list */}
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No destinations found matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredItems.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary text-sm group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {item.label}
                          </span>
                          <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        ↵
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}