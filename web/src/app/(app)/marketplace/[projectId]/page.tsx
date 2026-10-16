"use client";

// Marketplace project detail — description, budget, deadline, skills,
// submit-proposal sheet (Architecture.md §4).

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { projectDetailOptions } from "@/features/projects/queries";
import { createProposal } from "@/features/proposals/api";
import { proposalKeys, ownProposalsOptions } from "@/features/proposals/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { ParticipantAvatar } from "@/components/shared/participant-avatar";
import { ApiError } from "@/lib/api-client";
import { formatMoney, formatDate, formatRelativeTime, FALLBACK_CURRENCY } from "@/lib/format";
import { isUuid, participantLabel } from "@/lib/identity";
import Link from "next/link";

export default function MarketplaceProjectPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const { user } = useSession();

  // route segments carry UUID strings, so never coerce them with Number()
  const projectId = params.projectId ?? "";

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  // reject malformed project URLs instead of requesting an invalid UUID
  if (!isUuid(projectId)) {
    router.replace("/marketplace");
    return null;
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full">
        <ProjectDetail projectId={projectId} userRole={user.role} />
      </main>
    </div>
  );
}

function ProjectDetail({
  projectId,
  userRole,
}: {
  projectId: string;
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

  // Fetch freelancer's proposals to detect if already submitted for this project
  const { data: ownProposalsData } = useQuery({
    ...ownProposalsOptions(1, 100),
    enabled: userRole === "FREELANCER",
  });

  // Identify existing proposal application submitted by this freelancer
  const existingProposal = ownProposalsData?.items?.find(
    (p) => p.project_id === projectId
  );

  const proposalMutation = useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      // Invalidate both general proposal lists and current freelancer's own cache
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: proposalKeys.own() });
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

  // Shimmer loading skeleton for the detail page
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="h-4 bg-muted rounded w-48" />
        {/* Title skeleton */}
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/3" />
        </div>
        {/* Content area skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-4/6" />
              <div className="h-4 bg-muted rounded w-3/6" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-6 h-48" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found state
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mb-5">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-foreground">Project not found</h2>
        <p className="text-sm text-muted-foreground mt-2">This project may have been removed or is no longer available.</p>
        <button
          onClick={() => router.push("/marketplace")}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Marketplace
        </button>
      </div>
    );
  }

  // Keep the platform default (ETB) when legacy project data has no currency.
  const projectCurrency = project.currency || FALLBACK_CURRENCY;

  // Calculate days remaining until deadline
  const deadlineDate = new Date(project.deadline);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isDeadlineUrgent = daysRemaining <= 7;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Link
          href="/dashboard"
          className="hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-border">/</span>
        <Link
          href="/marketplace"
          className="hover:text-foreground transition-colors"
        >
          Marketplace
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground font-semibold truncate max-w-[200px]">{project.title}</span>
      </div>

      {/* Project Title & Owner Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-border/60">
        <div className="flex items-start gap-4">
          {/* Owner avatar — the API exposes only an ID, so no name is invented here */}
          <ParticipantAvatar id={project.owner_id} size="lg" className="ring-2 ring-background shadow-sm" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-snug">
              {project.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {participantLabel("Client", project.owner_id)}
              </span>
              <span className="text-border">·</span>
              <span>Posted {formatRelativeTime(project.created_at)}</span>
            </p>
          </div>
        </div>
        {/* Back to marketplace */}
        <button
          onClick={() => router.push("/marketplace")}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-all shrink-0 cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Marketplace
        </button>
      </div>

      {/* Two-Column Layout: Main Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Project Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Project Description Card */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-xs">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Project Description
            </h2>
            <div className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
              {project.description}
            </div>
          </div>

          {/* Required Skills Card */}
          {project.skills.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-xs">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {project.skills.map((sk) => (
                  <span
                    key={sk.id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground border border-border/50"
                  >
                    <svg className="h-3 w-3 text-primary/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {sk.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Proposal section (freelancer only) */}
          {userRole === "FREELANCER" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-xs">
              {proposalSuccess ? (
                // Success confirmation state
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-success/10 text-success mb-4">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Proposal Submitted!</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                    The client will review your proposal. You&apos;ll be notified when it&apos;s accepted.
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => {
                        setProposalSuccess(false);
                        router.push("/proposals");
                      }}
                      className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                    >
                      View My Proposals
                    </button>
                    <button
                      onClick={() => router.push("/marketplace")}
                      className="px-5 py-2.5 text-sm font-semibold border border-border bg-card text-foreground rounded-xl hover:bg-muted transition-all cursor-pointer"
                    >
                      Browse More
                    </button>
                  </div>
                </div>
              ) : existingProposal ? (
                // Already-applied state — show current proposal status and link to tracker
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-foreground">You&apos;ve already applied</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Your proposal for this project is currently{" "}
                    <StatusBadge status={existingProposal.status} domain="proposal" className="inline" />.
                  </p>
                  <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border/60 text-left max-w-sm mx-auto space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Your Price</span>
                      <span className="font-bold text-foreground">{formatMoney(existingProposal.proposed_price, existingProposal.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Delivery</span>
                      <span className="font-bold text-foreground">{existingProposal.delivery_days} days</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Submitted</span>
                      <span className="font-semibold text-foreground">{formatRelativeTime(existingProposal.created_at)}</span>
                    </div>
                  </div>
                  <Link
                    href="/proposals"
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Track in Proposals
                  </Link>
                </div>
              ) : showProposalForm ? (
                // Proposal submission form
                <form onSubmit={handleSubmitProposal} className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <svg className="h-4.5 w-4.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Submit Your Proposal
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Present your pricing, timeline, and approach for this project.
                    </p>
                  </div>

                  {/* Error alert */}
                  {proposalError && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <span>{proposalError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Proposed price input */}
                    <div>
                      <label htmlFor="price" className="block text-sm font-semibold text-foreground mb-2">
                        Your Price ({projectCurrency})
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold select-none">
                          {projectCurrency}
                        </span>
                        <input
                          id="price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full pl-14 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Set a competitive price that reflects the project scope.
                      </p>
                    </div>
                    {/* Delivery days input */}
                    <div>
                      <label htmlFor="deliveryDays" className="block text-sm font-semibold text-foreground mb-2">
                        Delivery Timeline (days)
                      </label>
                      <input
                        id="deliveryDays"
                        type="number"
                        min="1"
                        required
                        value={deliveryDays}
                        onChange={(e) => setDeliveryDays(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        placeholder="14"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Number of days you need to deliver the project.
                      </p>
                    </div>
                  </div>

                  {/* Cover letter textarea */}
                  <div>
                    <label htmlFor="coverLetter" className="block text-sm font-semibold text-foreground mb-2">
                      Cover Letter
                    </label>
                    <textarea
                      id="coverLetter"
                      required
                      rows={6}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y min-h-[140px] transition-colors leading-relaxed"
                      placeholder="Explain why you're a great fit for this project, your relevant experience, and your approach..."
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProposalForm(false)}
                      className="px-5 py-2.5 text-sm font-semibold border border-border rounded-xl bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={proposalMutation.isPending}
                      className="px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      {proposalMutation.isPending ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Submitting…
                        </>
                      ) : (
                        "Submit Proposal"
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                // Initial CTA state — invite freelancer to submit
                <div className="text-center py-8">
                  <div className="h-14 w-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-foreground">Interested in this project?</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Submit a proposal with your pricing, timeline, and approach to get started.
                  </p>
                  <button
                    onClick={() => setShowProposalForm(true)}
                    className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Submit a Proposal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Project Details Summary (1/3 width) */}
        <div className="space-y-5">
          
          {/* Budget & Deadline Quick Facts Card */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Project Details</h2>
            
            {/* Budget */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Budget
              </div>
              <p className="text-xl font-extrabold text-foreground tabular-nums">
                {formatMoney(project.budget, projectCurrency)}
              </p>
            </div>

            <div className="border-t border-border/50" />

            {/* Deadline */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Deadline
              </div>
              <p className="text-base font-bold text-foreground">
                {formatDate(project.deadline)}
              </p>
              {/* Deadline urgency indicator */}
              <p className={`text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                isDeadlineUrgent
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/10 text-success"
              }`}>
                {isDeadlineUrgent && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {daysRemaining === 0 ? "Due today" : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
              </p>
            </div>

            <div className="border-t border-border/50" />

            {/* Status */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Status
              </div>
              <StatusBadge status={project.status} domain="project" />
            </div>

            <div className="border-t border-border/50" />

            {/* Posted Date */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Posted
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatDate(project.created_at)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatRelativeTime(project.created_at)}
              </p>
            </div>
          </div>

          {/* Client Info Card */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">About the Client</h2>
            <div className="flex items-center gap-3">
              <ParticipantAvatar id={project.owner_id} size="md" className="ring-2 ring-background shadow-sm" />
              <div>
                <p className="text-sm font-bold text-foreground">{participantLabel("Client", project.owner_id)}</p>
                <p className="text-[11px] text-muted-foreground">ProLance Member</p>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
            {/* Show Submit Proposal only when freelancer has not already applied */}
            {userRole === "FREELANCER" && !showProposalForm && !proposalSuccess && !existingProposal && (
              <button
                onClick={() => {
                  setShowProposalForm(true);
                  // Scroll to proposal form
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Submit Proposal
              </button>
            )}
            {/* Link to proposals tracker when freelancer already applied */}
            {userRole === "FREELANCER" && existingProposal && (
              <Link
                href="/proposals"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Track My Proposal
              </Link>
            )}
            <button
              onClick={() => router.push("/marketplace")}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-border bg-card text-foreground rounded-xl hover:bg-muted transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Browse Marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
