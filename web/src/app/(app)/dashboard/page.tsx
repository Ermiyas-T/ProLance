"use client";

// Dashboard — role-branching landing page (Architecture.md §4, Project_breakdown.md §7.3).
// One URL, three distinct summaries that keep their own purpose:
//   Client     → project control, proposal decisions, contract oversight
//   Freelancer → proposal pipeline, contract delivery, marketplace discovery
//   Admin      → dispute triage command center (moderation first, not platform analytics)
// Every value comes from a live V1 endpoint. Counts derived from a single loaded
// batch are labelled as page-scoped so no summary card implies a false total.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSession } from "@/app/providers";
import { clientProjectsOptions, projectListOptions } from "@/features/projects/queries";
import { ownProposalsOptions } from "@/features/proposals/queries";
import { contractListOptions } from "@/features/contracts/queries";
import { openDisputesOptions } from "@/features/disputes/queries";
import { formatMoney, formatRelativeTime } from "@/lib/format";
// Import shared UUID label helper so references render as short IDs
import { shortId } from "@/lib/identity";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import type { Project, Proposal, Contract, Dispute } from "@/types/entities";

// Load the backend maximum batch so a status tally is usually complete, while
// still labelling counts honestly when the collection spans several pages.
const PAGE_SIZE = 100;

// ─── Inline Icon Library (Consistent 24x24 viewBox) ───────────────────

const icons = {
  folder: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  contract: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  proposal: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  money: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  search: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  check: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  clock: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  plus: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  arrowRight: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  ),
};

// ─── Time of Day Greeting Helper ──────────────────────────────────────

function getGreeting(): string {
  // compute contextual greeting based on local hour
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Shared UI Helpers ────────────────────────────────────────────────

// section header with optional navigation action link
function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
        >
          {actionLabel}
          {icons.arrowRight}
        </Link>
      )}
    </div>
  );
}

// skeleton rows for list loading states
function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-muted/60"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// empty state placeholder for feed cards
function DashboardEmpty({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-10 text-center">
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icons.folder}
      </div>
      <p className="text-sm text-muted-foreground max-w-sm px-4">{message}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

// honest disclosure for counts derived from one loaded batch (mirrors /projects and /proposals)
function ScopeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-4 py-2.5">
      {children}
    </p>
  );
}

// mini pipeline progress bar
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

// ─── Dashboard Root Page Component ────────────────────────────────────

export default function DashboardPage() {
  const { user } = useSession();

  // AppLayout guarantees user is loaded before rendering
  if (!user) return null;

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 max-w-6xl mx-auto w-full">
      {/* Welcome header with contextual role subtitle */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {getGreeting()}, {user.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.role === "CLIENT" && "Manage your project briefs, review incoming proposals, and track active contracts."}
          {user.role === "FREELANCER" && "Track submitted proposals, monitor active contracts, and discover open marketplace briefs."}
          {user.role === "ADMIN" && "Moderation triage and dispute resolution across the platform."}
        </p>
      </div>

      {user.role === "CLIENT" && <ClientDashboard />}
      {user.role === "FREELANCER" && <FreelancerDashboard />}
      {user.role === "ADMIN" && <AdminDashboard />}
    </main>
  );
}

// ─── CLIENT DASHBOARD ─────────────────────────────────────────────────
// Purpose: keep the client's briefs moving and surface the decisions only they can make.

