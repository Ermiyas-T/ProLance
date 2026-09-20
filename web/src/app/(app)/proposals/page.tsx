"use client";

// Freelancer "my proposals" status tracker (Architecture.md §4).
// Tabs/chips: PENDING / ACCEPTED / REJECTED / WITHDRAWN.
// Withdraw calls POST /proposals/{id}/withdraw, not DELETE.

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { ownProposalsOptions, proposalKeys } from "@/features/proposals/queries";
import { withdrawProposal } from "@/features/proposals/api";
import { formatMoney, formatDate } from "@/lib/format";
import type { Proposal, ProposalStatus } from "@/types/entities";

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
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);

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

  // Fall back to the first visible proposal when the selected item is filtered out.
  const selectedProposal =
    filteredProposals.find((proposal) => proposal.id === selectedProposalId) ??
    filteredProposals[0];

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
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,0.75fr)_minmax(520px,1.25fr)] gap-8 items-start">
            <div className="space-y-3">
              {filteredProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  selected={proposal.id === selectedProposal?.id}
                  onSelect={() => setSelectedProposalId(proposal.id)}
                  onWithdraw={() => {
                    queryClient.invalidateQueries({ queryKey: proposalKeys.own() });
                  }}
                />
              ))}
            </div>
            <ProposalDetails proposal={selectedProposal} />
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

function ProposalDetails({ proposal }: { proposal?: Proposal }) {
  if (!proposal) return null;

  const statusMessage = {
    PENDING: "You can withdraw this proposal while it is pending.",
    ACCEPTED: "This proposal was accepted and is now represented by a contract.",
    REJECTED: "This proposal is closed and can no longer be changed.",
    WITHDRAWN: "You withdrew this proposal, so it can no longer be changed.",
  }[proposal.status];

  return (
    <aside className="min-w-0 overflow-x-auto border-t border-border pt-6 mt-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
      <div className="min-w-[28rem] max-w-3xl pr-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected proposal</p>
          <h2 className="text-xl font-semibold text-foreground mt-1">Project #{proposal.project_id}</h2>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[proposal.status]}`}>
          {proposal.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6 pb-5 border-b border-border">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Your price</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            {formatMoney(proposal.proposed_price, proposal.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Delivery time</p>
          <p className="text-lg font-semibold text-foreground mt-1">{proposal.delivery_days} days</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-foreground mb-2">Cover letter</p>
        <p className="text-sm text-muted-foreground whitespace-pre-line break-words leading-6">{proposal.cover_letter}</p>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Submitted {formatDate(proposal.created_at)}</p>
        <p className="text-sm text-muted-foreground mt-3 leading-5">{statusMessage}</p>
      </div>

      <Link
        href={`/marketplace/${proposal.project_id}`}
        className="inline-flex items-center justify-center mt-6 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        View project
      </Link>
      </div>
    </aside>
  );
}

function ProposalCard({
  proposal,
  selected,
  onSelect,
  onWithdraw,
}: {
  proposal: Proposal;
  selected: boolean;
  onSelect: () => void;
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
    <div className={`bg-card rounded-lg border p-4 transition-colors ${selected ? "border-primary shadow-sm" : "border-border"}`}>
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
            {formatMoney(proposal.proposed_price, proposal.currency)}
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
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`View details for proposal on project ${proposal.project_id}`}
          className="text-xs font-medium text-foreground hover:underline"
        >
          View details
        </button>

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
