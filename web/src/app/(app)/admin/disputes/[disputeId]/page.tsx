"use client";

// Admin resolve view — start-review and resolve controls; the three-state
// workflow lives in the backend (Architecture.md §4).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { disputeDetailOptions, disputeKeys } from "@/features/disputes/queries";
import { startDisputeReview, resolveDispute } from "@/features/disputes/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";

export default function AdminDisputeResolvePage() {
  const params = useParams();
  const disputeId = Number(params.disputeId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  if (user.role !== "ADMIN") {
    router.replace("/dashboard");
    return null;
  }

  const [resolution, setResolution] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);

  const { data: dispute, isLoading } = useQuery(disputeDetailOptions(disputeId));

  const startReviewMutation = useMutation({
    mutationFn: () => startDisputeReview(disputeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(disputeId) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.open() });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveDispute(disputeId, { resolution: resolution.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(disputeId) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.open() });
      setResolution("");
    },
    onError: (err: ApiError) => {
      setResolveError(err.message || "Failed to resolve dispute.");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-48 bg-muted rounded-lg animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">Dispute not found.</p>
            <Link href="/admin/disputes" className="mt-3 inline-block text-sm text-foreground font-medium hover:underline">
              Back to queue
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isOpen = dispute.status === "OPEN";
  const isUnderReview = dispute.status === "UNDER_REVIEW";
  const isResolved = dispute.status === "RESOLVED";

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

      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground">{dispute.title}</h1>
            <StatusBadge status={dispute.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Dispute #{dispute.id} · Contract #{dispute.contract_id} · Opened by #{dispute.opened_by}
          </p>
        </div>

        {/* Description */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Description</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.description}</p>
        </div>

        {/* Admin actions */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Admin actions</h3>

          {isOpen && (
            <button
              onClick={() => startReviewMutation.mutate()}
              disabled={startReviewMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {startReviewMutation.isPending ? "Starting review…" : "Start review"}
            </button>
          )}

          {isUnderReview && (
            <div className="space-y-3">
              <textarea
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                  setResolveError(null);
                }}
                rows={4}
                placeholder="Describe the resolution decision..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              {resolveError && (
                <p className="text-sm text-destructive">{resolveError}</p>
              )}
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={!resolution.trim() || resolveMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {resolveMutation.isPending ? "Resolving…" : "Resolve dispute"}
              </button>
            </div>
          )}

          {isResolved && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                This dispute has been resolved.
              </p>
              {dispute.resolution && (
                <p className="text-sm text-green-700 dark:text-green-400 mt-2 whitespace-pre-wrap">
                  {dispute.resolution}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Details</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={dispute.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Opened</span>
              <span className="text-sm text-foreground">{formatDate(dispute.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last updated</span>
              <span className="text-sm text-foreground">{formatDate(dispute.updated_at)}</span>
            </div>
            {dispute.resolved_by && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resolved by</span>
                <span className="text-sm text-foreground">Admin #{dispute.resolved_by}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/admin/disputes"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to queue
          </Link>
        </div>
      </main>
    </div>
  );
}
