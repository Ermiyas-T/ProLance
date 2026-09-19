"use client";

// UserMenu — avatar button that opens a dropdown with Profile, Settings, and
// Log out. Dependency-free (no Radix): click-outside and Escape close it,
// focus moves into the menu on open, and it closes on navigation.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useSession } from "@/app/providers";

export function UserMenu({ fullName }: { fullName: string }) {
  const router = useRouter();
  const { logout } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const initials =
    fullName
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // Close on click-outside, Escape, or navigation to a different page.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  const handleLogout = () => {
    close();
    logout();
    router.push("/login");
  };

  const itemClass =
    "block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${fullName}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-1.5 py-1 hover:bg-secondary transition-colors"
      >
        <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center shrink-0">
          {initials}
        </span>
        <span className="hidden sm:inline max-w-[9rem] truncate text-sm text-foreground">
          {fullName}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-background shadow-lg z-50 py-1"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={close}
            className={itemClass}
          >
            Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={close}
            className={itemClass}
          >
            Settings
          </Link>
          <div role="separator" className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className={`${itemClass} text-red-600 dark:text-red-400 hover:bg-red-500/10`}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
