"use client";

// Contract list for both roles (Architecture.md §4).
// Executive view: KPI cards, status filter tabs, search, and sortable cards.

// Import core React hooks for state management and memoization
import { useState, useMemo } from "react";
// Import Next.js link for client-side navigation
import Link from "next/link";
// Import React Query hooks for query and cache management
import { useQuery } from "@tanstack/react-query";

// Import authentication session context provider
import { useSession } from "@/app/providers";
// Import contract query options for data fetching
import { contractListOptions } from "@/features/contracts/queries";
// Import status badge reusable component
import { StatusBadge } from "@/components/shared/status-badge";
// Import display formatting helpers
import { formatMoney, formatDate, formatRelativeTime } from "@/lib/format";
// Import shared UUID label helper so references render as short IDs
import { participantLabel, shortId } from "@/lib/identity";
// Import TypeScript entity types
import type { ContractStatus } from "@/types/entities";

// Pagination page size constant
const PAGE_SIZE = 20;

// Status filter tab definitions with labels and icon SVG paths
const STATUS_TABS: { value: ContractStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Contracts" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// KPI card configuration for quick status counters
const KPI_CONFIG: { status: ContractStatus; label: string; iconPath: string; color: string; bgColor: string }[] = [
  {
    status: "ACTIVE",
    label: "Active",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    status: "COMPLETED",
    label: "Completed",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    status: "CANCELLED",
    label: "Cancelled",
    iconPath: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
];

// Sorting options for contract list
type SortOption = "newest" | "oldest" | "price_desc" | "price_asc" | "deadline_asc";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "price_desc", label: "Highest Price" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "deadline_asc", label: "Soonest Deadline" },
];

