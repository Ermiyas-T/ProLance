"use client";

// Admin-only guard — second belt-and-suspenders check with useSession()
// next to middleware.ts; redirects non-admins to /dashboard (Architecture.md §4).
import { useSession } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useSession();

  // Redirect non-admins once the session is resolved. While loading (or
  // before the user is known) keep rendering the placeholder below.
  const isAdmin = user?.role === "ADMIN";
  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, isAdmin, router]);

  if (isLoading || !user || !isAdmin) {
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

  return <>{children}</>;
}
