"use client";

// Dashboard — role-branching landing page (Architecture.md §4).
// Client: recent projects + link to /projects/new.
// Freelancer: open marketplace teaser + /proposals.
// Admin: open-dispute count via GET /disputes + link to /admin/disputes.
// No fake metrics charts (Architecture.md §1.1).

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { projectListOptions } from "@/features/projects/queries";
import { ownProposalsOptions } from "@/features/proposals/queries";
import { openDisputesOptions } from "@/features/disputes/queries";

export default function DashboardPage() {
  const { user } = useSession();

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Main content */}
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {user.full_name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user.role === "CLIENT" && "Manage your projects and hire talent."}
            {user.role === "FREELANCER" && "Find work and track your proposals."}
            {user.role === "ADMIN" && "Moderate the platform and resolve disputes."}
          </p>
        </div>

        {user.role === "CLIENT" && <ClientDashboard />}
        {user.role === "FREELANCER" && <FreelancerDashboard />}
        {user.role === "ADMIN" && <AdminDashboard />}
      </main>
    </div>
  );
}

// Client view: recent open projects teaser + create project CTA
function ClientDashboard() {
  const { data, isLoading } = useQuery(
    projectListOptions({ page: 1, page_size: 5, sort_by: "created_at" }),
  );

  return (
    <div className="space-y-6">
      {/* Create project CTA */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Start a new project</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Post a project and receive proposals from qualified freelancers.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New project
          </Link>
        </div>
      </div>

      {/* Recent open projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent projects</h2>
          <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="space-y-3">
            {data.items.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-muted-foreground/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {project.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {project.description}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-foreground shrink-0 ml-4">
                    ${project.budget}
                  </span>
                </div>
                {project.skills.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {project.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill.id}
                        className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">No projects yet. Create your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Freelancer view: marketplace teaser + recent proposals
function FreelancerDashboard() {
  const projects = useQuery(
    projectListOptions({ page: 1, page_size: 3, sort_by: "created_at" }),
  );
  const proposals = useQuery(ownProposalsOptions(1, 5));

  const pendingCount = proposals.data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Proposals summary */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Your proposals</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingCount > 0
                ? `You have ${pendingCount} proposal${pendingCount === 1 ? "" : "s"} in progress.`
                : "Submit proposals to start landing projects."}
            </p>
          </div>
          <Link
            href="/proposals"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            View proposals
          </Link>
        </div>
      </div>

      {/* Marketplace teaser */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Open projects</h2>
          <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Browse marketplace
          </Link>
        </div>

        {projects.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : projects.data && projects.data.items.length > 0 ? (
          <div className="space-y-3">
            {projects.data.items.map((project) => (
              <Link
                key={project.id}
                href={`/marketplace/${project.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-muted-foreground/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {project.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {project.description}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-foreground shrink-0 ml-4">
                    ${project.budget}
                  </span>
                </div>
                {project.skills.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {project.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill.id}
                        className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">No open projects available right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Admin view: open disputes queue
function AdminDashboard() {
  const { data: disputes, isLoading } = useQuery(openDisputesOptions);

  const openCount = disputes?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Disputes summary */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Disputes queue</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? (
                "Loading disputes…"
              ) : openCount > 0 ? (
                <>
                  <span className="font-medium text-foreground">{openCount}</span>
                  {" "}open dispute{openCount === 1 ? "" : "s"} require{" "}
                  {openCount === 1 ? "attention" : "attention"}.
                </>
              ) : (
                "No open disputes. All clear!"
              )}
            </p>
          </div>
          <Link
            href="/admin/disputes"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            View queue
          </Link>
        </div>
      </div>

      {/* Recent disputes list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent disputes</h2>
          <Link href="/admin/disputes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : disputes && disputes.length > 0 ? (
          <div className="space-y-3">
            {disputes.slice(0, 5).map((dispute) => (
              <Link
                key={dispute.id}
                href={`/admin/disputes/${dispute.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-muted-foreground/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {dispute.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dispute #{dispute.id} · Contract #{dispute.contract_id}
                    </p>
                  </div>
                  <StatusBadge status={dispute.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">No open disputes.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple status badge for dispute status
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    UNDER_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };

  const labels: Record<string, string> = {
    OPEN: "Open",
    UNDER_REVIEW: "Under review",
    RESOLVED: "Resolved",
  };

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}
