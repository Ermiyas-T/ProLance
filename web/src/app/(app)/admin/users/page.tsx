"use client";

// Admin user management screen — displays Stage 11 blueprint notice and platform user context
import Link from "next/link";
import { useSession } from "@/app/providers";

export default function AdminUsersPage() {
  const { user } = useSession();

  // AppLayout/AdminLayout ensures current user is authenticated admin before rendering
  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Platform operations</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">User Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Overview of registered users, role assignments, and moderation controls.
            </p>
          </div>
          <Link
            href="/admin/overview"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            ← Admin overview
          </Link>
        </div>

        {/* Stage 11 Blueprint Notice */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Stage 11 API Blueprint Notice</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full user search, suspension, and account restoration endpoints are scheduled for Stage 11 of the API blueprint. Currently, moderation actions are focused on the active Dispute Queue.
              </p>
            </div>
          </div>
        </div>

        {/* Current Admin Session Context */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold text-foreground">Active Administrator Account</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Logged-in session identity and role scope</p>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-muted-foreground">Name</span>
              <span className="text-sm font-semibold text-foreground">{user.full_name}</span>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <span className="text-sm font-semibold text-foreground">{user.email}</span>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-muted-foreground">Role</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{user.role}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
