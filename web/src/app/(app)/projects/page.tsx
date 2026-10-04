"use client";

// Import core React hooks for state and memoization
import { useState, useMemo } from "react";
// Import Next.js link for client-side navigation
import Link from "next/link";
// Import React Query hooks for fetching and cache management
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Import authentication session context provider
import { useSession } from "@/app/providers";
// Import project query options and query key definitions
import { clientProjectsOptions, projectKeys } from "@/features/projects/queries";
// Import API mutations for project lifecycle state transitions
import { publishProject, cancelProject, deleteProject } from "@/features/projects/api";
// Import shared status badge component
import { StatusBadge } from "@/components/shared/status-badge";
// Import display formatting helpers for currency and dates
import { formatMoney, formatDate, formatRelativeTime } from "@/lib/format";
// Import TypeScript interfaces for entity types
import type { Project, ProjectStatus } from "@/types/entities";

// Define pagination size constant
const PAGE_SIZE = 20;

// Define available status filter tab options
const STATUS_TABS: Array<{ label: string; value: ProjectStatus | "ALL" }> = [
  { label: "All Projects", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

// Define sort option types
type SortOption = "newest" | "oldest" | "budget_desc" | "budget_asc" | "deadline_asc";

// Define view display modes
type ViewMode = "grid" | "table";

// Main Projects Hub component for client project management
export default function ProjectsPage() {
  // Access session state for authenticated user identity
  const { user } = useSession();
  // Access React Query client for cache invalidation
  const queryClient = useQueryClient();

  // Page state for paginated dataset queries
  const [page, setPage] = useState<number>(1);
  // Selected status filter tab state
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | "ALL">("ALL");
  // Search query text string state
  const [searchQuery, setSearchQuery] = useState<string>("");
  // Selected sorting criteria state
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  // Active view layout mode state (grid vs table)
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  // Confirmation state target ID for cancel modal
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  // Confirmation state target ID for delete modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Fetch client-owned projects list from server with React Query
  const { data, isLoading, isFetching, refetch } = useQuery(
    clientProjectsOptions(page, PAGE_SIZE)
  );

  // Mutation handler for publishing a draft project to OPEN state
  const publishMutation = useMutation({
    mutationFn: (id: number) => publishProject(id),
    onSuccess: () => {
      // Invalidate project list cache to trigger updated feed
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  // Mutation handler for cancelling an open or draft project
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelProject(id),
    onSuccess: () => {
      // Clear confirmation target state and invalidate cache
      setCancelConfirmId(null);
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  // Mutation handler for permanently deleting a draft or cancelled project
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      // Clear confirmation target state and invalidate cache
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
    },
  });

  // Extract raw projects list from query response
  const rawItems = data?.items;

  // Compute total counts breakdown per project status lifecycle state
  const statusCounts = useMemo(() => {
    const allProjects = rawItems ?? [];
    // Initial counter structure for tabs and metric cards
    const counts: Record<ProjectStatus | "ALL", number> = {
      ALL: allProjects.length,
      OPEN: 0,
      IN_PROGRESS: 0,
      DRAFT: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    // Iterate over projects to accumulate totals safely
    allProjects.forEach((p) => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [rawItems]);

  // Compute filtered and sorted list of projects based on user controls
  const processedProjects = useMemo(() => {
    const allProjects = rawItems ?? [];
    // Apply status tab filter and search query matching
    const filtered = allProjects.filter((project) => {
      // Check status tab match condition
      const matchesStatus =
        selectedStatus === "ALL" || project.status === selectedStatus;

      // Check text search query in title, description, or skills
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.skills.some((s) => s.name.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });

    // Apply sorting rules based on selected sort option
    return [...filtered].sort((a, b) => {
      if (sortOption === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === "budget_desc") {
        return parseFloat(b.budget) - parseFloat(a.budget);
      }
      if (sortOption === "budget_asc") {
        return parseFloat(a.budget) - parseFloat(b.budget);
      }
      if (sortOption === "deadline_asc") {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });
  }, [rawItems, selectedStatus, searchQuery, sortOption]);

  // Guard against unauthenticated render (placed AFTER all hook calls)
  if (!user) return null;

  // Calculate total pages for backend pagination controls
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors duration-200">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Executive Page Navigation & Action Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div className="space-y-2">
            {/* Breadcrumb back navigation link */}
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors group"
              >
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </Link>
              <span className="text-border">/</span>
              <span className="text-foreground font-semibold">Projects Hub</span>
            </div>

            {/* Page Title & Subtitle */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                My Projects
                {/* Live refetch status indicator pill */}
                {isFetching && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded-full bg-primary/10 text-primary animate-pulse">
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Syncing
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Oversee active contracts, publish project drafts, review proposals, and track deliverables.
              </p>
            </div>
          </div>

          {/* Primary Action Button Bar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Manual refresh button */}
            <button
              onClick={() => refetch()}
              title="Refresh project list"
              className="p-2.5 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/80 border border-border rounded-xl transition-all shadow-xs"
            >
              <svg className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* New Project creation CTA button */}
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] shrink-0"
            >
              <svg className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Link>
          </div>
        </div>

        {/* Executive KPI Metrics Cards with Quick-Filter Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI Card 1: Total Projects */}
          <button
            onClick={() => setSelectedStatus("ALL")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
              selectedStatus === "ALL"
                ? "bg-card border-primary/50 ring-2 ring-primary/20 shadow-md"
                : "bg-card border-border hover:border-border/80 shadow-xs hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Volume</span>
              <div className="p-2 rounded-xl bg-muted text-muted-foreground group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{statusCounts.ALL}</span>
              <span className="text-xs text-muted-foreground">projects</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Click to view all projects
            </div>
          </button>

          {/* KPI Card 2: Open Postings */}
          <button
            onClick={() => setSelectedStatus("OPEN")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
              selectedStatus === "OPEN"
                ? "bg-emerald-500/5 border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-card border-border hover:border-emerald-500/40 shadow-xs hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Open Postings
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{statusCounts.OPEN}</span>
              <span className="text-xs text-muted-foreground">accepting proposals</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Ready for proposal review
            </div>
          </button>

          {/* KPI Card 3: In Progress */}
          <button
            onClick={() => setSelectedStatus("IN_PROGRESS")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
              selectedStatus === "IN_PROGRESS"
                ? "bg-purple-500/5 border-purple-500/50 ring-2 ring-purple-500/20 shadow-md"
                : "bg-card border-border hover:border-purple-500/40 shadow-xs hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">In Progress</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">{statusCounts.IN_PROGRESS}</span>
              <span className="text-xs text-muted-foreground">active contracts</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Tasks & deliverables active
            </div>
          </button>

          {/* KPI Card 4: Drafts & Completed */}
          <button
            onClick={() => setSelectedStatus("DRAFT")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
              selectedStatus === "DRAFT" || selectedStatus === "COMPLETED"
                ? "bg-card border-primary/50 ring-2 ring-primary/20 shadow-md"
                : "bg-card border-border hover:border-border/80 shadow-xs hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drafts / Done</span>
              <div className="p-2 rounded-xl bg-muted text-muted-foreground group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{statusCounts.DRAFT}</span>
              <span className="text-xs text-muted-foreground">Drafts</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 ml-1">/ {statusCounts.COMPLETED} Done</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Unpublished drafts & finished jobs
            </div>
          </button>
        </div>

        {/* Control Toolbar: Status Filter Tabs, Search, Sort & View Mode */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 p-3 sm:p-4 rounded-2xl shadow-xs">
            
            {/* Status Navigation Tabs with live badge counters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
              {STATUS_TABS.map((tab) => {
                const isSelected = selectedStatus === tab.value;
                const count = statusCounts[tab.value];

                return (
                  <button
                    key={tab.value}
                    onClick={() => setSelectedStatus(tab.value)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all duration-150 ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Search Box, Sort Dropdown & View Switcher */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
              
              {/* Search input field */}
              <div className="relative flex-1 sm:w-64">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
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
                  placeholder="Search title, skills..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sort selector dropdown */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="budget_desc">Highest Budget</option>
                <option value="budget_asc">Lowest Budget</option>
                <option value="deadline_asc">Approaching Deadline</option>
              </select>

              {/* View layout toggle buttons (Grid vs Table) */}
              <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    viewMode === "grid"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  title="Table View"
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Summary Indicator */}
          {(searchQuery || selectedStatus !== "ALL") && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <span>Showing {processedProjects.length} matching project{processedProjects.length === 1 ? "" : "s"}</span>
              <button
                onClick={() => {
                  setSelectedStatus("ALL");
                  setSearchQuery("");
                }}
                className="text-primary hover:underline font-medium text-[11px]"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Project Content Area: Grid View, Table View, Skeleton, or Empty State */}
        {isLoading ? (
          /* Shimmer Loading Skeletons */
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 bg-card rounded-2xl border border-border p-6 animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-muted rounded-md w-1/3" />
                  <div className="h-5 bg-muted rounded-full w-20" />
                </div>
                <div className="h-4 bg-muted rounded-md w-2/3" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 bg-muted rounded-md w-1/4" />
                  <div className="h-8 bg-muted rounded-xl w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : processedProjects.length > 0 ? (
          viewMode === "grid" ? (
            /* Card Grid Layout View */
            <div className="space-y-4">
              {processedProjects.map((project: Project) => {
                const isDraft = project.status === "DRAFT";
                const isOpen = project.status === "OPEN";
                const isCancelled = project.status === "CANCELLED";
                const canCancel = isDraft || isOpen;
                const canDelete = isDraft || isCancelled;

                // Border accent color determined by project lifecycle status
                const statusBorderClass =
                  project.status === "OPEN"
                    ? "border-l-4 border-l-emerald-500"
                    : project.status === "IN_PROGRESS"
                    ? "border-l-4 border-l-purple-500"
                    : project.status === "COMPLETED"
                    ? "border-l-4 border-l-green-600"
                    : project.status === "CANCELLED"
                    ? "border-l-4 border-l-red-500"
                    : "border-l-4 border-l-neutral-400 dark:border-l-neutral-600";

                return (
                  <div
                    key={project.id}
                    className={`bg-card rounded-2xl border border-border ${statusBorderClass} p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 group`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      
                      {/* Main Card Information Header */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Link
                            href={`/projects/${project.id}`}
                            className="text-lg font-bold text-foreground hover:text-primary transition-colors group-hover:underline decoration-primary/40 underline-offset-4"
                          >
                            {project.title}
                          </Link>
                          <StatusBadge status={project.status} />
                          <span className="text-[11px] text-muted-foreground font-medium">
                            Created {formatRelativeTime(project.created_at)}
                          </span>
                        </div>

                        {/* Project Description excerpt */}
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>

                        {/* Skill Badges tags */}
                        {project.skills.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            {project.skills.slice(0, 6).map((skill) => (
                              <span
                                key={skill.id}
                                className="text-[11px] px-2.5 py-0.5 rounded-lg bg-secondary text-secondary-foreground font-medium border border-border/50"
                              >
                                {skill.name}
                              </span>
                            ))}
                            {project.skills.length > 6 && (
                              <span className="text-[11px] text-muted-foreground font-medium self-center pl-1">
                                +{project.skills.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Budget & Deadline Panel */}
                      <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-border/60 pt-3 sm:pt-0 flex sm:flex-col justify-between items-center sm:items-end">
                        <div>
                          <div className="text-lg font-extrabold text-foreground tracking-tight">
                            {formatMoney(project.budget, project.currency)}
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mt-0.5">
                            Target: {formatDate(project.deadline)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Toolbar & Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-border/60">
                      
                      {/* Left Metadata info */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium">
                          <svg className="h-3.5 w-3.5 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Created {formatDate(project.created_at)}
                        </span>
                      </div>

                      {/* Action buttons group */}
                      <div className="flex items-center gap-2 flex-wrap">
                        
                        {/* Draft actions: Edit & Publish */}
                        {isDraft && (
                          <>
                            <Link
                              href={`/projects/${project.id}/edit`}
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-foreground transition-all"
                            >
                              Edit Draft
                            </Link>
                            <button
                              onClick={() => publishMutation.mutate(project.id)}
                              disabled={publishMutation.isPending}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {publishMutation.isPending && (
                                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              )}
                              Publish
                            </button>
                          </>
                        )}

                        {/* Cancel Confirmation Popover */}
                        {canCancel && cancelConfirmId !== project.id && (
                          <button
                            onClick={() => setCancelConfirmId(project.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                        {cancelConfirmId === project.id && (
                          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl text-xs">
                            <span className="text-amber-700 dark:text-amber-300 font-medium">Cancel project?</span>
                            <button
                              onClick={() => cancelMutation.mutate(project.id)}
                              disabled={cancelMutation.isPending}
                              className="px-2.5 py-0.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setCancelConfirmId(null)}
                              className="text-muted-foreground hover:text-foreground font-medium px-1"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        {/* Delete Confirmation Popover */}
                        {canDelete && deleteConfirmId !== project.id && (
                          <button
                            onClick={() => setDeleteConfirmId(project.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all"
                          >
                            Delete
                          </button>
                        )}
                        {deleteConfirmId === project.id && (
                          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1 rounded-xl text-xs">
                            <span className="text-destructive font-medium">Delete permanently?</span>
                            <button
                              onClick={() => deleteMutation.mutate(project.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2.5 py-0.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-muted-foreground hover:text-foreground font-medium px-1"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        {/* Primary View Details CTA Link */}
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-xs font-semibold px-4 py-1.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all inline-flex items-center gap-1.5 group/btn"
                        >
                          View & Proposals
                          <svg className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact Table View Mode */
            <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Project Title</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Budget</th>
                      <th className="px-5 py-3.5">Deadline</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {processedProjects.map((project: Project) => (
                      <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <Link href={`/projects/${project.id}`} className="font-bold text-foreground hover:text-primary transition-colors text-sm">
                            {project.title}
                          </Link>
                          <div className="text-muted-foreground line-clamp-1 mt-0.5 text-[11px]">
                            {project.description}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={project.status} />
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground">
                          {formatMoney(project.budget, project.currency)}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground font-medium">
                          {formatDate(project.deadline)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/projects/${project.id}`}
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* Empty State when zero projects match filters */
          <div className="text-center py-16 px-6 bg-card rounded-3xl border border-border shadow-xs max-w-lg mx-auto">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-foreground">No projects found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              {searchQuery || selectedStatus !== "ALL"
                ? "No project matches your active search term or filter parameters."
                : "You have not published or created any projects yet."}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              {(searchQuery || selectedStatus !== "ALL") && (
                <button
                  onClick={() => {
                    setSelectedStatus("ALL");
                    setSearchQuery("");
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground transition-all"
                >
                  Clear Filters
                </button>
              )}
              <Link
                href="/projects/new"
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
              >
                + Create New Project
              </Link>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({data?.total ?? 0} total records)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

