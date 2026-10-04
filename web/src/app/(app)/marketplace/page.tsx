"use client";

// Import core React hooks for state, memoization, navigation, and URL parameters
import { useCallback, useEffect, useState, useMemo } from "react";
// Import Next.js link and router for navigation
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
// Import React Query hooks for fetching and prefetching
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Import authentication session context provider
import { useSession } from "@/app/providers";
// Import query options for projects list, detail prefetching, and skills
import { projectListOptions, projectDetailOptions } from "@/features/projects/queries";
import { skillsOptions } from "@/features/profiles/queries";
// Import display formatting helpers for currency and dates
import { formatMoney, formatDate, formatRelativeTime } from "@/lib/format";
// Import TypeScript entity types
import type { Project } from "@/types/entities";

// Define sort option constants for dropdown selector
const SORT_OPTIONS = [
  { value: "created_at", label: "Newest First" },
  { value: "budget", label: "Highest Budget" },
  { value: "deadline", label: "Approaching Deadline" },
] as const;

// Define pagination size constant
const PAGE_SIZE = 12;

// Define view layout modes (Grid vs Table)
type ViewMode = "grid" | "table";

// Main Marketplace Page Component
export default function MarketplacePage() {
  // Access Next.js router and URL search parameters
  const router = useRouter();
  const searchParams = useSearchParams();
  // Access Query Client for query prefetching on card hover
  const queryClient = useQueryClient();
  // Access user session state
  const { user } = useSession();

  // Redirect client role users to /projects
  useEffect(() => {
    if (user?.role === "CLIENT") {
      router.replace("/projects");
    }
  }, [user, router]);

  // Read URL filter parameters
  const search = searchParams.get("search") ?? "";
  const skill = searchParams.get("skill") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "created_at";
  const page = Number(searchParams.get("page") ?? "1");

  // Local state for live text search input
  const [searchInput, setSearchInput] = useState<string>(search);
  // Local state for layout view mode (grid vs table)
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Fetch available skill categories for filter pills and dropdown
  const { data: allSkills = [] } = useQuery(skillsOptions);

  // Construct query filter object for backend API request
  const filters = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      search: search || undefined,
      skill: skill ? Number(skill) : undefined,
      sort_by: sortBy as "created_at" | "budget" | "deadline",
    }),
    [page, search, skill, sortBy]
  );

  // Query open marketplace projects list from API
  const { data, isLoading, isFetching, refetch } = useQuery(projectListOptions(filters));

  // Build target URL string with updated query parameter overrides
  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      if (updates.search) params.set("search", updates.search);
      if (updates.skill) params.set("skill", updates.skill);
      if (updates.sort_by && updates.sort_by !== "created_at") params.set("sort_by", updates.sort_by);
      if (updates.page && updates.page !== "1") params.set("page", updates.page);
      return `/marketplace${params.toString() ? `?${params.toString()}` : ""}`;
    },
    []
  );

  // Guard against unauthenticated render or CLIENT role
  if (!user || user.role === "CLIENT") return null;

  // Compute total pages for pagination controls
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  // Form submit handler for text search input
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput, skill, sort_by: sortBy, page: "1" }));
  };

  // Change handler for skill filter selection
  const handleSkillChange = (skillId: string) => {
    router.push(buildUrl({ search, skill: skillId, sort_by: sortBy, page: "1" }));
  };

  // Change handler for sort option selection
  const handleSortChange = (sort: string) => {
    router.push(buildUrl({ search, skill, sort_by: sort, page: "1" }));
  };

  // Page change handler for pagination controls
  const handlePageChange = (newPage: number) => {
    router.push(buildUrl({ search, skill, sort_by: sortBy, page: String(newPage) }));
  };

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors duration-200">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Executive Page Navigation & Header */}
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
              <span className="text-foreground font-semibold">Marketplace</span>
            </div>

            {/* Page Title & Subtitle */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                Marketplace Opportunities
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
                Discover open client projects, match your skills, and submit winning proposals.
              </p>
            </div>
          </div>

          {/* Top Actions: Refresh Button & Proposals Link */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Manual refresh button */}
            <button
              onClick={() => refetch()}
              title="Refresh marketplace listings"
              className="p-2.5 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/80 border border-border rounded-xl transition-all shadow-xs"
            >
              <svg className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* My Proposals CTA button */}
            <Link
              href="/proposals"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              My Submitted Proposals
            </Link>
          </div>
        </div>

        {/* Quick Skill Pill Filter Carousel */}
        {allSkills.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 mr-1 uppercase tracking-wider">Skills:</span>
            <button
              onClick={() => handleSkillChange("")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                skill === ""
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All Skills
            </button>
            {allSkills.slice(0, 10).map((s) => {
              const isSelected = skill === String(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => handleSkillChange(isSelected ? "" : String(s.id))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Control Toolbar: Search Form, Skill Dropdown, Sort & View Mode */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 p-3 sm:p-4 rounded-2xl shadow-xs">
            
            {/* Search Input Form */}
            <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search project titles, descriptions..."
                  className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      router.push(buildUrl({ search: "", skill, sort_by: sortBy, page: "1" }));
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs sm:text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs"
              >
                Search
              </button>
            </form>

            {/* Filter Dropdowns & View Mode Switcher */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
              
              {/* Skill Dropdown selector */}
              <select
                value={skill}
                onChange={(e) => handleSkillChange(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
              >
                <option value="">All Category Skills</option>
                {allSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Sort Dropdown selector */}
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* View mode switcher (Grid vs Table) */}
              <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid Cards View"
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
                  title="Table List View"
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
          {(search || skill) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <span>Showing results for active filters</span>
              <button
                onClick={() => router.push("/marketplace")}
                className="text-primary hover:underline font-medium text-[11px]"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Marketplace Content Area: Grid View, Table View, Skeleton, or Empty State */}
        {isLoading ? (
          /* Shimmer Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-card rounded-2xl border border-border p-5 animate-pulse space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-muted rounded w-1/2" />
                  <div className="h-5 bg-muted rounded-full w-16" />
                </div>
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="pt-2 flex justify-between items-center">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-7 bg-muted rounded-xl w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          viewMode === "grid" ? (
            /* Grid Cards Layout View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.items.map((project: Project) => {
                const projectCurrency = project.currency || "USD";

                return (
                  <Link
                    key={project.id}
                    href={`/marketplace/${project.id}`}
                    className="block bg-card rounded-2xl border border-border border-l-4 border-l-emerald-500 p-5 shadow-xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
                    onMouseEnter={() =>
                      queryClient.prefetchQuery(projectDetailOptions(project.id))
                    }
                  >
                    <div className="space-y-3">
                      
                      {/* Header with Title and Budget Pill */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors group-hover:underline decoration-primary/40 underline-offset-4 line-clamp-1">
                            {project.title}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                            Posted {formatRelativeTime(project.created_at)}
                          </p>
                        </div>
                        <span className="text-sm font-extrabold text-foreground px-2.5 py-1 rounded-xl bg-muted/80 border border-border/60 shrink-0">
                          {formatMoney(project.budget, projectCurrency)}
                        </span>
                      </div>

                      {/* Project Description excerpt */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>

                      {/* Skills Tags */}
                      {project.skills.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pt-1">
                          {project.skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill.id}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-secondary text-secondary-foreground border border-border/50"
                            >
                              {skill.name}
                            </span>
                          ))}
                          {project.skills.length > 4 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{project.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Target Deadline & Submit CTA */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60 text-xs">
                      <span className="text-muted-foreground font-medium">
                        Due {formatDate(project.deadline)}
                      </span>
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Submit Proposal →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Compact Data Table View Mode */
            <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Opportunity Title</th>
                      <th className="px-5 py-3.5">Required Skills</th>
                      <th className="px-5 py-3.5">Budget</th>
                      <th className="px-5 py-3.5">Deadline</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.items.map((project: Project) => {
                      const projectCurrency = project.currency || "USD";

                      return (
                        <tr
                          key={project.id}
                          className="hover:bg-muted/30 transition-colors"
                          onMouseEnter={() =>
                            queryClient.prefetchQuery(projectDetailOptions(project.id))
                          }
                        >
                          <td className="px-5 py-4">
                            <Link href={`/marketplace/${project.id}`} className="font-bold text-foreground hover:text-primary transition-colors text-sm">
                              {project.title}
                            </Link>
                            <div className="text-muted-foreground line-clamp-1 mt-0.5 text-[11px]">
                              {project.description}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-1 flex-wrap">
                              {project.skills.slice(0, 3).map((s) => (
                                <span key={s.id} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-bold text-foreground">
                            {formatMoney(project.budget, projectCurrency)}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground font-medium">
                            {formatDate(project.deadline)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/marketplace/${project.id}`}
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                              Submit Proposal →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-foreground">No opportunities found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              {search || skill
                ? "No open marketplace project matches your active search term or skill filter."
                : "There are currently no open project listings in the marketplace."}
            </p>
            {(search || skill) && (
              <div className="mt-6">
                <button
                  onClick={() => router.push("/marketplace")}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({data?.total ?? 0} total projects)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
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

