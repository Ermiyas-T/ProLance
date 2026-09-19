"use client";

// Sidebar — role-aware application navigation (Architecture.md §4, §2).
// Two visibility modes:
//   Mobile  → off-canvas drawer (open/onClose props)
//   Desktop → fixed left column; collapsible to icon-rail via `collapsed` prop.
// Dependency-free (inline SVGs + usePathname), matching the rest of the codebase.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/app/providers";
import type { Role } from "@/types/entities";

// A single navigation entry paired with the SVG icon component that renders it.
interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

// A labelled group of nav items; used to give the sidebar visual structure.
interface NavSection {
  label: string;
  items: NavItem[];
}

// --- Inline icon set (stroke-based, consistent viewBox) ---
const icons = {
  home: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
    </svg>
  ),
  projects: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  marketplace: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM8 12a3 3 0 013-3" />
    </svg>
  ),
  proposals: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  contracts: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  disputes: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  audit: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  profile: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// Source of truth for which nav entries each role sees. Keys mirror Role.
// Items only point at routes that actually exist under src/app/(app)/
// (Architecture.md §4) — no invented endpoints.
const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  CLIENT: [
    {
      label: "Workspace",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: icons.home },
        { label: "My projects", href: "/projects", icon: icons.projects },
        { label: "Contracts", href: "/contracts", icon: icons.contracts },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Profile", href: "/profile", icon: icons.profile },
        { label: "Settings", href: "/settings", icon: icons.settings },
      ],
    },
  ],
  FREELANCER: [
    {
      label: "Workspace",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: icons.home },
        { label: "Marketplace", href: "/marketplace", icon: icons.marketplace },
        { label: "Proposals", href: "/proposals", icon: icons.proposals },
        { label: "Contracts", href: "/contracts", icon: icons.contracts },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Profile", href: "/profile", icon: icons.profile },
        { label: "Settings", href: "/settings", icon: icons.settings },
      ],
    },
  ],
  ADMIN: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/admin/overview", icon: icons.home },
        { label: "Dashboard", href: "/dashboard", icon: icons.home },
        { label: "Contracts", href: "/contracts", icon: icons.contracts },
      ],
    },
    {
      label: "Moderation",
      items: [
        { label: "Users", href: "/admin/users", icon: icons.users },
        { label: "Disputes", href: "/admin/disputes", icon: icons.disputes },
        { label: "Audit logs", href: "/admin/audit-logs", icon: icons.audit },
      ],
    },
    {
      label: "Account",
      items: [{ label: "Settings", href: "/settings", icon: icons.settings }],
    },
  ],
};

// Decide whether a nav item should render as active for the current path.
// Prefix match covers dynamic children (`/projects/123`, `/admin/users/4`).
function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith("/") ? href : `${href}/`);
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onCollapsedChange: () => void;
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onCollapsedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const role = user?.role ?? "CLIENT";
  const sections = NAV_BY_ROLE[role] ?? [];

  // Close the mobile drawer on Escape, matching the shared interaction pattern.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const initials =
    (user?.full_name ?? "?")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // Render one accessible navigation tree for each viewport-specific shell.
  const navBody = (isCollapsed: boolean, isMobile: boolean) => (
    <div
      className={`flex h-full flex-col border-r border-border bg-card transition-[width] duration-200 ease-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        onClick={onClose}
        className={`flex h-16 shrink-0 items-center border-b border-border ${
          isCollapsed ? "justify-center px-3" : "gap-2.5 px-5"
        }`}
        title={isCollapsed ? "ProLance" : undefined}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          P
        </span>
        {!isCollapsed && <span className="text-lg font-bold text-foreground">ProLance</span>}
      </Link>

      {/* Role-scoped navigation */}
      <nav
        className={`flex-1 space-y-6 overflow-y-auto py-4 ${isCollapsed ? "px-2" : "px-3"}`}
        aria-label="Main"
      >
        {sections.map((section) => (
          <div key={section.label}>
            {!isCollapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    className={`group flex rounded-lg py-2 text-sm font-medium transition-colors ${
                      isCollapsed ? "justify-center px-2" : "items-center gap-3 px-3"
                    } ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span
                      className={
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      }
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={`shrink-0 border-t border-border py-3 ${isCollapsed ? "px-3" : "px-4"}`}>
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
            {initials}
          </span>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop control keeps compact mode discoverable without using header space. */}
      {!isMobile && (
        <button
          type="button"
          onClick={onCollapsedChange}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground lg:flex"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={isCollapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: always-visible fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">{navBody(collapsed, false)}</aside>

      {/* Mobile: off-canvas drawer with a dimmed overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default bg-black/50"
        />
        <aside
          className={`absolute inset-y-0 left-0 transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {navBody(false, true)}
        </aside>
        {open && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-neutral-900 shadow-sm"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
