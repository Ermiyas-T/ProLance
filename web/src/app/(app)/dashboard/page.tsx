"use client";

// Dashboard — role-branching landing page (Architecture.md §4).
// Client: project pipeline + stat cards + recent activity.
// Freelancer: proposal stats + marketplace preview + active contracts.
// Admin: dispute queue with urgency + platform stats overview.
// All data sourced from real API endpoints — no fake metrics.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSession } from "@/app/providers";
import { clientProjectsOptions, projectListOptions } from "@/features/projects/queries";
import { ownProposalsOptions } from "@/features/proposals/queries";
import { contractListOptions } from "@/features/contracts/queries";
import { openDisputesOptions } from "@/features/disputes/queries";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Project, Proposal, Contract, Dispute } from "@/types/entities";

// ─── Shared UI primitives ────────────────────────────────────────────

// Animated stat card with gradient accent line and hover lift
function StatCard({
  label,
  value,
  subtitle,
  icon,
  accentColor = "from-primary/20 to-primary/5",
  href,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  href?: string;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5">
      {/* Gradient accent top bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentColor} opacity-80`} />

      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {/* Icon container with subtle animated background */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {icon}
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// Section header with optional action link
function SectionHeader({
  title,
  actionLabel,
  actionHref,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {actionLabel}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      )}
    </div>
  );
}

// Shimmer skeleton row for loading states
function DashboardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl bg-muted/60"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

// Empty state with a subtle illustration placeholder
function DashboardEmpty({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Mini progress bar (used in pipeline views)
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

// ─── Inline icon set ──────────────────────────────────────────────────

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
};

// ─── Greeting time-of-day helper ──────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Page root ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useSession();

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 max-w-6xl mx-auto w-full">
      {/* Welcome header with contextual greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {getGreeting()}, {user.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.role === "CLIENT" && "Here's an overview of your projects and contracts."}
          {user.role === "FREELANCER" && "Track your proposals and find new opportunities."}
          {user.role === "ADMIN" && "Platform overview and moderation queue."}
        </p>
      </div>

      {user.role === "CLIENT" && <ClientDashboard userId={user.id} />}
      {user.role === "FREELANCER" && <FreelancerDashboard userId={user.id} />}
      {user.role === "ADMIN" && <AdminDashboard />}
    </main>
  );
}

// ─── CLIENT DASHBOARD ─────────────────────────────────────────────────

function ClientDashboard({ userId }: { userId: number }) {
  // Fetch the client's own projects (all statuses) for pipeline stats
  const { data: projectsData, isLoading: projectsLoading } = useQuery(
    clientProjectsOptions(1, 50),
  );
  // Fetch the client's contracts to show active work
  const { data: contractsData, isLoading: contractsLoading } = useQuery(
    contractListOptions(1, 50),
  );

  // Derive pipeline stats from real project data
  const stats = useMemo(() => {
    const projects = projectsData?.items ?? [];
    const contracts = contractsData?.items ?? [];
    return {
      totalProjects: projectsData?.total ?? 0,
      draft: projects.filter((p) => p.status === "DRAFT").length,
      open: projects.filter((p) => p.status === "OPEN").length,
      inProgress: projects.filter((p) => p.status === "IN_PROGRESS").length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
      cancelled: projects.filter((p) => p.status === "CANCELLED").length,
      activeContracts: contracts.filter((c) => c.status === "ACTIVE" || c.status === "DELIVERED").length,
      completedContracts: contracts.filter((c) => c.status === "COMPLETED").length,
    };
  }, [projectsData, contractsData]);

  const isLoading = projectsLoading || contractsLoading;

  return (
    <div className="space-y-8">
      {/* Stat cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Projects"
          value={isLoading ? "—" : stats.totalProjects}
          subtitle={isLoading ? undefined : `${stats.open} open`}
          icon={icons.folder}
          accentColor="from-blue-500/30 to-blue-500/5"
          href="/projects"
        />
        <StatCard
          label="Active Contracts"
          value={isLoading ? "—" : stats.activeContracts}
          subtitle={isLoading ? undefined : `${stats.completedContracts} completed`}
          icon={icons.contract}
          accentColor="from-purple-500/30 to-purple-500/5"
          href="/contracts"
        />
        <StatCard
          label="In Progress"
          value={isLoading ? "—" : stats.inProgress}
          subtitle="Projects being worked on"
          icon={icons.clock}
          accentColor="from-amber-500/30 to-amber-500/5"
        />
        <StatCard
          label="Completed"
          value={isLoading ? "—" : stats.completed}
          subtitle="Successfully delivered"
          icon={icons.check}
          accentColor="from-green-500/30 to-green-500/5"
        />
      </div>

      {/* Create project CTA banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/30 p-6">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5" />
        <div className="pointer-events-none absolute -right-2 top-8 h-12 w-12 rounded-full bg-primary/5" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Start a new project
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Post your project brief and receive proposals from qualified freelancers within hours.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 self-start rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
          >
            {icons.plus}
            New project
          </Link>
        </div>
      </div>

      {/* Two-column layout: Pipeline + Recent projects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Project pipeline breakdown */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader title="Project pipeline" />
            <div className="mt-5 space-y-4">
              {isLoading ? (
                <DashboardSkeleton rows={4} />
              ) : (
                <>
                  <PipelineRow label="Draft" count={stats.draft} total={stats.totalProjects} color="bg-neutral-400" />
                  <PipelineRow label="Open" count={stats.open} total={stats.totalProjects} color="bg-blue-500" />
                  <PipelineRow label="In Progress" count={stats.inProgress} total={stats.totalProjects} color="bg-purple-500" />
                  <PipelineRow label="Completed" count={stats.completed} total={stats.totalProjects} color="bg-green-500" />
                  {stats.cancelled > 0 && (
                    <PipelineRow label="Cancelled" count={stats.cancelled} total={stats.totalProjects} color="bg-red-400" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent projects feed */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader title="Recent projects" actionLabel="View all" actionHref="/projects" />
            <div className="mt-4">
              {isLoading ? (
                <DashboardSkeleton rows={4} />
              ) : projectsData && projectsData.items.length > 0 ? (
                <div className="space-y-1">
                  {projectsData.items.slice(0, 5).map((project) => (
                    <ProjectRow key={project.id} project={project} basePath="/projects" />
                  ))}
                </div>
              ) : (
                <DashboardEmpty
                  message="No projects yet. Create your first one to get started!"
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
      {!contractsLoading && contractsData && contractsData.items.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionHeader title="Active contracts" actionLabel="View all" actionHref="/contracts" />
          <div className="mt-4 space-y-1">
            {contractsData.items
              .filter((c) => c.status === "ACTIVE" || c.status === "DELIVERED")
              .slice(0, 4)
              .map((contract) => (
                <ContractRow key={contract.id} contract={contract} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FREELANCER DASHBOARD ─────────────────────────────────────────────

function FreelancerDashboard({ userId }: { userId: number }) {
  // Fetch freelancer's own proposals for stats
  const { data: proposalsData, isLoading: proposalsLoading } = useQuery(
    ownProposalsOptions(1, 50),
  );
  // Fetch active contracts
  const { data: contractsData, isLoading: contractsLoading } = useQuery(
    contractListOptions(1, 50),
  );
  // Fetch marketplace preview
  const { data: marketplaceData, isLoading: marketLoading } = useQuery(
    projectListOptions({ page: 1, page_size: 5, sort_by: "created_at" }),
  );

  // Derive proposal and contract stats
  const stats = useMemo(() => {
    const proposals = proposalsData?.items ?? [];
    const contracts = contractsData?.items ?? [];
    return {
      totalProposals: proposalsData?.total ?? 0,
      pending: proposals.filter((p) => p.status === "PENDING").length,
      accepted: proposals.filter((p) => p.status === "ACCEPTED").length,
      rejected: proposals.filter((p) => p.status === "REJECTED").length,
      activeContracts: contracts.filter((c) => c.status === "ACTIVE" || c.status === "DELIVERED").length,
      completedContracts: contracts.filter((c) => c.status === "COMPLETED").length,
    };
  }, [proposalsData, contractsData]);

  const isLoading = proposalsLoading || contractsLoading;

  return (
    <div className="space-y-8">
      {/* Stat cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Proposals"
          value={isLoading ? "—" : stats.totalProposals}
          subtitle={isLoading ? undefined : `${stats.pending} pending`}
          icon={icons.proposal}
          accentColor="from-blue-500/30 to-blue-500/5"
          href="/proposals"
        />
        <StatCard
          label="Accepted"
          value={isLoading ? "—" : stats.accepted}
          subtitle="Proposals accepted"
          icon={icons.check}
          accentColor="from-green-500/30 to-green-500/5"
        />
        <StatCard
          label="Active Contracts"
          value={isLoading ? "—" : stats.activeContracts}
          subtitle={isLoading ? undefined : `${stats.completedContracts} completed`}
          icon={icons.contract}
          accentColor="from-purple-500/30 to-purple-500/5"
          href="/contracts"
        />
        <StatCard
          label="Completed"
          value={isLoading ? "—" : stats.completedContracts}
          subtitle="Contracts delivered"
          icon={icons.money}
          accentColor="from-amber-500/30 to-amber-500/5"
        />
      </div>

      {/* Quick actions bar */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.search}
          Browse marketplace
        </Link>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.proposal}
          My proposals
        </Link>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.contract}
          Contracts
        </Link>
      </div>

      {/* Two-column: Proposals breakdown + Active contracts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Proposal pipeline */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader title="Proposal pipeline" actionLabel="View all" actionHref="/proposals" />
            <div className="mt-5 space-y-4">
              {isLoading ? (
                <DashboardSkeleton rows={3} />
              ) : (
                <>
                  <PipelineRow label="Pending" count={stats.pending} total={stats.totalProposals} color="bg-yellow-500" />
                  <PipelineRow label="Accepted" count={stats.accepted} total={stats.totalProposals} color="bg-green-500" />
                  <PipelineRow label="Rejected" count={stats.rejected} total={stats.totalProposals} color="bg-red-400" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent proposals feed */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader title="Recent proposals" actionLabel="View all" actionHref="/proposals" />
            <div className="mt-4">
              {proposalsLoading ? (
                <DashboardSkeleton rows={4} />
              ) : proposalsData && proposalsData.items.length > 0 ? (
                <div className="space-y-1">
                  {proposalsData.items.slice(0, 5).map((proposal) => (
                    <ProposalRow key={proposal.id} proposal={proposal} />
                  ))}
                </div>
              ) : (
                <DashboardEmpty
                  message="You haven't submitted any proposals yet."
                  action={
                    <Link
                      href="/marketplace"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      {icons.search}
                      Find projects
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Marketplace preview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader title="New on marketplace" actionLabel="Browse all" actionHref="/marketplace" />
        <div className="mt-4">
          {marketLoading ? (
            <DashboardSkeleton rows={3} />
          ) : marketplaceData && marketplaceData.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {marketplaceData.items.slice(0, 3).map((project) => (
                <MarketplaceCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <DashboardEmpty message="No open projects available right now. Check back soon!" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────

function AdminDashboard() {
  const { data: disputes, isLoading } = useQuery(openDisputesOptions);

  // Derive stats from dispute data
  const stats = useMemo(() => {
    const list = disputes ?? [];
    return {
      total: list.length,
      open: list.filter((d) => d.status === "OPEN").length,
      underReview: list.filter((d) => d.status === "UNDER_REVIEW").length,
      resolved: list.filter((d) => d.status === "RESOLVED").length,
    };
  }, [disputes]);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open Disputes"
          value={isLoading ? "—" : stats.open}
          subtitle="Require attention"
          icon={icons.alert}
          accentColor="from-red-500/30 to-red-500/5"
          href="/admin/disputes"
        />
        <StatCard
          label="Under Review"
          value={isLoading ? "—" : stats.underReview}
          subtitle="Being investigated"
          icon={icons.clock}
          accentColor="from-amber-500/30 to-amber-500/5"
          href="/admin/disputes"
        />
        <StatCard
          label="Resolved"
          value={isLoading ? "—" : stats.resolved}
          subtitle="Successfully closed"
          icon={icons.check}
          accentColor="from-green-500/30 to-green-500/5"
        />
        <StatCard
          label="Total Queue"
          value={isLoading ? "—" : stats.total}
          subtitle="All disputes"
          icon={icons.users}
          accentColor="from-blue-500/30 to-blue-500/5"
          href="/admin/disputes"
        />
      </div>

      {/* Quick navigation for admin */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
        >
          {icons.alert}
          Dispute queue
        </Link>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.users}
          Manage users
        </Link>
        <Link
          href="/admin/audit-logs"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/30 active:scale-[0.98]"
        >
          {icons.contract}
          Audit logs
        </Link>
      </div>

      {/* Dispute queue */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader title="Dispute queue" actionLabel="View all" actionHref="/admin/disputes" />
        <div className="mt-4">
          {isLoading ? (
            <DashboardSkeleton rows={5} />
          ) : disputes && disputes.length > 0 ? (
            <div className="space-y-1">
              {disputes.slice(0, 8).map((dispute) => (
                <DisputeRow key={dispute.id} dispute={dispute} />
              ))}
            </div>
          ) : (
            <DashboardEmpty message="No open disputes. The platform is running smoothly!" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Row components ───────────────────────────────────────────────────

// Pipeline stat row: shows a status label, count, and animated bar
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

// Project list row with status, budget, and timestamp
function ProjectRow({ project, basePath }: { project: Project; basePath: string }) {
  return (
    <Link
      href={`${basePath}/${project.id}`}
      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/50"
    >
      {/* Status dot indicator */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {icons.folder}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {project.title}
          </p>
          <StatusBadge status={project.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatMoney(project.budget, project.currency)}</span>
          <span>·</span>
          <span>{formatRelativeTime(project.created_at)}</span>
          {project.skills.length > 0 && (
            <>
              <span>·</span>
              <span className="truncate">{project.skills.slice(0, 2).map(s => s.name).join(", ")}</span>
            </>
          )}
        </div>
      </div>
      {/* Arrow on hover */}
      <svg className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

// Proposal list row with status, price, and time
function ProposalRow({ proposal }: { proposal: Proposal }) {
  return (
    <Link
      href={`/proposals`}
      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {icons.proposal}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            Project #{proposal.project_id}
          </p>
          <StatusBadge status={proposal.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatMoney(proposal.proposed_price, proposal.currency)}</span>
          <span>·</span>
          <span>{proposal.delivery_days} days</span>
          <span>·</span>
          <span>{formatRelativeTime(proposal.created_at)}</span>
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

// Contract list row with status, price, and deadline
function ContractRow({ contract }: { contract: Contract }) {
  return (
    <Link
      href={`/contracts/${contract.id}`}
      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {icons.contract}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            Contract #{contract.id}
          </p>
          <StatusBadge status={contract.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatMoney(contract.agreed_price)}</span>
          <span>·</span>
          <span>Due {formatRelativeTime(contract.deadline)}</span>
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

// Dispute list row with urgency indicator
function DisputeRow({ dispute }: { dispute: Dispute }) {
  // Urgency based on status — OPEN is more urgent than UNDER_REVIEW
  const urgencyDot =
    dispute.status === "OPEN"
      ? "bg-red-500"
      : dispute.status === "UNDER_REVIEW"
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <Link
      href={`/admin/disputes/${dispute.id}`}
      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/50"
    >
      {/* Urgency dot + icon */}
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {icons.alert}
        <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${urgencyDot} ring-2 ring-card`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {dispute.title}
          </p>
          <StatusBadge status={dispute.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Dispute #{dispute.id}</span>
          <span>·</span>
          <span>Contract #{dispute.contract_id}</span>
          <span>·</span>
          <span>{formatRelativeTime(dispute.created_at)}</span>
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

// Marketplace card for freelancer preview (compact project card)
function MarketplaceCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/marketplace/${project.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5 hover:border-muted-foreground/20"
    >
      <h3 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
        {project.title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {project.description}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
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
    </Link>
  );
}
