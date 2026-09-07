"use client";

// Marketplace — freelancer browse/search/filter/sort over open projects
// (Architecture.md §4). CLIENT role hitting this route is redirected to /projects.
// Prefetch detail on row hover per Architecture §3.5.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { projectListOptions, projectDetailOptions } from "@/features/projects/queries";
import { skillsOptions } from "@/features/profiles/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const SORT_OPTIONS = [
  { value: "created_at", label: "Newest" },
  { value: "budget", label: "Budget" },
  { value: "deadline", label: "Deadline" },
] as const;

const PAGE_SIZE = 10;

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useSession();

  // Redirect clients to /projects
  if (isAuthenticated && user?.role === "CLIENT") {
    router.replace("/projects");
    return null;
  }

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  // Filter state from URL params
  const search = searchParams.get("search") ?? "";
  const skill = searchParams.get("skill") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "created_at";
  const page = Number(searchParams.get("page") ?? "1");

  // Local search input state
  const [searchInput, setSearchInput] = useState(search);

  const { data: allSkills = [] } = useQuery(skillsOptions);

  const filters = {
    page,
    page_size: PAGE_SIZE,
    search: search || undefined,
    skill: skill ? Number(skill) : undefined,
    sort_by: sortBy as "created_at" | "budget" | "deadline",
  };

  const { data, isLoading } = useQuery(projectListOptions(filters));

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  // Build URL with updated params
  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      if (updates.search) params.set("search", updates.search);
      if (updates.skill) params.set("skill", updates.skill);
      if (updates.sort_by && updates.sort_by !== "created_at") params.set("sort_by", updates.sort_by);
      if (updates.page && updates.page !== "1") params.set("page", updates.page);
      return `/marketplace${params.toString() ? `?${params.toString()}` : ""}`;
    },
    [],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput, skill, sort_by: sortBy, page: "1" }));
  };

  const handleSkillChange = (skillId: string) => {
    router.push(buildUrl({ search, skill: skillId, sort_by: sortBy, page: "1" }));
  };

  const handleSortChange = (sort: string) => {
    router.push(buildUrl({ search, skill, sort_by: sort, page: "1" }));
  };

  const handlePageChange = (newPage: number) => {
    router.push(buildUrl({ search, skill, sort_by: sortBy, page: String(newPage) }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="text-lg font-bold text-foreground hover:opacity-80 transition-opacity">
          ProLance
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">{user.full_name}</span>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse open projects and submit proposals.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search projects…"
              className="flex-1 bg-background border border-input rounded-lg px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </form>

          {/* Skill filter */}
          <select
            value={skill}
            onChange={(e) => handleSkillChange(e.target.value)}
            className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          >
            <option value="">All skills</option>
            {allSkills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="space-y-3">
              {data.items.map((project) => (
                <Link
                  key={project.id}
                  href={`/marketplace/${project.id}`}
                  className="block bg-card rounded-lg border border-border p-4 hover:border-muted-foreground/30 transition-colors"
                  onMouseEnter={() =>
                    queryClient.prefetchQuery(projectDetailOptions(project.id))
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {project.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <span className="text-sm font-semibold text-foreground">
                        {formatMoney(project.budget, project.currency)}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due {formatDate(project.deadline)}
                      </p>
                    </div>
                  </div>
                  {project.skills.length > 0 && (
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                      {project.skills.map((skill) => (
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({data.total} projects)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">No projects match your filters.</p>
          </div>
        )}
      </main>
    </div>
  );
}
