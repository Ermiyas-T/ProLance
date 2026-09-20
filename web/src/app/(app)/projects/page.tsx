"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectsOptions, projectKeys } from "@/features/projects/queries";
import { publishProject, cancelProject, deleteProject } from "@/features/projects/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/format";
import type { ProjectStatus } from "@/types/entities";

const PAGE_SIZE = 20;

const STATUS_TABS: Array<{ label: string; value: ProjectStatus | "ALL" }> = [
  { label: "All Projects", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function ProjectsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data, isLoading } = useQuery(clientProjectsOptions(page, PAGE_SIZE));

  // Mutations for quick card actions
  const publishMutation = useMutation({
    mutationFn: (id: number) => publishProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelProject(id),
    onSuccess: () => {
      setCancelConfirmId(null);
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  if (!user) return null;

  const allProjects = data?.items ?? [];

  // Filter projects by status tab & search query
  const filteredProjects = allProjects.filter((project) => {
    const matchesStatus =
      selectedStatus === "ALL" || project.status === selectedStatus;

    const matchesSearch =
      searchQuery.trim() === "" ||
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Calculate metrics
  const totalCount = allProjects.length;
  const openCount = allProjects.filter((p) => p.status === "OPEN").length;
  const inProgressCount = allProjects.filter((p) => p.status === "IN_PROGRESS").length;
  const draftCount = allProjects.filter((p) => p.status === "DRAFT").length;
  const completedCount = allProjects.filter((p) => p.status === "COMPLETED").length;

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Navigation & Header */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-3 group"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your posted projects, review proposals, and track progress.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Link>
          </div>
        </div>

        {/* Project Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Projects</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Open Postings</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{openCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{inProgressCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Drafts & Completed</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {draftCount} <span className="text-xs font-normal text-muted-foreground">/ {completedCount}</span>
            </p>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    selectedStatus === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Projects List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="space-y-3">
            {filteredProjects.map((project) => {
              const isDraft = project.status === "DRAFT";
              const isOpen = project.status === "OPEN";
              const isCancelled = project.status === "CANCELLED";
              const canCancel = isDraft || isOpen;
              const canDelete = isDraft || isCancelled;

              return (
                <div
                  key={project.id}
                  className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-base font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {project.title}
                        </Link>
                        <StatusBadge status={project.status} />
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>

                      {project.skills.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pt-1">
                          {project.skills.slice(0, 5).map((skill) => (
                            <span
                              key={skill.id}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
                            >
                              {skill.name}
                            </span>
                          ))}
                          {project.skills.length > 5 && (
                            <span className="text-[11px] text-muted-foreground self-center">
                              +{project.skills.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-border pt-3 sm:pt-0">
                      <p className="text-base font-bold text-foreground">
                        {formatMoney(project.budget, project.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due {formatDate(project.deadline)}
                      </p>
                    </div>
                  </div>

                  {/* Card Actions Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">
                      Created {formatDate(project.created_at)}
                    </span>

                    <div className="flex items-center gap-2">
                      {isDraft && (
                        <>
                          <Link
                            href={`/projects/${project.id}/edit`}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary text-foreground transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => publishMutation.mutate(project.id)}
                            disabled={publishMutation.isPending}
                            className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            Publish
                          </button>
                        </>
                      )}

                      {canCancel && cancelConfirmId !== project.id && (
                        <button
                          onClick={() => setCancelConfirmId(project.id)}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-md text-amber-600 hover:bg-amber-500/10 transition-colors"
                        >
                          Cancel
                        </button>
                      )}

                      {cancelConfirmId === project.id && (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                          <span className="text-xs text-amber-600 font-medium">Confirm cancel?</span>
                          <button
                            onClick={() => cancelMutation.mutate(project.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs font-medium px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setCancelConfirmId(null)}
                            className="text-xs text-muted-foreground hover:underline px-1"
                          >
                            No
                          </button>
                        </div>
                      )}

                      {canDelete && deleteConfirmId !== project.id && (
                        <button
                          onClick={() => setDeleteConfirmId(project.id)}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Delete
                        </button>
                      )}

                      {deleteConfirmId === project.id && (
                        <div className="flex items-center gap-1.5 bg-destructive/10 px-2 py-1 rounded-md border border-destructive/20">
                          <span className="text-xs text-destructive font-medium">Permanently delete?</span>
                          <button
                            onClick={() => deleteMutation.mutate(project.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs font-medium px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-muted-foreground hover:underline px-1"
                          >
                            No
                          </button>
                        </div>
                      )}

                      <Link
                        href={`/projects/${project.id}`}
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1"
                      >
                        View Details & Proposals →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border border-border p-6 shadow-sm">
            <svg className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-base font-medium text-foreground">No projects found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery || selectedStatus !== "ALL"
                ? "Try adjusting your search query or status filter."
                : "You haven't created any projects yet."}
            </p>
            <Link
              href="/projects/new"
              className="mt-4 inline-flex items-center gap-2 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              + Create First Project
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({data?.total ?? 0} projects)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
