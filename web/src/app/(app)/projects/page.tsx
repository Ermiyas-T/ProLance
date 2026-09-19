"use client";

// Client "my projects" list with status badges (Architecture.md §4).
// Freelancers hitting this route are redirected to /marketplace by middleware.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectsOptions } from "@/features/projects/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default function ProjectsPage() {
  const { user } = useSession();

  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(clientProjectsOptions(page, PAGE_SIZE));

  // AppLayout ensures user is non-null before rendering; guard lives AFTER
  // all hooks (rules-of-hooks).
  if (!user) return null;

  const projects = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your posted projects and track their status.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            New project
          </Link>
        </div>

        {/* Projects list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="space-y-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {project.title}
                      </h3>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {project.description}
                    </p>
                    {project.skills.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {project.skills.slice(0, 5).map((skill) => (
                          <span
                            key={skill.id}
                            className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                          >
                            {skill.name}
                          </span>
                        ))}
                        {project.skills.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{project.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-foreground">
                      {formatMoney(project.budget, project.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {formatDate(project.deadline)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">
              You haven&apos;t created any projects yet.
            </p>
            <Link
              href="/projects/new"
              className="mt-3 inline-block text-sm text-foreground font-medium hover:underline"
            >
              Create your first project
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total ?? 0} projects)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