// Main Contracts Page Component
export default function ContractsPage() {
  // Access authenticated session user state
  const { user } = useSession();

  // Active page number state for pagination
  const [page, setPage] = useState(1);
  // Status filter tab state
  const [activeTab, setActiveTab] = useState<ContractStatus | "ALL">("ALL");
  // Search text query state
  const [searchQuery, setSearchQuery] = useState("");
  // Sort option state
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  // Fetch user's contracts from API server
  const { data, isLoading, isFetching, refetch } = useQuery(
    contractListOptions(page, PAGE_SIZE)
  );

  // Extract raw items from paginated response
  const rawItems = data?.items;

  // Compute status count metrics for KPI cards and tab badges
  const statusCounts = useMemo(() => {
    const allContracts = rawItems ?? [];
    const counts: Record<ContractStatus | "ALL", number> = {
      ALL: allContracts.length,
      ACTIVE: 0,
      DELIVERED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    allContracts.forEach((c) => {
      if (counts[c.status] !== undefined) {
        counts[c.status]++;
      }
    });
    return counts;
  }, [rawItems]);

  // Sum contract values only when every contract shares one currency.
  // Adding ETB + USD would produce a meaningless number, so differing
  // currencies return null and the card shows "Mixed currencies" instead.
  const totalValue = useMemo(() => {
    const allContracts = rawItems ?? [];
    if (allContracts.length === 0) return null;
    // distinct currency codes present in the loaded batch
    const currencies = new Set(allContracts.map((c) => c.currency));
    if (currencies.size > 1) return null;
    const sum = allContracts.reduce((acc, c) => acc + (parseFloat(c.agreed_price) || 0), 0);
    return { amount: sum.toFixed(2), currency: Array.from(currencies)[0] };
  }, [rawItems]);

  // Compute filtered and sorted contracts based on tab, search, and sort selections
  const processedContracts = useMemo(() => {
    const allContracts = rawItems ?? [];
    // Filter by active status tab
    const filtered = allContracts.filter((contract) => {
      const matchesTab = activeTab === "ALL" || contract.status === activeTab;
      // Filter by search query against contract ID, project ID, or party IDs
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        String(contract.id).includes(query) ||
        String(contract.project_id).includes(query) ||
        String(contract.client_id).includes(query) ||
        String(contract.freelancer_id).includes(query);
      return matchesTab && matchesSearch;
    });

    // Apply sorting rules
    return [...filtered].sort((a, b) => {
      if (sortOption === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOption === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOption === "price_desc") return parseFloat(b.agreed_price) - parseFloat(a.agreed_price);
      if (sortOption === "price_asc") return parseFloat(a.agreed_price) - parseFloat(b.agreed_price);
      if (sortOption === "deadline_asc") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return 0;
    });
  }, [rawItems, activeTab, searchQuery, sortOption]);

  // Guard against unauthenticated render
  if (!user) return null;

  const isClient = user.role === "CLIENT";
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors duration-200">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Breadcrumb & Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-border/60">
          <div className="space-y-2">
            {/* Breadcrumb navigation */}
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
              <span className="text-foreground font-semibold">Contracts</span>
            </div>
            {/* Title & Subtitle */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                Contracts
                {/* Live sync indicator */}
                {isFetching && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-primary/10 text-primary animate-pulse">
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Syncing
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isClient
                  ? "Manage your active and completed contracts with freelancers."
                  : "Track your contracts, tasks, and deliverables with clients."}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Manual refresh button */}
            <button
              onClick={() => refetch()}
              title="Refresh contracts"
              className="p-2.5 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/80 border border-border rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <svg className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {/* Navigate to marketplace or projects based on role */}
            <Link
              href={isClient ? "/projects" : "/marketplace"}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isClient ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" : "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"} />
              </svg>
              {isClient ? "My Projects" : "Marketplace"}
            </Link>
          </div>
        </div>

        {/* KPI Stat Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total contracts + value card */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Total
            </div>
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{statusCounts.ALL}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {!rawItems || rawItems.length === 0
                ? "No contracts yet"
                : totalValue
                  ? `${formatMoney(totalValue.amount, totalValue.currency)} value`
                  : "Mixed currencies"}
            </p>
          </div>

          {/* Status-specific KPI cards */}
          {KPI_CONFIG.map((kpi) => (
            <button
              key={kpi.status}
              onClick={() => setActiveTab(activeTab === kpi.status ? "ALL" : kpi.status)}
              className={`bg-card rounded-2xl border p-4 shadow-xs text-left transition-all cursor-pointer ${
                activeTab === kpi.status
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <div className={`h-5 w-5 ${kpi.bgColor} ${kpi.color} rounded flex items-center justify-center`}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={kpi.iconPath} />
                  </svg>
                </div>
                {kpi.label}
              </div>
              <p className="text-2xl font-extrabold text-foreground tabular-nums">{statusCounts[kpi.status]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {statusCounts[kpi.status] === 1 ? "contract" : "contracts"}
              </p>
            </button>
          ))}
        </div>

        {/* Control Toolbar: Search, Sort, Status Tabs */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 p-3 sm:p-4 rounded-2xl shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by contract ID, project ID..."
                className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-3">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_TABS.map((tab) => {
              const count = statusCounts[tab.value];
              const isSelected = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contract Cards List */}
        {isLoading ? (
          /* Shimmer Loading Skeletons */
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-5 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-5 bg-muted rounded w-32" />
                      <div className="h-5 bg-muted rounded-full w-16" />
                    </div>
                    <div className="h-4 bg-muted rounded w-64" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-5 bg-muted rounded w-24 ml-auto" />
                    <div className="h-4 bg-muted rounded w-20 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : processedContracts.length > 0 ? (
          <div className="space-y-3">
            {processedContracts.map((contract) => {
              // Calculate deadline proximity for urgency indicators
              const deadlineDate = new Date(contract.deadline);
              const now = new Date();
              const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
              const isUrgent = contract.status === "ACTIVE" && daysRemaining <= 7;
              const isOverdue = contract.status === "ACTIVE" && daysRemaining === 0;

              // Determine which party label to show based on the user's role
              const otherPartyLabel = user.id === contract.client_id
                ? participantLabel("Freelancer", contract.freelancer_id)
                : participantLabel("Client", contract.client_id);
              const userRoleInContract = user.id === contract.client_id ? "Client" : "Freelancer";

              return (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="group block bg-card rounded-2xl border border-border hover:border-primary/30 p-5 shadow-xs hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Contract Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          Contract #{shortId(contract.id)}
                        </h3>
                        <StatusBadge status={contract.status} />
                        {isUrgent && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                            isOverdue
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/10 text-warning"
                          }`}>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {isOverdue ? "Overdue" : `${daysRemaining}d left`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {/* Project reference */}
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Project #{shortId(contract.project_id)}
                        </span>
                        <span className="text-border">·</span>
                        {/* Other party */}
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {otherPartyLabel}
                        </span>
                        <span className="text-border">·</span>
                        {/* User role */}
                        <span className="font-medium text-foreground/70">
                          You: {userRoleInContract}
                        </span>
                      </div>
                      {/* Timestamps */}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 mt-2">
                        <span>Created {formatRelativeTime(contract.created_at)}</span>
                        <span className="text-border">·</span>
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Due {formatDate(contract.deadline)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Price & CTA */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5 shrink-0">
                      <p className="text-lg font-extrabold text-foreground tabular-nums">
                        {formatMoney(contract.agreed_price, contract.currency)}
                      </p>
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        View Details
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20 px-6 bg-card rounded-3xl border border-border shadow-xs max-w-lg mx-auto">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-foreground">No contracts found</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
              {searchQuery || activeTab !== "ALL"
                ? "No contracts match your current filters. Try adjusting your search or status filter."
                : isClient
                  ? "You don't have any contracts yet. Accept a freelancer's proposal to create one."
                  : "You don't have any contracts yet. Submit proposals in the marketplace to get started."}
            </p>
            {(searchQuery || activeTab !== "ALL") && (
              <div className="mt-6">
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("ALL");
                  }}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}
            {!searchQuery && activeTab === "ALL" && (
              <div className="mt-6">
                <Link
                  href={isClient ? "/projects" : "/marketplace"}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                >
                  {isClient ? "Go to Projects" : "Browse Marketplace"}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({data?.total ?? 0} total contracts)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl bg-card hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
