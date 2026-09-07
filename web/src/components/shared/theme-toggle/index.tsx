"use client";

// ThemeToggle — cycles light → dark → system with icon feedback.
// Uses the useTheme hook from lib/theme.tsx.

import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme, theme } = useTheme();

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const label =
    theme === "system"
      ? "System"
      : theme === "dark"
        ? "Dark"
        : "Light";

  return (
    <button
      onClick={cycle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
        bg-neutral-100 text-neutral-700 hover:bg-neutral-200
        dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700
        transition-colors ${className ?? ""}`}
      aria-label={`Theme: ${label}. Click to cycle.`}
    >
      {resolvedTheme === "dark" ? (
        // Moon icon
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      ) : (
        // Sun icon
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
      {label}
    </button>
  );
}
