"use client";

// Contract list for both roles (Architecture.md §4).
// Table/cards: project title, other party, agreed price, status, deadline.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { contractListOptions } from "@/features/contracts/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatMoney, formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default function ContractsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(contractListOptions(page, PAGE_SIZE));

  const contracts = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

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
          <h1 className="text-2xl font-bold text-foreground">My contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active and completed contracts you&apos;re a part of.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : contracts.length > 0 ? (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        Contract #{contract.id}
                      </h3>
                      <StatusBadge status={contract.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Project #{contract.project_id} · Freelancer #{contract.freelancer_id}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-foreground">
                      {formatMoney(contract.agreed_price)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {formatDate(contract.deadline)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">No contracts yet.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total ?? 0} contracts)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
