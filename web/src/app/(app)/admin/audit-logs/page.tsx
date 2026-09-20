"use client";

// Admin audit log viewer — displays operational event logging status and Stage 11 notice
import Link from "next/link";

export default function AuditLogsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">System compliance</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Audit Logs</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Traceability logs for dispute resolutions, user state changes, and administrative actions.
            </p>
          </div>
          <Link
            href="/admin/overview"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            ← Admin overview
          </Link>
        </div>

        {/* Blueprint info card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Audit Trail Blueprint</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Centralized audit logging backend endpoints (`GET /admin/audit-logs`) are defined in Stage 11. Platform disputes and contract status changes are currently recorded in PostgreSQL transactions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
