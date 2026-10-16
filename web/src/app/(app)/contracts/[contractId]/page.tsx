"use client";

// Contract workspace with tabs — Overview, Tasks, Deliverables
// (Architecture.md §4). Review modal opens after completion.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { contractDetailOptions, contractKeys } from "@/features/contracts/queries";
import { completeContract, cancelContract } from "@/features/contracts/api";
import { contractTasksOptions, taskKeys } from "@/features/tasks/queries";
import { createTask, updateTask, deleteTask } from "@/features/tasks/api";
import type { TaskCreateRequest, TaskUpdateRequest } from "@/features/tasks/types";
import { contractDeliverablesOptions, deliverableKeys } from "@/features/deliverables/queries";
import { submitDeliverable, approveDeliverable, requestRevision } from "@/features/deliverables/api";
import type { DeliverableSubmitRequest, DeliverableRevisionRequest } from "@/features/deliverables/types";
import { createDispute } from "@/features/disputes/api";
import { createReview } from "@/features/reviews/api";
import type { ReviewCreateRequest } from "@/features/reviews/types";
import { StatusBadge } from "@/components/shared/status-badge";
import { ParticipantAvatar } from "@/components/shared/participant-avatar";
import { formatMoney, formatDate, formatRelativeTime } from "@/lib/format";
import { isUuid, participantLabel, shortId } from "@/lib/identity";
import { ApiError } from "@/lib/api-client";
import type { Contract, Task, TaskStatus } from "@/types/entities";

// Tab definition type for rendering tab navigation
type Tab = "overview" | "tasks" | "deliverables";

// Tab configuration for rendering with icons and labels
const TAB_CONFIG: { id: Tab; label: string; iconPath: string }[] = [
  {
    id: "overview",
    label: "Overview",
    iconPath: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    id: "tasks",
    label: "Tasks",
    iconPath: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    id: "deliverables",
    label: "Deliverables",
    iconPath: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
  },
];

// Task kanban column definitions
const TASK_COLUMNS: { status: TaskStatus; label: string; iconPath: string; color: string }[] = [
  {
    status: "TODO",
    label: "To Do",
    iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-muted-foreground",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "text-primary",
  },
  {
    status: "DONE",
    label: "Done",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-success",
  },
];

