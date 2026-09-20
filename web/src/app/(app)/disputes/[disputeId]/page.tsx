"use client";

// Participant view of a single dispute — status, description, resolution.
// Admins use /admin/disputes/[disputeId] for resolve controls (Architecture.md §4).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { disputeDetailOptions } from "@/features/disputes/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";

export default function DisputePage() {
  const params = useParams();
  const disputeId = Number(params.disputeId);
  const router = useRouter();
  const { user } = useSession();

  const { data: dispute, isLoading } = useQuery(disputeDetailOptions(disputeId));

  // AppLayout ensures user is non-null before rendering; guard lives AFTER
  // all hooks (rules-of-hooks).
  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
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
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">Dispute not found.</p>
            <Link href="/contracts" className="mt-3 inline-block text-sm text-foreground font-medium hover:underline">
              Back to contracts
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground">{dispute.title}</h1>
            <StatusBadge status={dispute.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Dispute #{dispute.id} · Contract #{dispute.contract_id} · Opened {formatDate(dispute.created_at)}
          </p>
        </div>

        {/* Description */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Description</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.description}</p>
        </div>

        {/* Resolution — only shown when resolved */}
        {dispute.resolution && (
          <div className="bg-card rounded-lg border border-border p-6 mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">Resolution</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.resolution}</p>
            {dispute.resolved_by && (
              <p className="text-xs text-muted-foreground mt-2">
                Resolved by admin #{dispute.resolved_by} on {formatDate(dispute.updated_at)}
              </p>
            )}
          </div>
        )}

        {/* Status info */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current status</span>
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
          </div>
        </div>

        <div className="mt-6">
          <Link
            href={`/contracts/${dispute.contract_id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to contract
          </Link>
        </div>
      </main>
    </div>
  );
}