function ClientDashboard() {
  // load the client's own projects across every lifecycle state
  const projectsQuery = useQuery(clientProjectsOptions(1, PAGE_SIZE));
  // load the client's contracts (owner role, both ACTIVE and DELIVERED included)
  const contractsQuery = useQuery(contractListOptions(1, PAGE_SIZE));

  const projectsData = projectsQuery.data;
  const contractsData = contractsQuery.data;

  // derive project pipeline stats from real queries
  const stats = useMemo(() => {
    const projects = projectsData?.items ?? [];
    const contracts = contractsData?.items ?? [];
    return {
      totalProjects: projectsData?.total ?? 0,
      loadedProjects: projects.length,
      loadedContracts: contracts.length,
      draft: projects.filter((p) => p.status === "DRAFT").length,
      open: projects.filter((p) => p.status === "OPEN").length,
      inProgress: projects.filter((p) => p.status === "IN_PROGRESS").length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
      cancelled: projects.filter((p) => p.status === "CANCELLED").length,
      activeContracts: contracts.filter((c) => c.status === "ACTIVE" || c.status === "DELIVERED").length,
      completedContracts: contracts.filter((c) => c.status === "COMPLETED").length,
    };
  }, [projectsData, contractsData]);

  const isLoading = projectsQuery.isLoading || contractsQuery.isLoading;
  const isError = projectsQuery.isError || contractsQuery.isError;

  // one retry refreshes both feeds after either request fails
  const retry = () => {
    projectsQuery.refetch();
    contractsQuery.refetch();
  };

  // show a real error instead of letting empty cards imply "no data"
  if (isError) {
    return (
      <ErrorState
        title="Could not load your workspace"
        message="We could not reach the server for your projects and contracts."
        onRetry={retry}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Hiring action alert banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary" />
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Hiring Command</p>
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {stats.open > 0
                ? `You have ${stats.open} open project${stats.open > 1 ? "s" : ""} accepting proposals`
                : "Ready to launch your next project?"}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {stats.open > 0
                ? "Review and compare proposals from freelancers, then accept one to create an active contract."
                : "Post a detailed brief, specify skills and budget, and start receiving qualified proposals."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats.open > 0 && (
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Review proposals
              </Link>
            )}
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
            >
              {icons.plus}
              Post new project
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Metrics row using shared StatCard */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Contracts"
          value={stats.activeContracts}
          subtitle={`${stats.completedContracts} completed`}
          icon={icons.contract}
          accentColor="from-purple-500/30 to-purple-500/5"
          href="/contracts"
          loading={isLoading}
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          subtitle="Projects in execution"
          icon={icons.clock}
          accentColor="from-amber-500/30 to-amber-500/5"
          href="/projects"
          loading={isLoading}
        />
        <StatCard
          label="Open for Proposals"
          value={stats.open}
          subtitle={stats.draft > 0 ? `${stats.draft} unpublished draft` : "Accepting proposals"}
          icon={icons.folder}
          accentColor="from-blue-500/30 to-blue-500/5"
          href="/projects"
          loading={isLoading}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          subtitle="Delivered projects"
          icon={icons.check}
          accentColor="from-emerald-500/30 to-emerald-500/5"
          href="/projects"
          loading={isLoading}
        />
      </div>

      {/* Page-scope disclosure keeps status counts honest on multi-page data */}
      {!isLoading && stats.totalProjects > stats.loadedProjects && (
        <ScopeNote>
          Status cards count the {stats.loadedProjects} brief{stats.loadedProjects === 1 ? "" : "s"} and{" "}
          {stats.loadedContracts} contract{stats.loadedContracts === 1 ? "" : "s"} loaded on this page. Open a full
          list for the remaining {stats.totalProjects - stats.loadedProjects}.
        </ScopeNote>
      )}

      {/* Two-column layout: Pipeline Breakdown + Recent Projects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Project lifecycle pipeline breakdown */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <SectionHeader
              title="Project Pipeline"
              subtitle={`Across the ${stats.loadedProjects} brief${stats.loadedProjects === 1 ? "" : "s"} loaded here`}
            />
            <div className="mt-5 space-y-4">
              {isLoading ? (
                <ListSkeleton rows={4} />
              ) : (
                <>
                  <PipelineRow label="Draft" count={stats.draft} total={stats.loadedProjects} color="bg-neutral-400" />
                  <PipelineRow label="Open" count={stats.open} total={stats.loadedProjects} color="bg-blue-500" />
                  <PipelineRow label="In Progress" count={stats.inProgress} total={stats.loadedProjects} color="bg-purple-500" />
                  <PipelineRow label="Completed" count={stats.completed} total={stats.loadedProjects} color="bg-emerald-500" />
                  {stats.cancelled > 0 && (
                    <PipelineRow label="Cancelled" count={stats.cancelled} total={stats.loadedProjects} color="bg-red-400" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent projects feed with quick decision link */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <SectionHeader
              title="Recent Projects"
              subtitle="Your most recently posted briefs"
              actionLabel="View all"
              actionHref="/projects"
            />
            <div className="mt-4">
              {isLoading ? (
                <ListSkeleton rows={4} />
              ) : projectsData && projectsData.items.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {projectsData.items.slice(0, 5).map((project) => (
                    <ProjectItemRow key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <DashboardEmpty
                  message="You haven't posted any projects yet. Create your first brief to connect with freelancers."
                  action={
                    <Link
                      href="/projects/new"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      {icons.plus}
                      Create project
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active contracts section */}
      {!contractsQuery.isLoading && contractsData && contractsData.items.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeader
            title="Active Workspaces"
            subtitle="Contracts currently in delivery or review"
            actionLabel="All contracts"
            actionHref="/contracts"
          />
          <div className="mt-4 divide-y divide-border/60">
            {contractsData.items
              .filter((c) => c.status === "ACTIVE" || c.status === "DELIVERED")
              .slice(0, 4)
              .map((contract) => (
                <ContractItemRow key={contract.id} contract={contract} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FREELANCER DASHBOARD ─────────────────────────────────────────────
// Purpose: discover relevant work and track every proposal and delivery.

function FreelancerDashboard() {
  // load the freelancer's own submitted proposals
  const proposalsQuery = useQuery(ownProposalsOptions(1, PAGE_SIZE));
  // load the freelancer's contracts (participant role)
  const contractsQuery = useQuery(contractListOptions(1, PAGE_SIZE));
  // load a small, newest-first slice of open marketplace briefs for discovery
  const marketplaceQuery = useQuery(
    projectListOptions({ page: 1, page_size: 6, sort_by: "created_at" }),
  );

  const proposalsData = proposalsQuery.data;
  const contractsData = contractsQuery.data;
  const marketplaceData = marketplaceQuery.data;

  // derive proposal and contract statistics from real queries
  const stats = useMemo(() => {
    const proposals = proposalsData?.items ?? [];
    const contracts = contractsData?.items ?? [];
    return {
      totalProposals: proposalsData?.total ?? 0,
      loadedProposals: proposals.length,
      pending: proposals.filter((p) => p.status === "PENDING").length,
      accepted: proposals.filter((p) => p.status === "ACCEPTED").length,
      rejected: proposals.filter((p) => p.status === "REJECTED").length,
      activeContracts: contracts.filter((c) => c.status === "ACTIVE" || c.status === "DELIVERED").length,
      completedContracts: contracts.filter((c) => c.status === "COMPLETED").length,
    };
  }, [proposalsData, contractsData]);

  const isLoading = proposalsQuery.isLoading || contractsQuery.isLoading;
  const isError = proposalsQuery.isError || contractsQuery.isError;

  // marketplace failure is non-blocking: the proposal tracker below still works
  const retry = () => {
    proposalsQuery.refetch();
    contractsQuery.refetch();
  };

  // block the whole summary only when the core pipeline data is unavailable
  if (isError) {
    return (
      <ErrorState
        title="Could not load your pipeline"
        message="We could not reach the server for your proposals and contracts."
        onRetry={retry}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick navigation action pill bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
          >
            {icons.search}
            Find projects
          </Link>
          <Link
            href="/proposals"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {icons.proposal}
            My proposals
            {stats.pending > 0 && (
              <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 text-xs font-semibold">
                {stats.pending}
              </span>
            )}
          </Link>
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {icons.contract}
            Active contracts
            {stats.activeContracts > 0 && (
              <span className="rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 px-1.5 py-0.2 text-xs font-semibold">
                {stats.activeContracts}
              </span>
            )}
          </Link>
        </div>
        <Link
          href="/profile"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage profile & skills →
        </Link>
      </div>

      {/* KPI Stat Cards Row using shared StatCard */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Contracts"
          value={stats.activeContracts}
          subtitle="Workspaces in progress"
          icon={icons.contract}
          accentColor="from-purple-500/30 to-purple-500/5"
          href="/contracts"
          loading={isLoading}
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          subtitle="Awaiting client decision"
          icon={icons.clock}
          accentColor="from-amber-500/30 to-amber-500/5"
          href="/proposals"
          loading={isLoading}
        />
        <StatCard
          label="Accepted"
          value={stats.accepted}
          subtitle="Converted to contracts"
          icon={icons.check}
          accentColor="from-emerald-500/30 to-emerald-500/5"
          href="/proposals"
          loading={isLoading}
        />
        <StatCard
          label="Delivered"
          value={stats.completedContracts}
          subtitle="Completed contracts"
          icon={icons.money}
          accentColor="from-blue-500/30 to-blue-500/5"
          href="/contracts"
          loading={isLoading}
        />
      </div>

      {/* Page-scope disclosure keeps the proposal tally honest on multi-page data */}
      {!isLoading && stats.totalProposals > stats.loadedProposals && (
        <ScopeNote>
          Proposal cards count the {stats.loadedProposals} bid{stats.loadedProposals === 1 ? "" : "s"} loaded on this
          page. Open the tracker for all {stats.totalProposals}.
        </ScopeNote>
      )}

      {/* Two-Column: Proposal Tracker + Recent Proposals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Proposal pipeline breakdown */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <SectionHeader
              title="Proposal Status"
              subtitle={`Across the ${stats.loadedProposals} bid${stats.loadedProposals === 1 ? "" : "s"} loaded here`}
              actionLabel="View all"
              actionHref="/proposals"
            />
            <div className="mt-5 space-y-4">
              {isLoading ? (
                <ListSkeleton rows={3} />
              ) : (
                <>
                  <PipelineRow label="Pending" count={stats.pending} total={stats.loadedProposals} color="bg-amber-500" />
                  <PipelineRow label="Accepted" count={stats.accepted} total={stats.loadedProposals} color="bg-emerald-500" />
                  <PipelineRow label="Rejected" count={stats.rejected} total={stats.loadedProposals} color="bg-red-400" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent proposals list */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <SectionHeader
              title="Recent Submissions"
              subtitle="Your latest proposal activity"
              actionLabel="Tracker"
              actionHref="/proposals"
            />
            <div className="mt-4">
              {proposalsQuery.isLoading ? (
                <ListSkeleton rows={4} />
              ) : proposalsData && proposalsData.items.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {proposalsData.items.slice(0, 5).map((proposal) => (
                    <ProposalItemRow key={proposal.id} proposal={proposal} />
                  ))}
                </div>
              ) : (
                <DashboardEmpty
                  message="You haven't submitted any proposals yet. Check the marketplace for open client briefs."
                  action={
                    <Link
                      href="/marketplace"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      {icons.search}
                      Browse marketplace
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Marketplace opportunities showcase */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <SectionHeader
          title="New Marketplace Opportunities"
          subtitle="Open briefs actively accepting freelancer bids"
          actionLabel="Explore marketplace"
          actionHref="/marketplace"
        />
        <div className="mt-5">
          {marketplaceQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : marketplaceData && marketplaceData.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {marketplaceData.items.slice(0, 3).map((project) => (
                <MarketplaceProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <DashboardEmpty message="No open projects currently available. Check back soon for new client briefs." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────
// Purpose: a triage command center. It answers "what needs moderator action now?"
// and hands deeper platform metrics to /admin/overview.

function AdminDashboard() {
  // GET /disputes returns every non-resolved case (OPEN + UNDER_REVIEW) for admins
  const disputesQuery = useQuery(openDisputesOptions);
  // stable list reference so the derived metrics memo does not recompute each render
  const disputes = useMemo(() => disputesQuery.data ?? [], [disputesQuery.data]);

  // derive queue metrics from the moderation queue payload only
  const stats = useMemo(() => {
    return {
      open: disputes.filter((d) => d.status === "OPEN").length,
      underReview: disputes.filter((d) => d.status === "UNDER_REVIEW").length,
      queue: disputes.length,
    };
  }, [disputes]);

  const { isLoading, isError, refetch } = disputesQuery;

  // show a real error when the queue cannot load, instead of an empty moderation state
  if (isError) {
    return (
      <ErrorState
        title="Could not load the dispute queue"
        message="We could not reach the server for the moderation queue."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* High-urgency alert strip when disputes are awaiting triage */}
      {!isLoading && stats.open > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-sm text-red-700 dark:text-red-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-semibold">Awaiting triage:</span>
            <span>{stats.open} open dispute({stats.open === 1 ? "" : "s"}) need a moderator to start review.</span>
          </div>
          <Link
            href="/admin/disputes"
            className="font-medium underline hover:text-red-900 dark:hover:text-red-300"
          >
            Review queue →
          </Link>
        </div>
      )}

      {/* Triage KPIs — only facts the moderation queue actually supports */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open Disputes"
          value={stats.open}
          subtitle="Awaiting triage"
          icon={icons.alert}
          accentColor="from-red-500/40 to-red-500/5"
          href="/admin/disputes"
          loading={isLoading}
          badge={stats.open > 0 ? "Action Required" : undefined}
        />
        <StatCard
          label="Under Review"
          value={stats.underReview}
          subtitle="Active investigations"
          icon={icons.clock}
          accentColor="from-amber-500/30 to-amber-500/5"
          href="/admin/disputes"
          loading={isLoading}
        />
        <StatCard
          label="Awaiting Resolution"
          value={stats.queue}
          subtitle="Open and under review"
          icon={icons.users}
          accentColor="from-blue-500/30 to-blue-500/5"
          href="/admin/disputes"
          loading={isLoading}
        />
      </div>

      {/* Prioritized dispute queue — the primary moderation task on this screen */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <SectionHeader
          title="Dispute Queue"
          subtitle="Cases requiring mediator review and resolution"
          actionLabel="Open full queue"
          actionHref="/admin/disputes"
        />
        <div className="mt-4">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : disputes.length > 0 ? (
            <div className="divide-y divide-border/60">
              {disputes.slice(0, 8).map((dispute) => (
                <DisputeItemRow key={dispute.id} dispute={dispute} />
              ))}
            </div>
          ) : (
            <DashboardEmpty message="No active disputes in the platform queue. All contracts are running smoothly!" />
          )}
        </div>
      </div>

      {/* Secondary operations links — deeper metrics live on /admin/overview */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
        >
          {icons.alert}
          Dispute queue
        </Link>
        <Link
          href="/admin/overview"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-secondary hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.folder}
          Operations overview
        </Link>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-secondary hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.users}
          Manage users
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Stage 11
          </span>
        </Link>
        <Link
          href="/admin/audit-logs"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-secondary hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.contract}
          Audit logs
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Stage 11
          </span>
        </Link>
      </div>
    </div>
  );
}

// ─── Row & Card Feed Subcomponents ────────────────────────────────────

function PipelineRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{count}</span>
      </div>
      <ProgressBar value={count} max={total} color={color} />
    </div>
  );
}

function ProjectItemRow({ project }: { project: Project }) {
  return (
    <div className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-secondary/40 px-2 rounded-xl">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/projects/${project.id}`}
            className="truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {project.title}
          </Link>
          <StatusBadge status={project.status} domain="project" />
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatMoney(project.budget, project.currency)}</span>
          <span>·</span>
          <span>{formatRelativeTime(project.created_at)}</span>
          {project.skills.length > 0 && (
            <>
              <span>·</span>
              <span className="truncate max-w-[200px]">
                {project.skills.slice(0, 2).map((s) => s.name).join(", ")}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {project.status === "OPEN" ? "Review bids" : "Details"}
        </Link>
      </div>
    </div>
  );
}

function ProposalItemRow({ proposal }: { proposal: Proposal }) {
  return (
    <Link
      href="/proposals"
      className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-secondary/40 px-2 rounded-xl"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            Project #{shortId(proposal.project_id)}
          </p>
          <StatusBadge status={proposal.status} domain="proposal" />
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatMoney(proposal.proposed_price, proposal.currency)}
          </span>
          <span>·</span>
          <span>{proposal.delivery_days} days estimated</span>
          <span>·</span>
          <span>Submitted {formatRelativeTime(proposal.created_at)}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        View →
      </span>
    </Link>
  );
}

function ContractItemRow({ contract }: { contract: Contract }) {
  return (
    <Link
      href={`/contracts/${contract.id}`}
      className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-secondary/40 px-2 rounded-xl"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            Contract #{shortId(contract.id)}
          </p>
          <StatusBadge status={contract.status} domain="contract" />
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatMoney(contract.agreed_price, contract.currency)}</span>
          <span>·</span>
          <span>Deadline: {formatRelativeTime(contract.deadline)}</span>
        </div>
      </div>
      <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
        Workspace →
      </span>
    </Link>
  );
}

function DisputeItemRow({ dispute }: { dispute: Dispute }) {
  const urgencyDot =
    dispute.status === "OPEN"
      ? "bg-red-500"
      : dispute.status === "UNDER_REVIEW"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <Link
      href={`/admin/disputes/${dispute.id}`}
      className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-secondary/40 px-2 rounded-xl"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* urgency indicator dot */}
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${urgencyDot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {dispute.title}
            </p>
            <StatusBadge status={dispute.status} domain="dispute" />
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Dispute #{shortId(dispute.id)}</span>
            <span>·</span>
            <span>Contract #{shortId(dispute.contract_id)}</span>
            <span>·</span>
            <span>Opened {formatRelativeTime(dispute.created_at)}</span>
          </div>
        </div>
      </div>
      <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
        Review Dossier →
      </span>
    </Link>
  );
}

function MarketplaceProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/marketplace/${project.id}`}
      className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-muted-foreground/30"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {project.title}
          </h3>
          <StatusBadge status={project.status} domain="project" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">
            {formatMoney(project.budget, project.currency)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(project.created_at)}
          </span>
        </div>

        {project.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.skills.slice(0, 3).map((skill) => (
              <span
                key={skill.id}
                className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
              >
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
