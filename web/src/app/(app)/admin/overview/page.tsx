"use client";

// Live admin overview: every value comes from an implemented endpoint.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "@/components/shared/status-badge";
import { openDisputesOptions } from "@/features/disputes/queries";
import { skillsOptions } from "@/features/profiles/queries";
import { projectListOptions } from "@/features/projects/queries";
import { formatRelativeTime } from "@/lib/format";

interface MetricCardProps {
  label: string;
  value: number | undefined;
  loading: boolean;
  detail: string;
  accent: "amber" | "blue" | "violet" | "emerald";
}

// Keep metric loading states stable so the grid does not jump while requests resolve.
function MetricCard({ label, value, loading, detail, accent }: MetricCardProps) {
  const accentStyles = {
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-3 h-9 w-16 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value ?? "—"}</p>
          )}
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentStyles[accent]}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

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
        <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${openPercent}%` }} />
        <div className="h-full bg-blue-500 transition-[width] duration-500" style={{ width: `${100 - openPercent}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Open
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{openCount}</p>
        </div>
        <div className="rounded-xl bg-blue-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Under review
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Platform operations</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Admin overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              A live view of work that needs attention across the marketplace.
            </p>
          </div>
          <Link href="/admin/disputes" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Review dispute queue
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        {hasLoadError && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Some live metrics could not be loaded. Try refreshing this page.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Live platform metrics">
          <MetricCard label="Open disputes" value={openCount} loading={disputesQuery.isLoading} detail="Awaiting initial review" accent="amber" />
          <MetricCard label="Under review" value={reviewCount} loading={disputesQuery.isLoading} detail="Currently being investigated" accent="blue" />
          <MetricCard label="Open projects" value={projectsQuery.data?.total} loading={projectsQuery.isLoading} detail="Available in the marketplace" accent="violet" />
          <MetricCard label="Skills catalogued" value={skillsQuery.data?.length} loading={skillsQuery.isLoading} detail="Available for profile matching" accent="emerald" />
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">#{dispute.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{dispute.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Contract #{dispute.contract_id} · Updated {formatRelativeTime(dispute.updated_at)}</p>
                    </div>
                    <StatusBadge status={dispute.status} />
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
