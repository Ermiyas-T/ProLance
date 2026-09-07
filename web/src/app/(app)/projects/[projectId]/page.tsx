"use client";

// Client project detail + proposal list (Architecture.md §4).
// Accept is a confirm modal: one accept creates the contract and rejects the rest.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectDetailOptions } from "@/features/projects/queries";
import { projectProposalsOptions, proposalKeys } from "@/features/proposals/queries";
import { acceptProposal } from "@/features/proposals/api";
import { publishProject } from "@/features/projects/api";
import { projectKeys } from "@/features/projects/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatMoney, formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import type { Proposal } from "@/types/entities";

const PAGE_SIZE = 20;

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

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

  if (projectLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
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
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
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

      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        {/* Project header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(project.created_at)}
          </p>
        </div>

        {/* Project details card */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
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
                    className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
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
            <Link
              href="/projects"
              className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to projects
            </Link>
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
