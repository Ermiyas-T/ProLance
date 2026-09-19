"use client";

// Authenticated layout shell handling session verification, role-aware
// navigation (Sidebar), the sticky top bar (AppHeader), and content flow.
// Owns the navigation state shared between AppHeader and Sidebar.
import { useSession } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/shared/app-header";
import { Sidebar } from "@/components/shared/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);

  // redirect to login page if session initialization finishes and no authenticated user exists
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // render loading placeholder while verifying the active authentication session
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading session…
        </div>
      </div>
    );
  }

  // Persistent app chrome: fixed sidebar on desktop, sticky header up top,
  // each page renders its own <main> content in the flex-1 column below.
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={desktopNavCollapsed}
        onCollapsedChange={() => setDesktopNavCollapsed((current) => !current)}
      />
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ease-out ${
          desktopNavCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        <AppHeader onMenuClick={() => setMobileNavOpen(true)} />
        {children}
      </div>
    </div>
  );
}