export default function ContractWorkspacePage() {
  const params = useParams<{ contractId: string }>();
  // contract IDs are UUID strings on the wire, so never coerce them with Number()
  const contractId = params.contractId ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();

  // Derive the active tab straight from the URL so the URL stays the single
  // source of truth (no state mirroring, so no sync effect is needed).
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = tabParam === "tasks" || tabParam === "deliverables" ? tabParam : "overview";

  const [showReview, setShowReview] = useState(false);

  // Prefetch tasks & deliverables data alongside contract detail
  const { data: contract, isLoading: contractLoading } = useQuery(
    contractDetailOptions(contractId),
  );
  const { data: tasks = [] } = useQuery(contractTasksOptions(contractId));
  const { data: deliverables = [] } = useQuery(contractDeliverablesOptions(contractId));

  // Total and done counts drive the tab badge and the progress bar
  const taskCounts = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter((t) => t.status === "DONE").length,
  }), [tasks]);

  const deliverableCount = deliverables.length;

  // Guard: AppLayout ensures user is non-null before rendering
  if (!user) return null;

  // reject malformed URLs instead of querying the API with an invalid UUID
  if (!isUuid(contractId)) {
    router.replace("/contracts");
    return null;
  }

  // Loading skeleton
  if (contractLoading) {
    return (
      <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground">
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
          <div className="space-y-6 animate-pulse">
            {/* Breadcrumb skeleton */}
            <div className="h-4 bg-muted rounded w-56" />
            {/* Header skeleton */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <div className="h-7 bg-muted rounded w-64" />
                  <div className="h-4 bg-muted rounded w-48" />
                </div>
                <div className="h-10 bg-muted rounded-xl w-32" />
              </div>
              <div className="grid grid-cols-4 gap-4 pt-2">
                <div className="h-16 bg-muted rounded-xl" />
                <div className="h-16 bg-muted rounded-xl" />
                <div className="h-16 bg-muted rounded-xl" />
                <div className="h-16 bg-muted rounded-xl" />
              </div>
            </div>
            {/* Tab bar skeleton */}
            <div className="h-12 bg-muted rounded-xl w-80" />
            {/* Content skeleton */}
            <div className="bg-card rounded-2xl border border-border p-6 h-64" />
          </div>
        </main>
      </div>
    );
  }

  // Not found state
  if (!contract) {
    return (
      <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground">
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mb-5">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">Contract not found</h2>
            <p className="text-sm text-muted-foreground mt-2">This contract may have been removed or you don&apos;t have access.</p>
            <Link
              href="/contracts"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Contracts
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isClient = user.id === contract.client_id;
  const isActive = contract.status === "ACTIVE";

  // Compute deadline proximity for the header
  const deadlineDate = new Date(contract.deadline);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isDeadlineUrgent = daysRemaining <= 7;

  // Task completion percentage for the progress indicator
  const taskProgress = taskCounts.total > 0
    ? Math.round((taskCounts.done / taskCounts.total) * 100)
    : 0;

  // Handle tab navigation by writing to the URL (the derived active tab follows it)
  const handleTabChange = (tab: Tab) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span className="text-border">/</span>
          <Link href="/contracts" className="hover:text-foreground transition-colors">
            Contracts
          </Link>
          <span className="text-border">/</span>
          <span className="text-foreground font-semibold">Contract #{shortId(contract.id)}</span>
        </div>

        {/* Contract Header Card */}
        <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
          {/* Top: Title + Status + Price */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                  Contract #{shortId(contract.id)}
                </h1>
                <StatusBadge status={contract.status} />
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Project #{shortId(contract.project_id)}
                </span>
                <span className="text-border">·</span>
                <span>Created {formatRelativeTime(contract.created_at)}</span>
                <span className="text-border">·</span>
                <span>You are the <span className="font-semibold text-foreground">{isClient ? "Client" : "Freelancer"}</span></span>
              </p>
            </div>
            {/* Agreed price highlight */}
            <div className="bg-muted/60 rounded-xl px-5 py-3 border border-border/50 text-center shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Agreed Price</p>
              <p className="text-xl font-extrabold text-foreground tabular-nums">
                {formatMoney(contract.agreed_price, contract.currency)}
              </p>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Deadline stat */}
            <div className="bg-background rounded-xl p-3.5 border border-border/50">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Deadline
              </div>
              <p className="text-sm font-bold text-foreground">{formatDate(contract.deadline)}</p>
              <p className={`text-[10px] font-semibold mt-0.5 ${isDeadlineUrgent ? "text-destructive" : "text-success"}`}>
                {daysRemaining === 0 ? "Due today" : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left`}
              </p>
            </div>

            {/* Tasks stat */}
            <div className="bg-background rounded-xl p-3.5 border border-border/50">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Tasks
              </div>
              <p className="text-sm font-bold text-foreground">{taskCounts.done}/{taskCounts.total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{taskProgress}% complete</p>
            </div>

            {/* Deliverables stat */}
            <div className="bg-background rounded-xl p-3.5 border border-border/50">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Deliverables
              </div>
              <p className="text-sm font-bold text-foreground">{deliverableCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{deliverableCount === 1 ? "version" : "versions"} submitted</p>
            </div>

            {/* Parties stat */}
            <div className="bg-background rounded-xl p-3.5 border border-border/50">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Parties
              </div>
              <p className="text-sm font-bold text-foreground">{participantLabel("Client", contract.client_id)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{participantLabel("Freelancer", contract.freelancer_id)}</p>
            </div>
          </div>

          {/* Task Progress Bar — only visible if tasks exist */}
          {taskCounts.total > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Overall Progress</span>
                <span className="text-xs font-bold text-foreground">{taskProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation Bar */}
        <div className="bg-card rounded-xl border border-border p-1.5 shadow-xs inline-flex gap-1">
          {TAB_CONFIG.map((tab) => {
            const isSelected = activeTab === tab.id;
            // Badge count for each tab
            const badge = tab.id === "tasks" ? taskCounts.total : tab.id === "deliverables" ? deliverableCount : null;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.iconPath} />
                </svg>
                {tab.label}
                {badge !== null && badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab
            contract={contract}
            isClient={isClient}
            contractId={contractId}
            onComplete={() => setShowReview(true)}
          />
        )}
        {activeTab === "tasks" && (
          <TasksTab
            contractId={contractId}
            isActive={isActive}
          />
        )}
        {activeTab === "deliverables" && (
          <DeliverablesTab
            contractId={contractId}
            isActive={isActive}
            isClient={isClient}
          />
        )}
      </main>

      {/* Review modal — opens after contract completion */}
      {showReview && contract && (
        <ReviewModal
          contractId={contractId}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}

// ---------- Overview Tab ----------

function OverviewTab({
  contract,
  isClient,
  contractId,
  onComplete,
}: {
  contract: Contract;
  isClient: boolean;
  contractId: string;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [showDispute, setShowDispute] = useState(false);
  const [disputeTitle, setDisputeTitle] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // Confirmation guard state for dangerous actions
  const [confirmAction, setConfirmAction] = useState<"complete" | "cancel" | null>(null);

  const completeMutation = useMutation({
    mutationFn: () => completeContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
      setConfirmAction(null);
      onComplete();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
      setConfirmAction(null);
    },
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      createDispute({
        contract_id: contractId,
        title: disputeTitle.trim(),
        description: disputeDesc.trim(),
      }),
    onSuccess: () => {
      setShowDispute(false);
      setDisputeTitle("");
      setDisputeDesc("");
      setDisputeError(null);
    },
    onError: (err: ApiError) => {
      setDisputeError(err.message || "Failed to open dispute.");
    },
  });

  const canComplete = contract.status === "ACTIVE";
  const canCancel = contract.status === "ACTIVE";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column — Contract Details & Timeline (2/3) */}
      <div className="lg:col-span-2 space-y-6">

        {/* Contract Terms Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-xs">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Contract Terms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agreed Price</p>
              <p className="text-lg font-extrabold text-foreground tabular-nums">
                {formatMoney(contract.agreed_price, contract.currency)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Deadline</p>
              <p className="text-lg font-bold text-foreground">{formatDate(contract.deadline)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
              <StatusBadge status={contract.status} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5 pt-5 border-t border-border/50">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contract Created</p>
              <p className="text-sm font-semibold text-foreground">{formatDate(contract.created_at)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last Updated</p>
              <p className="text-sm font-semibold text-foreground">{formatDate(contract.updated_at)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Proposal</p>
              <p className="text-sm font-semibold text-foreground">#{shortId(contract.proposal_id)}</p>
            </div>
          </div>
        </div>

        {/* Dispute Form Section */}
        {showDispute && (
          <div className="bg-card rounded-2xl border border-destructive/20 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-destructive/10 text-destructive rounded-lg flex items-center justify-center shrink-0">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Open a Dispute</h3>
                <p className="text-[11px] text-muted-foreground">Describe the issue for admin review and resolution.</p>
              </div>
            </div>
            <input
              type="text"
              value={disputeTitle}
              onChange={(e) => setDisputeTitle(e.target.value)}
              placeholder="Dispute title"
              className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <textarea
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              rows={3}
              placeholder="Describe the issue in detail..."
              className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y transition-colors"
            />
            {disputeError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {disputeError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDispute(false);
                  setDisputeError(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => disputeMutation.mutate()}
                disabled={!disputeTitle.trim() || !disputeDesc.trim() || disputeMutation.isPending}
                className="px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {disputeMutation.isPending ? "Submitting…" : "Submit Dispute"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar — Actions & Parties (1/3) */}
      <div className="space-y-5">

        {/* Quick Actions Card */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Actions</h2>

          {canComplete && (
            confirmAction === "complete" ? (
              // Confirm completion inline
              <div className="p-3 bg-success/5 border border-success/20 rounded-xl space-y-2.5">
                <p className="text-xs font-semibold text-foreground">Confirm completion?</p>
                <p className="text-[11px] text-muted-foreground">This marks the contract as completed and opens the review form.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="flex-1 px-3 py-2 text-xs font-semibold bg-success text-success-foreground rounded-lg hover:bg-success/90 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {completeMutation.isPending ? "Completing…" : "Yes, Complete"}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("complete")}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-success text-success-foreground rounded-xl hover:bg-success/90 transition-all shadow-xs cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark Complete
              </button>
            )
          )}

          {canCancel && (
            confirmAction === "cancel" ? (
              // Confirm cancellation inline
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl space-y-2.5">
                <p className="text-xs font-semibold text-foreground">Cancel this contract?</p>
                <p className="text-[11px] text-muted-foreground">This action cannot be undone. The contract will be permanently cancelled.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    className="flex-1 px-3 py-2 text-xs font-semibold bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {cancelMutation.isPending ? "Cancelling…" : "Yes, Cancel"}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted transition-all cursor-pointer"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("cancel")}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-destructive/40 text-destructive bg-card rounded-xl hover:bg-destructive/5 transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel Contract
              </button>
            )
          )}

          {!showDispute && contract.status === "ACTIVE" && (
            <button
              onClick={() => setShowDispute(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-border text-muted-foreground bg-card rounded-xl hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Open Dispute
            </button>
          )}
        </div>

        {/* Parties Card */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contract Parties</h2>
          <div className="space-y-3.5">
            {/* Client party */}
            <div className="flex items-center gap-3">
              {/* neutral avatar keeps identity stable without inventing a name */}
              <ParticipantAvatar id={contract.client_id} size="sm" className="ring-2 ring-background" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {participantLabel("Client", contract.client_id)}
                  {isClient && (
                    <span className="text-[10px] font-semibold text-primary ml-1.5">(You)</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">Project Owner</p>
              </div>
            </div>
            {/* Freelancer party */}
            <div className="flex items-center gap-3">
              {/* neutral avatar keeps identity stable without inventing a name */}
              <ParticipantAvatar id={contract.freelancer_id} size="sm" className="ring-2 ring-background" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {participantLabel("Freelancer", contract.freelancer_id)}
                  {!isClient && (
                    <span className="text-[10px] font-semibold text-primary ml-1.5">(You)</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">Service Provider</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Card */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Navigation</h2>
          <Link
            href="/contracts"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-border bg-card text-foreground rounded-xl hover:bg-muted transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All Contracts
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------- Tasks Tab ----------

function TasksTab({
  contractId,
  isActive,
}: {
  contractId: string;
  isActive: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery(contractTasksOptions(contractId));

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: TaskCreateRequest) => createTask(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byContract(contractId) });
      setNewTitle("");
      setNewDesc("");
      setShowCreateForm(false);
    },
  });

  // Optimistic update for task status transitions (task IDs are UUID strings)
  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: TaskUpdateRequest }) =>
      updateTask(taskId, data),
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.byContract(contractId) });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.byContract(contractId));
      queryClient.setQueryData<Task[]>(taskKeys.byContract(contractId), (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, ...data } : t)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.byContract(contractId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byContract(contractId) });
    },
  });

  // Delete task mutation (task IDs are UUID strings)
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byContract(contractId) });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate({ title: newTitle.trim(), description: newDesc.trim() || undefined });
  };

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div className="space-y-6">
      {/* Create Task Area */}
      {isActive && (
        <div>
          {showCreateForm ? (
            <form onSubmit={handleCreate} className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-foreground">Create New Task</h3>
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTitle("");
                    setNewDesc("");
                  }}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground border border-border rounded-xl hover:bg-muted transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || createMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {createMutation.isPending ? "Adding…" : "Add Task"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </button>
          )}
        </div>
      )}

      {/* Three-column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TASK_COLUMNS.map((col) => {
          const colTasks = tasksByStatus(col.status);
          return (
            <div key={col.status} className="space-y-3">
              {/* Column Header */}
              <div className="flex items-center gap-2 px-1 pb-2 border-b border-border/50">
                <svg className={`h-4 w-4 ${col.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={col.iconPath} />
                </svg>
                <h3 className="text-sm font-bold text-foreground">{col.label}</h3>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                  {colTasks.length}
                </span>
              </div>
              {/* Task Cards */}
              <div className="space-y-2.5 min-h-[80px]">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isActive={isActive}
                    onStatusChange={(status) =>
                      updateMutation.mutate({ taskId: task.id, data: { status } })
                    }
                    onDelete={() => deleteMutation.mutate(task.id)}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/60">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  isActive,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  isActive: boolean;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Define forward and backward status transitions
  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    TODO: "IN_PROGRESS",
    IN_PROGRESS: "DONE",
    DONE: null,
  };
  const prevStatus: Record<TaskStatus, TaskStatus | null> = {
    TODO: null,
    IN_PROGRESS: "TODO",
    DONE: "IN_PROGRESS",
  };

  const next = nextStatus[task.status];
  const prev = prevStatus[task.status];

  // Human-readable transition labels
  const nextLabel: Record<TaskStatus, string> = {
    TODO: "Start",
    IN_PROGRESS: "Complete",
    DONE: "",
  };
  const prevLabel: Record<TaskStatus, string> = {
    TODO: "",
    IN_PROGRESS: "Move Back",
    DONE: "Reopen",
  };

  return (
    <div className="bg-card rounded-xl border border-border p-3.5 shadow-xs hover:shadow-sm transition-shadow group">
      <p className="text-sm font-semibold text-foreground mb-1 leading-snug">{task.title}</p>
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
          {task.description}
        </p>
      )}
      {/* Task creation time */}
      <p className="text-[10px] text-muted-foreground/60 mb-2">
        {formatRelativeTime(task.created_at)}
      </p>

      {isActive && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Forward transition button */}
          {next && (
            <button
              onClick={() => onStatusChange(next)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {nextLabel[task.status]}
            </button>
          )}
          {/* Backward transition button */}
          {prev && (
            <button
              onClick={() => onStatusChange(prev)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {prevLabel[task.status]}
            </button>
          )}
          {/* Delete with confirmation */}
          {showConfirmDelete ? (
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={onDelete}
                className="text-[10px] font-semibold text-destructive hover:bg-destructive/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="text-[10px] font-semibold text-muted-foreground hover:bg-muted px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="text-[11px] text-muted-foreground/60 hover:text-destructive ml-auto opacity-0 group-hover:opacity-100 transition-all px-1.5 py-1 rounded-lg cursor-pointer"
              title="Delete task"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Deliverables Tab ----------

function DeliverablesTab({
  contractId,
  isActive,
  isClient,
}: {
  contractId: string;
  isActive: boolean;
  isClient: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: deliverables = [] } = useQuery(contractDeliverablesOptions(contractId));

  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  // which deliverable (by UUID) is currently in "request revision" mode, if any
  const [revisionNotes, setRevisionNotes] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");

  // Submit deliverable (freelancer)
  const submitMutation = useMutation({
    mutationFn: (data: DeliverableSubmitRequest) =>
      submitDeliverable(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.byContract(contractId) });
      setMessage("");
      setFileUrl("");
    },
  });

  // Approve deliverable (client) — deliverable IDs are UUID strings
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveDeliverable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.byContract(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });

  // Request revision (client) — deliverable IDs are UUID strings
  const revisionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeliverableRevisionRequest }) =>
      requestRevision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.byContract(contractId) });
      setRevisionNotes(null);
      setRevisionText("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    submitMutation.mutate({
      message: message.trim(),
      file_url: fileUrl.trim() || undefined,
    });
  };

  const latestDeliverable = deliverables.length > 0 ? deliverables[0] : null;
  const canSubmit = isActive && !isClient && (!latestDeliverable || latestDeliverable.status === "APPROVED" || latestDeliverable.status === "REVISION_REQUESTED");
  const canReview = isActive && isClient && latestDeliverable?.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      {/* Submit Deliverable Form (Freelancer) */}
      {canSubmit && (
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Submit a Deliverable</h3>
              <p className="text-[11px] text-muted-foreground">Describe what you&apos;ve completed and attach a file URL if available.</p>
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Describe what you've delivered..."
            className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y transition-colors"
          />
          <input
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="File URL (optional)"
            className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!message.trim() || submitMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit Deliverable"
              )}
            </button>
          </div>
        </form>
      )}

      {/* Client Review Actions for Latest Deliverable */}
      {canReview && latestDeliverable && revisionNotes === latestDeliverable.id && (
        <div className="bg-card rounded-2xl border border-warning/20 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-warning/10 text-warning rounded-lg flex items-center justify-center shrink-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Request Revision</h3>
              <p className="text-[11px] text-muted-foreground">Explain what needs to be changed or improved.</p>
            </div>
          </div>
          <textarea
            value={revisionText}
            onChange={(e) => setRevisionText(e.target.value)}
            rows={3}
            placeholder="Describe what needs to be changed..."
            className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y transition-colors"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setRevisionNotes(null);
                setRevisionText("");
              }}
              className="px-4 py-2 text-sm font-semibold text-muted-foreground border border-border rounded-xl hover:bg-muted transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!latestDeliverable || !revisionText.trim()) return;
                revisionMutation.mutate({
                  id: latestDeliverable.id,
                  data: { revision_notes: revisionText.trim() },
                });
              }}
              disabled={!revisionText.trim() || revisionMutation.isPending}
              className="px-4 py-2 text-sm font-semibold bg-warning text-warning-foreground rounded-xl hover:bg-warning/90 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {revisionMutation.isPending ? "Submitting…" : "Request Revision"}
            </button>
          </div>
        </div>
      )}

      {/* Deliverables Timeline List */}
      {deliverables.length > 0 ? (
        <div className="space-y-4">
          {deliverables.map((d, idx) => {
            const isLatest = idx === 0;
            return (
              <div
                key={d.id}
                className={`bg-card rounded-2xl border p-5 shadow-xs transition-all ${
                  isLatest ? "border-primary/30" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Version header */}
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Version {d.version_number}
                      </span>
                      <StatusBadge status={d.status} />
                      {isLatest && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                          Latest
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatRelativeTime(d.created_at)}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                      {d.message}
                    </p>

                    {/* File URL */}
                    {d.file_url && (
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-2"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Attached File
                      </a>
                    )}

                    {/* Revision Notes */}
                    {d.revision_notes && (
                      <div className="mt-3 p-3 bg-warning/5 border border-warning/20 rounded-xl">
                        <p className="text-[11px] font-semibold text-warning mb-1 flex items-center gap-1.5">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Revision Requested
                        </p>
                        <p className="text-xs text-foreground/80">{d.revision_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Client Review Action Buttons */}
                  {canReview && d.id === latestDeliverable?.id && revisionNotes !== d.id && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => approveMutation.mutate(d.id)}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-success text-success-foreground rounded-xl hover:bg-success/90 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {approveMutation.isPending ? "Approving…" : "Approve"}
                      </button>
                      <button
                        onClick={() => setRevisionNotes(d.id)}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-2 text-warning border border-warning/40 rounded-xl hover:bg-warning/5 transition-colors cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Revision
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-6 bg-card rounded-2xl border border-border shadow-xs max-w-md mx-auto">
          <div className="h-14 w-14 bg-muted text-muted-foreground rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-foreground">No deliverables yet</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
            {isClient
              ? "The freelancer hasn't submitted any deliverables yet."
              : "Submit your first deliverable when your work is ready for review."}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Review Modal ----------

function ReviewModal({
  contractId,
  onClose,
}: {
  contractId: string;
  onClose: () => void;
}) {
  const [overall, setOverall] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [quality, setQuality] = useState(0);
  const [timeliness, setTimeliness] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data: ReviewCreateRequest) => createReview(data),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: ApiError) => {
      setError(err.message || "Failed to submit review.");
    },
  });

  const handleSubmit = () => {
    if (overall === 0) {
      setError("Please select an overall rating.");
      return;
    }
    setError(null);
    submitMutation.mutate({
      contract_id: contractId,
      rating_overall: overall,
      rating_communication: communication || null,
      rating_quality: quality || null,
      rating_timeliness: timeliness || null,
      comment: comment.trim(),
    });
  };

  // Success confirmation state
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full text-center shadow-xl">
          <div className="h-14 w-14 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-bold text-foreground mb-2">Review Submitted!</p>
          <p className="text-sm text-muted-foreground mb-6">
            Thank you for your feedback. It helps build trust on the platform.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Leave a Review</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Rate your experience with the other party.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-t border-border/50" />

        {/* Star Ratings */}
        <StarRating
          label="Overall"
          value={overall}
          onChange={setOverall}
          required
        />
        <StarRating
          label="Communication"
          value={communication}
          onChange={setCommunication}
        />
        <StarRating
          label="Quality of work"
          value={quality}
          onChange={setQuality}
        />
        <StarRating
          label="Timeliness"
          value={timeliness}
          onChange={setTimeliness}
        />

        <div className="border-t border-border/50" />

        {/* Comment */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share your experience..."
            className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y transition-colors"
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-muted-foreground border border-border rounded-xl hover:bg-muted transition-all cursor-pointer"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={overall === 0 || submitMutation.isPending}
            className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Star Rating Component ----------

function StarRating({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="text-2xl leading-none transition-transform hover:scale-110 cursor-pointer p-0.5"
          >
            <span
              className={
                star <= (hover || value)
                  ? "text-yellow-500"
                  : "text-muted-foreground/20"
              }
            >
              ★
            </span>
          </button>
        ))}
        {value > 0 && (
          <span className="text-xs font-semibold text-muted-foreground ml-2">
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
}
