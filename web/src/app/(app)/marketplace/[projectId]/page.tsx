"use client";

// Marketplace project detail — description, budget, deadline, skills,
// submit-proposal sheet (Architecture.md §4).

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { projectDetailOptions } from "@/features/projects/queries";
import { createProposal } from "@/features/proposals/api";
import { proposalKeys } from "@/features/proposals/queries";
import { ApiError } from "@/lib/api-client";
import { formatMoney, formatDate } from "@/lib/format";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function MarketplaceProjectPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const { user, isAuthenticated, logout } = useSession();

  const projectId = Number(params.projectId);

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  if (isNaN(projectId)) {
    router.replace("/marketplace");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={() => router.back()} className="text-lg font-bold text-foreground hover:opacity-80 transition-opacity">
          ProLance
        </button>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">{user.full_name}</span>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        <ProjectDetail projectId={projectId} userRole={user.role} />
      </main>
    </div>
  );
}

function ProjectDetail({
  projectId,
  userRole,
}: {
  projectId: number;
  userRole: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: project, isLoading, error } = useQuery(projectDetailOptions(projectId));

  const [showProposalForm, setShowProposalForm] = useState(false);
  const [price, setPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposalSuccess, setProposalSuccess] = useState(false);

  const proposalMutation = useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      setProposalSuccess(true);
      setShowProposalForm(false);
      setPrice("");
      setDeliveryDays("");
      setCoverLetter("");
      setProposalError(null);
    },
    onError: (err) => {
      setProposalError(err instanceof ApiError ? err.detail : "Failed to submit proposal");
    },
  });

  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    setProposalError(null);
    proposalMutation.mutate({
      project_id: projectId,
      proposed_price: price,
      delivery_days: Number(deliveryDays),
      cover_letter: coverLetter,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted rounded-lg animate-pulse w-2/3" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <button
          onClick={() => router.push("/marketplace")}
          className="mt-4 text-sm text-foreground font-medium hover:underline"
        >
          Back to marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/marketplace")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to marketplace
        </button>
        <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
      </div>

      {/* Project info */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
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

        <div>
          <p className="text-xs text-muted-foreground mb-2">Description</p>
          <p className="text-sm text-foreground whitespace-pre-line">{project.description}</p>
        </div>

        {project.skills.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Required skills</p>
            <div className="flex flex-wrap gap-2">
              {project.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="text-sm px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proposal section (freelancer only) */}
      {userRole === "FREELANCER" && (
        <div className="bg-card rounded-xl border border-border p-6">
          {proposalSuccess ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success/10 text-success mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Proposal submitted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The client will review your proposal. You&apos;ll be notified if it&apos;s accepted.
              </p>
              <button
                onClick={() => {
                  setProposalSuccess(false);
                  router.push("/proposals");
                }}
                className="mt-4 text-sm text-foreground font-medium hover:underline"
              >
                View my proposals
              </button>
            </div>
          ) : showProposalForm ? (
            <form onSubmit={handleSubmitProposal} className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Submit a proposal</h3>

              {proposalError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {proposalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-foreground mb-1.5">
                    Your price (USD)
                  </label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor="deliveryDays" className="block text-sm font-medium text-foreground mb-1.5">
                    Delivery days
                  </label>
                  <input
                    id="deliveryDays"
                    type="number"
                    min="1"
                    required
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    placeholder="14"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="coverLetter" className="block text-sm font-medium text-foreground mb-1.5">
                  Cover letter
                </label>
                <textarea
                  id="coverLetter"
                  required
                  rows={5}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
                  placeholder="Explain why you're a great fit for this project…"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowProposalForm(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposalMutation.isPending}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {proposalMutation.isPending ? "Submitting…" : "Submit proposal"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Interested in this project? Submit a proposal to get started.
              </p>
              <button
                onClick={() => setShowProposalForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Submit proposal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
