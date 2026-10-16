"use client";

// Import core React hooks for state management and memoization
import { useState, useMemo } from "react";
// Import Next.js link for client-side navigation
import Link from "next/link";
// Import React Query hooks for query options, mutations, and cache management
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Import authentication session context provider
import { useSession } from "@/app/providers";
// Import proposal query options and query key contracts
import { ownProposalsOptions, proposalKeys } from "@/features/proposals/queries";
// Import API mutation for withdrawing proposals
import { withdrawProposal } from "@/features/proposals/api";
// Import shared status badge component
import { StatusBadge } from "@/components/shared/status-badge";
// Import display formatting helpers for currency, dates, and relative timestamps
import { formatMoney, formatDate, formatRelativeTime } from "@/lib/format";
// Import shared UUID label helper so project references render as short IDs
import { shortId } from "@/lib/identity";
// Import TypeScript entity types
import type { Proposal, ProposalStatus } from "@/types/entities";

// Load a full page of proposals (backend allows up to 100) so tabs/search/sort
// operate over one complete batch instead of a partial page
const PAGE_SIZE = 100;

// Define available proposal status tabs list
const STATUS_TABS: { value: ProposalStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Proposals" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

// Define sorting options for proposals
type SortOption = "newest" | "oldest" | "price_desc" | "price_asc" | "delivery_asc";

// Main Proposals Page Component
export default function ProposalsPage() {
  // Access Query Client for invalidating proposal queries on mutation success
  const queryClient = useQueryClient();
  // Access authenticated session user state
  const { user } = useSession();

  // Active status tab state filter
  const [activeTab, setActiveTab] = useState<ProposalStatus | "ALL">("ALL");
  // Active page number state for pagination
  const [page, setPage] = useState<number>(1);
  // Selected proposal ID for split-pane detail inspection
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  // Search text query state
  const [searchQuery, setSearchQuery] = useState<string>("");
  // Selected sorting criteria state
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  // Fetch freelancer's submitted proposals from API server
  const { data, isLoading, isFetching, refetch } = useQuery(
    ownProposalsOptions(page, PAGE_SIZE)
  );

  // Extract raw items array from pagination query result
  const rawItems = data?.items;

  // Compute status metrics breakdown for KPI cards and filter tab counters
  const statusCounts = useMemo(() => {
    const allProposals = rawItems ?? [];
    // Initial counter dictionary setup
    const counts: Record<ProposalStatus | "ALL", number> = {
      ALL: allProposals.length,
      PENDING: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };
    // Tally proposal count per status
    allProposals.forEach((p) => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [rawItems]);

  // Compute filtered and sorted proposals based on search and tab selections
  const processedProposals = useMemo(() => {
    const allProposals = rawItems ?? [];
    // Filter proposals by selected status tab and search query string
    const filtered = allProposals.filter((proposal) => {
      // Check status tab match condition
      const matchesTab = activeTab === "ALL" || proposal.status === activeTab;

      // Check text search query match in cover letter or short project reference
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        proposal.cover_letter.toLowerCase().includes(query) ||
        shortId(proposal.project_id).toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });

    // Apply sorting rules based on selected sort option
    return [...filtered].sort((a, b) => {
      if (sortOption === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === "price_desc") {
        return Number(b.proposed_price) - Number(a.proposed_price);
      }
      if (sortOption === "price_asc") {
        return Number(a.proposed_price) - Number(b.proposed_price);
      }
      if (sortOption === "delivery_asc") {
        return a.delivery_days - b.delivery_days;
      }
      return 0;
    });
  }, [rawItems, activeTab, searchQuery, sortOption]);

  // Selected proposal reference object for right inspector pane
  const selectedProposal = useMemo(() => {
    return (
      processedProposals.find((p) => p.id === selectedProposalId) ??
      processedProposals[0]
    );
  }, [processedProposals, selectedProposalId]);

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
              <span className="text-foreground font-semibold">My Proposals</span>
            </div>

            {/* Page Title & Subtitle */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                Proposals Tracker
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
                Track submitted project applications, review client responses, and manage active proposals.
              </p>
            </div>
          </div>

          {/* Primary Action Button Bar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Refresh button */}
            <button
              onClick={() => refetch()}
              title="Refresh proposal list"
              className="p-2.5 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/80 border border-border rounded-xl transition-all shadow-xs"
            >
              <svg className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Explore Marketplace CTA button */}
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore Marketplace
            </Link>
          </div>
        </div>

        {/* Executive KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* KPI Card 1: Total Proposals */}
          <button
            onClick={() => setActiveTab("ALL")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${activeTab === "ALL"
              ? "bg-card border-primary/50 ring-2 ring-primary/20 shadow-md"
              : "bg-card border-border hover:border-border/80 shadow-xs hover:shadow-md"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Submitted</span>
              <div className="p-2 rounded-xl bg-muted text-muted-foreground group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              {/* true count across every page, straight from the API total */}
              <span className="text-3xl font-extrabold text-foreground">{data?.total ?? 0}</span>
              <span className="text-xs text-muted-foreground">proposals</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Across all pages
            </div>
          </button>

          {/* KPI Card 2: Pending Review */}
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${activeTab === "PENDING"
              ? "bg-amber-500/5 border-amber-500/50 ring-2 ring-amber-500/20 shadow-md"
              : "bg-card border-border hover:border-amber-500/40 shadow-xs hover:shadow-md"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Pending Review
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{statusCounts.PENDING}</span>
              <span className="text-xs text-muted-foreground">awaiting client</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              On this page
            </div>
          </button>

          {/* KPI Card 3: Accepted Contracts */}
          <button
            onClick={() => setActiveTab("ACCEPTED")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${activeTab === "ACCEPTED"
              ? "bg-emerald-500/5 border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-md"
              : "bg-card border-border hover:border-emerald-500/40 shadow-xs hover:shadow-md"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Accepted</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{statusCounts.ACCEPTED}</span>
              <span className="text-xs text-muted-foreground">contracts awarded</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              On this page
            </div>
          </button>

          {/* KPI Card 4: Rejected (page-scoped status count, replaces the old
              win-rate/avg-delivery analytics that implied all-time totals) */}
          <button
            onClick={() => setActiveTab("REJECTED")}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${activeTab === "REJECTED"
              ? "bg-rose-500/5 border-rose-500/50 ring-2 ring-rose-500/20 shadow-md"
              : "bg-card border-border hover:border-rose-500/40 shadow-xs hover:shadow-md"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">{statusCounts.REJECTED}</span>
              <span className="text-xs text-muted-foreground">declined</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              On this page
            </div>
          </button>
        </div>

        {/* Page-scope note — keeps the status counts honest when there is more than one page */}
        {totalPages > 1 && (
          <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-4 py-2.5">
            Status counts, tabs and search cover the {rawItems?.length ?? 0} proposals loaded on this page.
            Use pagination for the remaining {Math.max((data?.total ?? 0) - (rawItems?.length ?? 0), 0)}.
          </p>
        )}

        {/* Status Filter Tabs & Search Control Bar */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 p-3 sm:p-4 rounded-2xl shadow-xs">

            {/* Status Navigation Tabs with counter badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
              {STATUS_TABS.map((tab) => {
                const isSelected = activeTab === tab.value;
                const count =
                  tab.value === "ALL"
                    ? statusCounts.ALL
                    : statusCounts[tab.value] ?? 0;

                return (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all duration-150 ${isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${isSelected
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

            {/* Search Box & Sort Selector */}
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
                  placeholder="Search cover letter, project #..."
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
                <option value="price_desc">Highest Price</option>
                <option value="price_asc">Lowest Price</option>
                <option value="delivery_asc">Fastest Delivery</option>
              </select>
            </div>
          </div>

          {/* Active Filter Summary Indicator */}
          {(searchQuery || activeTab !== "ALL") && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <span>Showing {processedProposals.length} matching proposal{processedProposals.length === 1 ? "" : "s"}</span>
              <button
                onClick={() => {
                  setActiveTab("ALL");
                  setSearchQuery("");
                }}
                className="text-primary hover:underline font-medium text-[11px]"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Proposals Split-Pane Content Area */}
        {isLoading ? (
          /* Shimmer Loading Skeletons */
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,0.85fr)_minmax(480px,1.15fr)] gap-6 items-start">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-card rounded-2xl border border-border p-4 animate-pulse space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded-full w-16" />
                  </div>
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              ))}
            </div>
            <div className="h-96 bg-card rounded-2xl border border-border p-6 animate-pulse" />
          </div>
        ) : processedProposals.length > 0 ? (
          /* Split-View Layout: Left List, Right Sticky Inspector */
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,0.85fr)_minmax(480px,1.15fr)] gap-6 items-start">

            {/* Left Column: Proposals Card List */}
            <div className="space-y-3">
              {processedProposals.map((proposal: Proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  selected={proposal.id === selectedProposal?.id}
                  onSelect={() => setSelectedProposalId(proposal.id)}
                  onWithdraw={() => {
                    queryClient.invalidateQueries({ queryKey: proposalKeys.own() });
                  }}
                />
              ))}
            </div>

            {/* Right Column: Selected Proposal Details Inspector Pane */}
            <ProposalDetails proposal={selectedProposal} />
          </div>
        ) : (
          /* Empty State when zero proposals match */
          <div className="text-center py-16 px-6 bg-card rounded-3xl border border-border shadow-xs max-w-lg mx-auto">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-foreground">No proposals found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              {searchQuery || activeTab !== "ALL"
                ? "No proposal matches your active search term or filter status."
                : "You have not submitted any project proposals yet."}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              {(searchQuery || activeTab !== "ALL") && (
                <button
                  onClick={() => {
                    setActiveTab("ALL");
                    setSearchQuery("");
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground transition-all"
                >
                  Clear Filters
                </button>
              )}
              <Link
                href="/marketplace"
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
              >
                Browse Marketplace
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

// Subcomponent: Selected Proposal Detail Inspector Pane
function ProposalDetails({ proposal }: { proposal?: Proposal }) {
  // Return null if no proposal selected
  if (!proposal) return null;

  // Explanatory guidance message per proposal status state
  const statusGuidance = {
    PENDING: {
      text: "Your proposal is actively under review by the client. You may withdraw it before acceptance.",
      bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    },
    ACCEPTED: {
      text: "🎉 Congratulations! The client accepted your proposal. An active contract has been initialized.",
      bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    },
    REJECTED: {
      text: "This proposal was declined by the client. Keep applying to open marketplace opportunities.",
      bg: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    },
    WITHDRAWN: {
      text: "You voluntarily withdrew this proposal application. It can no longer be edited.",
      bg: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 border-neutral-500/20",
    },
  }[proposal.status];

  return (
    <aside className="bg-card rounded-2xl border border-border/80 p-6 shadow-xs lg:sticky lg:top-6 lg:self-start space-y-6 overflow-y-scroll max-h-[calc(100vh-4rem)] scroll-pt-20">

      {/* Header section with Project ID and Status Badge */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Inspector</span>
          <h2 className="text-xl font-extrabold text-foreground mt-0.5">
            Project #{shortId(proposal.project_id)}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submitted {formatRelativeTime(proposal.created_at)} ({formatDate(proposal.created_at)})
          </p>
        </div>
        <StatusBadge status={proposal.status} domain="proposal" />
      </div>

      {/* Guidance Callout Box */}
      <div className={`p-4 rounded-xl text-xs font-medium border ${statusGuidance.bg}`}>
        {statusGuidance.text}
      </div>

      {/* Key Financial & Delivery Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Proposed Price</p>
          <p className="text-lg font-extrabold text-foreground mt-1">
            {formatMoney(proposal.proposed_price, proposal.currency)}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Delivery Time</p>
          <p className="text-lg font-extrabold text-foreground mt-1">
            {proposal.delivery_days} <span className="text-xs font-medium text-muted-foreground">days</span>
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/50 border border-border/50 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Submitted Date</p>
          <p className="text-sm font-bold text-foreground mt-1.5 truncate">
            {formatDate(proposal.created_at)}
          </p>
        </div>
      </div>

      {/* Cover Letter Section */}
      <div className="space-y-2 pt-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Submitted Cover Letter
        </h3>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words font-sans">
          {proposal.cover_letter}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {proposal.status === "ACCEPTED" ? (
          <Link
            href="/contracts"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-xs"
          >
            <span>Open Contract Workspace</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        ) : null}
        <Link
          href={`/marketplace/${proposal.project_id}`}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-card border border-border text-foreground rounded-xl hover:bg-muted transition-all shadow-xs"
        >
          <span>View Project Posting</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}

// Subcomponent: Individual Proposal Card item in left list
function ProposalCard({
  proposal,
  selected,
  onSelect,
  onWithdraw,
}: {
  proposal: Proposal;
  selected: boolean;
  onSelect: () => void;
  onWithdraw: () => void;
}) {
  // State for confirming withdrawal action
  const [confirming, setConfirming] = useState(false);

  // Mutation hook to handle proposal withdrawal
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawProposal(proposal.id),
    onSuccess: () => {
      onWithdraw();
      setConfirming(false);
    },
  });

  // Trigger handler for withdrawal sequence
  const handleWithdraw = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    withdrawMutation.mutate();
  };

  // Status border accent styling
  const statusBorderClass =
    proposal.status === "PENDING"
      ? "border-l-4 border-l-amber-500"
      : proposal.status === "ACCEPTED"
        ? "border-l-4 border-l-emerald-500"
        : proposal.status === "REJECTED"
          ? "border-l-4 border-l-rose-500"
          : "border-l-4 border-l-neutral-400 dark:border-l-neutral-600";

  return (
    <div
      onClick={onSelect}
      className={`bg-card rounded-2xl border ${statusBorderClass} p-4 sm:p-5 transition-all duration-200 cursor-pointer relative group ${selected
        ? "border-primary/50 ring-2 ring-primary/20 shadow-md bg-card"
        : "border-border hover:border-border/80 shadow-xs hover:shadow-md"
        }`}
    >
      <div className="flex items-start justify-between gap-3">

        {/* Left Project ID and Cover Letter Excerpt */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/marketplace/${proposal.project_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-bold text-foreground hover:text-primary transition-colors group-hover:underline"
            >
              Project #{shortId(proposal.project_id)}
            </Link>
            <StatusBadge status={proposal.status} domain="proposal" />
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {proposal.cover_letter}
          </p>
        </div>

        {/* Right Price & Delivery Badge */}
        <div className="text-right shrink-0">
          <p className="text-sm font-extrabold text-foreground">
            {formatMoney(proposal.proposed_price, proposal.currency)}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
            {proposal.delivery_days} days
          </p>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60 text-xs">
        <span className="text-[11px] text-muted-foreground">
          {formatRelativeTime(proposal.created_at)}
        </span>

        <div className="flex items-center gap-2">
          {/* Withdraw Button — only enabled for PENDING proposals */}
          {proposal.status === "PENDING" && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {confirming && (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Withdraw proposal?</span>
              )}
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all ${confirming
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  } disabled:opacity-50`}
              >
                {withdrawMutation.isPending ? "Withdrawing..." : confirming ? "Confirm" : "Withdraw"}
              </button>
              {confirming && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirming(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-1"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* View details pill button */}
          <button
            type="button"
            onClick={onSelect}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all ${selected
              ? "bg-primary/10 text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  );
}

