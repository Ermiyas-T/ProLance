"use client";

// Live admin overview: every value comes from an implemented endpoint.
// Displays platform moderation composition, dispute stages, and catalogued ecosystem counts.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { openDisputesOptions } from "@/features/disputes/queries";
import { skillsOptions } from "@/features/profiles/queries";
import { projectListOptions } from "@/features/projects/queries";
import { formatRelativeTime } from "@/lib/format";
// Import shared UUID label helper so references render as short IDs
import { shortId } from "@/lib/identity";

// --- Inline icons for overview metrics ---
const icons = {
  alert: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  folder: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  skills: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

// Render a factual distribution of the current moderation queue, not a synthetic trend chart.
function QueueDistribution({ openCount, reviewCount }: { openCount: number; reviewCount: number }) {
  const total = openCount + reviewCount;
  const openPercent = total === 0 ? 0 : (openCount / total) * 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Queue composition</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Current resolution stage</h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          {total} active
        </span>
      </div>

      <div className="mt-8 flex h-3 overflow-hidden rounded-full bg-secondary" aria-label={`${openCount} open and ${reviewCount} under review disputes`}>
        <div className="h-full rounded-full bg-red-500 transition-[width] duration-500" style={{ width: `${openPercent}%` }} />
        <div className="h-full bg-amber-500 transition-[width] duration-500" style={{ width: `${100 - openPercent}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-red-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Open
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{openCount}</p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Under review
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{reviewCount}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  // Reuse each domain's canonical query options rather than duplicating fetch logic.
  const disputesQuery = useQuery(openDisputesOptions);
  const projectsQuery = useQuery(projectListOptions({ page: 1, page_size: 1 }));
  const skillsQuery = useQuery(skillsOptions);

  const disputes = disputesQuery.data ?? [];
  const openCount = disputes.filter((dispute) => dispute.status === "OPEN").length;
  const reviewCount = disputes.filter((dispute) => dispute.status === "UNDER_REVIEW").length;
  const recentDisputes = [...disputes]
    .sort((first, second) => new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime())
    .slice(0, 5);
  const hasLoadError = disputesQuery.isError || projectsQuery.isError || skillsQuery.isError;

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Operations Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A comprehensive view of active platform disputes, open projects, and catalogued skills.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Triage queue
            </Link>
            <Link
              href="/admin/disputes"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 shadow-sm"
            >
              Dispute dossier
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>

        {hasLoadError && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>Some live metrics could not be loaded.</span>
            {/* one retry refetches every metric so the row resolves together */}
            <button
              type="button"
              onClick={() => {
                disputesQuery.refetch();
                projectsQuery.refetch();
                skillsQuery.refetch();
              }}
              className="inline-flex w-fit items-center rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/10"
            >
              Try again
            </button>
          </div>
        )}

        {/* Live metric cards row using unified StatCard */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Live platform metrics">
          <StatCard
            label="Open disputes"
            value={openCount}
            loading={disputesQuery.isLoading}
            subtitle="Awaiting initial triage"
            icon={icons.alert}
            accentColor="from-red-500/40 to-red-500/5"
            href="/admin/disputes"
            badge={openCount > 0 ? "Action" : undefined}
          />
          <StatCard
            label="Under review"
            value={reviewCount}
            loading={disputesQuery.isLoading}
            subtitle="Active investigations"
            icon={icons.clock}
            accentColor="from-amber-500/30 to-amber-500/5"
            href="/admin/disputes"
          />
          <StatCard
            label="Open projects"
            value={projectsQuery.data?.total}
            loading={projectsQuery.isLoading}
            subtitle="Live marketplace briefs"
            icon={icons.folder}
            accentColor="from-blue-500/30 to-blue-500/5"
            href="/marketplace"
          />
          <StatCard
            label="Skills catalogued"
            value={skillsQuery.data?.length}
            loading={skillsQuery.isLoading}
            subtitle="Profile skill matching pool"
            icon={icons.skills}
            accentColor="from-emerald-500/30 to-emerald-500/5"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {disputesQuery.isLoading ? (
              <div className="h-[278px] animate-pulse rounded-2xl bg-muted" />
            ) : (
              <QueueDistribution openCount={openCount} reviewCount={reviewCount} />
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm lg:col-span-3">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Priority queue</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Recently updated disputes</h2>
              </div>
              <Link href="/admin/disputes" className="text-sm font-medium text-primary hover:underline">View all</Link>
            </div>

            {disputesQuery.isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-muted" />)}
              </div>
            ) : recentDisputes.length > 0 ? (
              <div className="divide-y divide-border">
                {recentDisputes.map((dispute) => (
                  <Link key={dispute.id} href={`/admin/disputes/${dispute.id}`} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/50">
                    {/* short UUID reference pill — a full UUID would overflow this chip */}
                    <span className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground">#{shortId(dispute.id)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{dispute.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Contract #{shortId(dispute.contract_id)} · Updated {formatRelativeTime(dispute.updated_at)}</p>
                    </div>
                    <StatusBadge status={dispute.status} domain="dispute" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" /></svg>
                </span>
                <p className="mt-3 text-sm font-medium text-foreground">Nothing needs attention</p>
                <p className="mt-1 text-sm text-muted-foreground">There are no active disputes in the queue.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
