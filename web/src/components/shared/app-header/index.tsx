"use client";

// AppHeader — sticky top bar for the authenticated shell. Contains the mobile
// hamburger (which opens the off-canvas sidebar), a title-less spacer, and the
// shared ThemeToggle + UserMenu. The desktop sidebar is always visible, so the
// hamburger only renders below the lg breakpoint.
import { useSession } from "@/app/providers";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";

export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      {/* Mobile menu toggle — sidebar is persistent on larger screens */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Keeps the right-side controls aligned on mobile */}
      <div className="lg:hidden" />

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && <UserMenu fullName={user.full_name} />}
      </div>
    </header>
  );
}