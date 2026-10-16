"use client";

// Client project detail + proposal comparison view (Architecture.md §4).
// Allows the client to evaluate candidate proposals side-by-side, inspect cover letters,
// check freelancer profiles, and accept a proposal (which atomically creates a contract and rejects competitors).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectDetailOptions, projectKeys } from "@/features/projects/queries";
import { projectProposalsOptions, proposalKeys } from "@/features/proposals/queries";
import { acceptProposal } from "@/features/proposals/api";
import { publishProject, cancelProject, deleteProject } from "@/features/projects/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { ParticipantAvatar } from "@/components/shared/participant-avatar";
import { formatMoney, formatDate, formatRelativeTime } from "@/lib/format";
import { isUuid, participantLabel, shortId } from "@/lib/identity";
import type { Proposal } from "@/types/entities";

// how many candidate proposals to compare at once (backend allows up to 100 per page)
const PROPOSAL_PAGE_SIZE = 100;

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  // route segments carry UUID strings, so never coerce them with Number()
  const projectId = params.projectId ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();

  // state modals and filters
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProposalForAccept, setSelectedProposalForAccept] = useState<Proposal | null>(null);
  const [sortCriteria, setSortCriteria] = useState<"newest" | "price_asc" | "delivery_asc">("newest");

  // fetch project data
  const { data: project, isLoading: projectLoading } = useQuery(
    clientProjectDetailOptions(projectId),
  );

  // fetch proposals submitted for this project
  const { data: proposalsData, isLoading: proposalsLoading } = useQuery(
    projectProposalsOptions(projectId, 1, PROPOSAL_PAGE_SIZE),
  );

  // keep the batch stable so the sort/stats memos below only re-run when it truly changes
  const rawProposals = useMemo(() => proposalsData?.items ?? [], [proposalsData]);

  // sort proposals based on comparison criteria
  const sortedProposals = useMemo(() => {
    const list = [...rawProposals];
    if (sortCriteria === "price_asc") {
      return list.sort((a, b) => Number(a.proposed_price) - Number(b.proposed_price));
    }
    if (sortCriteria === "delivery_asc") {
      return list.sort((a, b) => a.delivery_days - b.delivery_days);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [rawProposals, sortCriteria]);

  // compute comparison stats
  const comparisonStats = useMemo(() => {
    if (rawProposals.length === 0) return null;
    const pendingCount = rawProposals.filter((p) => p.status === "PENDING").length;
    const lowestDays = Math.min(...rawProposals.map((p) => p.delivery_days));
    return {
      total: rawProposals.length,
      pending: pendingCount,
      lowestDays,
    };
  }, [rawProposals]);

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: () => publishProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.clientDetail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelProject(projectId),
    onSuccess: () => {
      setShowCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: projectKeys.clientDetail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
      router.push("/projects");
    },
  });

  // Accept mutation — proposal IDs are UUID strings, so the action takes a string
  const acceptMutation = useMutation({
    mutationFn: (proposalId: string) => acceptProposal(proposalId),
    onSuccess: () => {
      setSelectedProposalForAccept(null);
      // Invalidate both proposal list and project detail
      queryClient.invalidateQueries({ queryKey: proposalKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.clientDetail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
      router.push("/contracts");
    },
  });

  if (!user) return null;

  // reject malformed project URLs instead of querying the API with an invalid UUID
  if (!isUuid(projectId)) {
    router.replace("/projects");
    return null;
  }

  if (projectLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full">
          <div className="space-y-6 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-8 w-72 bg-muted rounded" />
            <div className="h-48 bg-muted rounded-2xl" />
            <div className="h-64 bg-muted rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full">
          <div className="text-center py-16 bg-card rounded-2xl border border-border p-8">
            <h2 className="text-lg font-bold text-foreground">Project not found</h2>
            <p className="text-sm text-muted-foreground mt-2">The requested project could not be found or you do not have permission.</p>
            <Link href="/projects" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              ← Return to My Projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isDraft = project.status === "DRAFT";
  const isOpen = project.status === "OPEN";
  const isCancelled = project.status === "CANCELLED";
  const canCancel = isDraft || isOpen;
  const canDelete = isDraft || isCancelled;

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Navigation & Header */}
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-3 group"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Projects
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{project.title}</h1>
                <StatusBadge status={project.status} domain="project" />
              </div>
              <p className="text-xs text-muted-foreground">
                Created {formatDate(project.created_at)} · Project #{shortId(project.id)}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
              {isDraft && (
                <>
                  <Link
                    href={`/projects/${project.id}/edit`}
                    className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-secondary transition-colors"
                  >
                    Edit draft
                  </Link>
                  <button
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                    className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 shadow-sm transition-all disabled:opacity-50"
                  >
                    {publishMutation.isPending ? "Publishing…" : "Publish to marketplace"}
                  </button>
                </>
              )}
              {isOpen && (
                <Link
                  href="/marketplace"
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-secondary transition-colors"
                >
                  View in marketplace
                </Link>
              )}
              {canCancel && !showCancelConfirm && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-xl hover:bg-amber-500/10 transition-colors"
                >
                  Cancel project
                </button>
              )}
              {canDelete && !showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 text-xs font-semibold text-destructive border border-destructive/30 rounded-xl hover:bg-destructive/10 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cancel Confirmation Prompt */}
        {showCancelConfirm && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <span className="text-amber-800 dark:text-amber-300 font-medium">
              Are you sure you want to cancel this project? Candidates will no longer be able to submit proposals.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel project"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Keep project
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Prompt */}
        {showDeleteConfirm && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <span className="text-destructive font-medium">
              Permanently delete this project? This action cannot be reversed.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-xs font-semibold bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                {deleteMutation.isPending ? "Deleting…" : "Yes, delete permanently"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Project Details Brief Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-border/60">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Target Budget</p>
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                {formatMoney(project.budget, project.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Target Deadline</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {formatDate(project.deadline)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Proposals Received</p>
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                {rawProposals.length}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Brief Description</p>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {project.description}
              </p>
            </div>

            {project.skills.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {project.skills.map((skill) => (
                    <span
                      key={skill.id}
                      className="text-xs font-medium px-3 py-1 rounded-xl bg-secondary text-secondary-foreground border border-border/60"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Candidate Proposals Comparison Section ── */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Candidate Proposals
                <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
                  {rawProposals.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compare candidate prices, delivery timelines, and cover letters to select the winning proposal.
              </p>
            </div>

            {/* Comparison Sorting Controls */}
            {rawProposals.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sort:</span>
                <select
                  value={sortCriteria}
                  onChange={(e) => setSortCriteria(e.target.value as typeof sortCriteria)}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-xl bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="newest">Newest first</option>
                  <option value="price_asc">Lowest proposed price</option>
                  <option value="delivery_asc">Shortest delivery timeline</option>
                </select>
              </div>
            )}
          </div>

          {/* Metric Comparison Strip if multiple proposals */}
          {comparisonStats && rawProposals.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Pending Decisions</p>
                <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{comparisonStats.pending} proposals</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Fastest Delivery Estimate</p>
                <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{comparisonStats.lowestDays} days</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Project Budget Target</p>
                <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{formatMoney(project.budget, project.currency)}</p>
              </div>
            </div>
          )}

          {/* Scope note — the API paginates proposals, so comparison covers the loaded batch */}
          {proposalsData && proposalsData.total > rawProposals.length && (
            <p className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2">
              Showing the first {rawProposals.length} of {proposalsData.total} proposals.
              Comparison and sorting apply to the proposals listed here.
            </p>
          )}

          {/* Proposals Feed or Empty State */}
          {proposalsLoading ? (
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted/60 rounded-2xl" />
              ))}
            </div>
          ) : sortedProposals.length > 0 ? (
            <div className="space-y-4">
              {sortedProposals.map((proposal) => (
                <ProposalComparisonCard
                  key={proposal.id}
                  proposal={proposal}
                  projectCurrency={project.currency}
                  isProjectOpen={isOpen}
                  onSelectAccept={() => setSelectedProposalForAccept(proposal)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border p-8">
              <div className="h-12 w-12 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">No proposals submitted yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isDraft
                  ? "Publish your project brief to the marketplace so freelancers can discover it and submit bids."
                  : "Freelancers are browsing your project. New proposals will appear here as soon as they are submitted."}
              </p>
              {isDraft && (
                <button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="mt-4 px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
                >
                  Publish project now
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Acceptance Confirmation Modal ── */}
        {selectedProposalForAccept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">Accept Candidate Proposal?</h3>
                  <p className="text-xs text-muted-foreground">Confirm contract creation</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-secondary/40 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Candidate:</span>
                  <span className="font-semibold text-foreground">{participantLabel("Freelancer", selectedProposalForAccept.freelancer_id)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agreed Price:</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatMoney(selectedProposalForAccept.proposed_price, selectedProposalForAccept.currency || project.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Timeline:</span>
                  <span className="font-semibold text-foreground">{selectedProposalForAccept.delivery_days} days</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Accepting this proposal will automatically <strong>create an active contract workspace</strong> and reject all other competing proposals for this project.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProposalForAccept(null)}
                  disabled={acceptMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => acceptMutation.mutate(selectedProposalForAccept.id)}
                  disabled={acceptMutation.isPending}
                  className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {acceptMutation.isPending ? "Creating Contract…" : "Confirm & Award Contract"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Individual Candidate Proposal Card Subcomponent ───────────────────

function ProposalComparisonCard({
  proposal,
  projectCurrency,
  isProjectOpen,
  onSelectAccept,
}: {
  proposal: Proposal;
  projectCurrency?: string;
  isProjectOpen: boolean;
  onSelectAccept: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const currency = proposal.currency || projectCurrency;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-xs hover:border-primary/20 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Candidate Identifier + Profile Link */}
        <div className="flex items-start gap-3.5">
          {/* anonymous candidate avatar — no name is available on the proposal payload */}
          <ParticipantAvatar id={proposal.freelancer_id} size="md" className="ring-2 ring-background" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">{participantLabel("Freelancer", proposal.freelancer_id)}</h3>
              <StatusBadge status={proposal.status} domain="proposal" />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Link
                href={`/freelancers/${proposal.freelancer_id}`}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                View profile & reviews
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
              <span>·</span>
              <span>Submitted {formatRelativeTime(proposal.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Pricing & Timeline Pill */}
        <div className="flex items-center sm:text-right gap-4 sm:gap-6 bg-secondary/50 px-4 py-2.5 rounded-xl border border-border/60">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Proposed Price</p>
            <p className="text-base font-extrabold text-foreground tabular-nums">
              {formatMoney(proposal.proposed_price, currency)}
            </p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Timeline</p>
            <p className="text-base font-extrabold text-foreground tabular-nums">
              {proposal.delivery_days} <span className="text-xs font-medium text-muted-foreground">days</span>
            </p>
          </div>
        </div>
      </div>

      {/* Cover letter section */}
      <div className="mt-4 pt-4 border-t border-border/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Candidate Pitch</p>
        <p className={`text-sm text-foreground/90 whitespace-pre-line leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
          {proposal.cover_letter}
        </p>
        {proposal.cover_letter.length > 200 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-primary hover:underline mt-1.5 cursor-pointer"
          >
            {expanded ? "Show less" : "Read full proposal →"}
          </button>
        )}
      </div>

      {/* Candidate Decision Action */}
      {proposal.status === "PENDING" && isProjectOpen && (
        <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onSelectAccept}
            className="px-5 py-2.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-sm hover:shadow-md active:scale-[0.98] inline-flex items-center gap-1.5"
          >
            Accept proposal & hire
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
