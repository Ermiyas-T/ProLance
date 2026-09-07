"use client";

// Admin dispute queue — OPEN + UNDER_REVIEW, newest first (Architecture.md §4).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { openDisputesOptions } from "@/features/disputes/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatDate } from "@/lib/format";

export default function AdminDisputesPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  // Additional guard: only admins should see this page
  if (user.role !== "ADMIN") {
    router.replace("/dashboard");
    return null;
  }

  const { data: disputes = [], isLoading } = useQuery(openDisputesOptions);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="text-lg font-bold text-foreground hover:opacity-80 transition-opacity">
          ProLance
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">{user.full_name}</span>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dispute queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open and under-review disputes requiring attention.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : disputes.length > 0 ? (
          <div className="space-y-3">
            {disputes.map((dispute) => (
              <Link
                key={dispute.id}
                href={`/admin/disputes/${dispute.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {dispute.title}
                      </h3>
                      <StatusBadge status={dispute.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {dispute.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contract #{dispute.contract_id} · Opened by #{dispute.opened_by}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(dispute.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">No open disputes.</p>
          </div>
        )}
      </main>
    </div>
  );
}
