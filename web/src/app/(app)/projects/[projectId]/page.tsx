"use client";

// Client project detail + proposal list (Architecture.md §4).
// Accept is a confirm modal: one accept creates the contract and rejects the rest.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectDetailOptions, projectKeys } from "@/features/projects/queries";
import { projectProposalsOptions, proposalKeys } from "@/features/proposals/queries";
import { acceptProposal } from "@/features/proposals/api";import { publishProject, cancelProject, deleteProject } from "@/features/projects/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/format";
import type { Proposal } from "@/types/entities";

const PAGE_SIZE = 20;

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery(
    clientProjectDetailOptions(projectId),
  );

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery(
    projectProposalsOptions(projectId),
  );

  const proposals = proposalsData?.items ?? [];

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

  if (!user) return null;

  if (projectLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-96 bg-muted rounded animate-pulse" />
            <div className="h-48 bg-muted rounded-lg animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">Project not found.</p>
            <Link href="/projects" className="mt-3 inline-block text-sm text-foreground font-medium hover:underline">
              Back to projects
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
      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full space-y-6">
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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(project.created_at)}
          </p>
        </div>

        {/* Project details card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Budget</p>
              <p className="text-lg font-semibold text-foreground">
                {formatMoney(project.budget, project.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Deadline</p>
              <p className="text-lg font-semibold text-foreground">
                {formatDate(project.deadline)}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {project.description}
            </p>
          </div>

          {project.skills.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Skills</p>
              <div className="flex gap-1.5 flex-wrap">
                {project.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              {isDraft && (
                <>
                  <Link
                    href={`/projects/${project.id}/edit`}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
                  >
                    Edit draft
                  </Link>
                  <button
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {publishMutation.isPending ? "Publishing…" : "Publish to marketplace"}
                  </button>
                </>
              )}
              {isOpen && (
                <Link
                  href="/marketplace"
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  View on marketplace
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canCancel && (
                <div>
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      Cancel Project
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                      <span className="text-xs text-amber-600 font-medium">Cancel this project?</span>
                      <button
                        onClick={() => cancelMutation.mutate()}
                        disabled={cancelMutation.isPending}
                        className="px-2.5 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
                      >
                        {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
                      </button>
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Keep Project
                      </button>
                    </div>
                  )}
                </div>
              )}

              {canDelete && (
                <div>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      Delete Project
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20">
                      <span className="text-xs text-destructive font-medium">Permanently delete?</span>
                      <button
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="px-2.5 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Proposals section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              Proposals ({proposals.length})
            </h2>
          </div>

          {proposalsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : proposals.length > 0 ? (
            <div className="space-y-3">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  projectId={projectId}
                  onAccepted={() => {
                    queryClient.invalidateQueries({ queryKey: proposalKeys.project(projectId) });
                    queryClient.invalidateQueries({ queryKey: projectKeys.clientDetail(projectId) });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-card rounded-lg border border-border">
              <p className="text-muted-foreground">No proposals yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ProposalCard({
  proposal,
  projectId,
  onAccepted,
}: {
  proposal: Proposal;
  projectId: number;
  onAccepted: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: () => acceptProposal(proposal.id),
    onSuccess: () => {
      setShowConfirm(false);
      onAccepted();
    },
  });

  const handleAccept = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    acceptMutation.mutate();
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              Freelancer #{proposal.freelancer_id}
            </span>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
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

      {/* Accept action — only for PENDING proposals */}
      {proposal.status === "PENDING" && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
          {showConfirm && (
            <span className="text-xs text-muted-foreground">
              Accept this proposal? All others will be rejected.
            </span>
          )}
          <button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
              showConfirm
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "text-primary hover:underline"
            } disabled:opacity-50`}
          >
            {acceptMutation.isPending
              ? "Accepting…"
              : showConfirm
                ? "Yes, accept"
                : "Accept"}
          </button>
          {showConfirm && (
            <button
              onClick={() => setShowConfirm(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
