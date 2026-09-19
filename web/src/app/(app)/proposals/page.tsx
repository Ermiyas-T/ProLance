"use client";

// Freelancer "my proposals" status tracker (Architecture.md §4).
// Tabs/chips: PENDING / ACCEPTED / REJECTED / WITHDRAWN.
// Withdraw calls POST /proposals/{id}/withdraw, not DELETE.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { ownProposalsOptions, proposalKeys } from "@/features/proposals/queries";
import { withdrawProposal } from "@/features/proposals/api";
import { ApiError } from "@/lib/api-client";
import { formatMoney, formatDate } from "@/lib/format";
import type { ProposalStatus } from "@/types/entities";

const STATUS_TABS: { value: ProposalStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const STATUS_STYLES: Record<ProposalStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACCEPTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  WITHDRAWN: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400",
};

const PAGE_SIZE = 20;

export default function ProposalsPage() {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const [activeTab, setActiveTab] = useState<ProposalStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(ownProposalsOptions(page, PAGE_SIZE));

  // AppLayout ensures user is non-null before rendering; guard lives AFTER
  // all hooks (rules-of-hooks).
  if (!user) return null;

  // Client-side filter by status
  const allProposals = data?.items ?? [];
  const filteredProposals =
    activeTab === "ALL"
      ? allProposals
      : allProposals.filter((p) => p.status === activeTab);

  // Count per status (from full unfiltered list)
  const statusCounts = allProposals.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<ProposalStatus, number>,
  );

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your project proposals.
          </p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === "ALL"
                ? allProposals.length
                : (statusCounts[tab.value] ?? 0);
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {tab.label}
                <span className="text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Proposals list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredProposals.length > 0 ? (
          <div className="space-y-3">
            {filteredProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onWithdraw={() => {
                  queryClient.invalidateQueries({ queryKey: proposalKeys.own() });
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">
              {activeTab === "ALL"
                ? "You haven't submitted any proposals yet."
                : `No ${activeTab.toLowerCase()} proposals.`}
            </p>
            <Link
              href="/marketplace"
              className="mt-3 inline-block text-sm text-foreground font-medium hover:underline"
            >
              Browse marketplace
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total ?? 0} proposals)
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

function ProposalCard({
  proposal,
  onWithdraw,
}: {
  proposal: {
    id: number;
    project_id: number;
    proposed_price: string;
    delivery_days: number;
    cover_letter: string;
    status: ProposalStatus;
    created_at: string;
  };
  onWithdraw: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawProposal(proposal.id),
    onSuccess: () => {
      onWithdraw();
      setConfirming(false);
    },
  });

  const handleWithdraw = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    withdrawMutation.mutate();
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/marketplace/${proposal.project_id}`}
              className="text-sm font-medium text-foreground hover:underline truncate"
            >
              Project #{proposal.project_id}
            </Link>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[proposal.status]}`}>
              {proposal.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {proposal.cover_letter}
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-sm font-semibold text-foreground">
            {formatMoney(proposal.proposed_price)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {proposal.delivery_days} days
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Submitted {formatDate(proposal.created_at)}
        </p>

        {/* Withdraw button — only for PENDING proposals */}
        {proposal.status === "PENDING" && (
          <div className="flex items-center gap-2">
            {confirming && (
              <span className="text-xs text-muted-foreground">Confirm?</span>
            )}
            <button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                confirming
                  ? "bg-destructive text-destructive-foreground hover:opacity-90"
                  : "text-muted-foreground hover:text-destructive"
              } disabled:opacity-50`}
            >
              {withdrawMutation.isPending
                ? "Withdrawing…"
                : confirming
                  ? "Yes, withdraw"
                  : "Withdraw"}
            </button>
            {confirming && (
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
