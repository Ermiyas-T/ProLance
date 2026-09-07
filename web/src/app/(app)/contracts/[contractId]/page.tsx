"use client";

// Contract workspace with tabs — Overview, Tasks, Deliverables
// (Architecture.md §4). Review modal opens after completion.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatMoney, formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import type { Contract, Task, Deliverable, TaskStatus } from "@/types/entities";

type Tab = "overview" | "tasks" | "deliverables";

const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];

export default function ContractWorkspacePage() {
  const params = useParams();
  const contractId = Number(params.contractId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showReview, setShowReview] = useState(false);

  const { data: contract, isLoading: contractLoading } = useQuery(
    contractDetailOptions(contractId),
  );

  if (contractLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-48 bg-muted rounded-lg animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">Contract not found.</p>
            <Link href="/contracts" className="mt-3 inline-block text-sm text-foreground font-medium hover:underline">
              Back to contracts
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isClient = user.id === contract.client_id;
  const isActive = contract.status === "ACTIVE";

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Contract #{contract.id}</h1>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Project #{contract.project_id} · Due {formatDate(contract.deadline)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-foreground">
              {formatMoney(contract.agreed_price)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(["overview", "tasks", "deliverables"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
          otherPartyId={isClient ? contract.freelancer_id : contract.client_id}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}

// --- Overview Tab ---

function OverviewTab({
  contract,
  isClient,
  contractId,
  onComplete,
}: {
  contract: Contract;
  isClient: boolean;
  contractId: number;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [showDispute, setShowDispute] = useState(false);
  const [disputeTitle, setDisputeTitle] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const completeMutation = useMutation({
    mutationFn: () => completeContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
      onComplete();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
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
    <div className="space-y-6">
      {/* Parties */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Parties</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="text-sm font-medium text-foreground">User #{contract.client_id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Freelancer</p>
            <p className="text-sm font-medium text-foreground">User #{contract.freelancer_id}</p>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Original terms</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Agreed price</p>
            <p className="text-sm font-medium text-foreground">
              {formatMoney(contract.agreed_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deadline</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(contract.deadline)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <StatusBadge status={contract.status} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {canComplete && (
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {completeMutation.isPending ? "Completing…" : "Mark complete"}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-sm font-medium border border-destructive text-destructive rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel contract"}
            </button>
          )}
          {!showDispute && (
            <button
              onClick={() => setShowDispute(true)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Open dispute
            </button>
          )}
        </div>

        {/* Dispute form */}
        {showDispute && (
          <div className="mt-4 p-4 bg-secondary/50 rounded-lg space-y-3">
            <p className="text-sm font-medium text-foreground">Open a dispute</p>
            <input
              type="text"
              value={disputeTitle}
              onChange={(e) => setDisputeTitle(e.target.value)}
              placeholder="Dispute title"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <textarea
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              rows={3}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
            {disputeError && (
              <p className="text-xs text-destructive">{disputeError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDispute(false);
                  setDisputeError(null);
                }}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => disputeMutation.mutate()}
                disabled={!disputeTitle.trim() || !disputeDesc.trim() || disputeMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {disputeMutation.isPending ? "Submitting…" : "Submit dispute"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tasks Tab ---

function TasksTab({
  contractId,
  isActive,
}: {
  contractId: number;
  isActive: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery(contractTasksOptions(contractId));

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: TaskCreateRequest) => createTask(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byContract(contractId) });
      setNewTitle("");
      setNewDesc("");
    },
  });

  // Optimistic update for task status
  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: TaskUpdateRequest }) =>
      updateTask(taskId, data),
    onMutate: async ({ taskId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.byContract(contractId) });
      // Snapshot previous value
      const previous = queryClient.getQueryData<Task[]>(taskKeys.byContract(contractId));
      // Optimistically update
      queryClient.setQueryData<Task[]>(taskKeys.byContract(contractId), (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, ...data } : t)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.byContract(contractId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byContract(contractId) });
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(taskId),
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
      {/* Create task form */}
      {isActive && (
        <form onSubmit={handleCreate} className="bg-card rounded-lg border border-border p-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding…" : "Add task"}
          </button>
        </form>
      )}

      {/* Three-column board */}
      <div className="grid grid-cols-3 gap-4">
        {TASK_COLUMNS.map((col) => (
          <div key={col.status} className="space-y-2">
            <h3 className="text-sm font-medium text-foreground mb-2">
              {col.label} ({tasksByStatus(col.status).length})
            </h3>
            {tasksByStatus(col.status).map((task) => (
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
            {tasksByStatus(col.status).length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4 bg-secondary/30 rounded-lg">
                No tasks
              </div>
            )}
          </div>
        ))}
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
  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    TODO: "IN_PROGRESS",
    IN_PROGRESS: "DONE",
    DONE: null,
  };

  const next = nextStatus[task.status];

  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground mb-1">{task.title}</p>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {task.description}
        </p>
      )}
      {isActive && (
        <div className="flex items-center gap-2">
          {next && (
            <button
              onClick={() => onStatusChange(next)}
              className="text-xs text-primary hover:underline"
            >
              → {next.replace("_", " ")}
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs text-muted-foreground hover:text-destructive ml-auto"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// --- Deliverables Tab ---

function DeliverablesTab({
  contractId,
  isActive,
  isClient,
}: {
  contractId: number;
  isActive: boolean;
  isClient: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: deliverables = [] } = useQuery(contractDeliverablesOptions(contractId));

  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [revisionNotes, setRevisionNotes] = useState<number | null>(null);
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

  // Approve deliverable (client)
  const approveMutation = useMutation({
    mutationFn: (id: number) => approveDeliverable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.byContract(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });

  // Request revision (client)
  const revisionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DeliverableRevisionRequest }) =>
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
      {/* Submit form (freelancer) */}
      {canSubmit && (
        <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Submit deliverable</h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Describe what you've delivered..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          />
          <input
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="File URL (optional)"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!message.trim() || submitMutation.isPending}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit deliverable"}
          </button>
        </form>
      )}

      {/* Revision form (client) */}
      {canReview && revisionNotes === latestDeliverable?.id && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Request revision</h3>
          <textarea
            value={revisionText}
            onChange={(e) => setRevisionText(e.target.value)}
            rows={3}
            placeholder="Describe what needs to be changed..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setRevisionNotes(null);
                setRevisionText("");
              }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
              className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {revisionMutation.isPending ? "Submitting…" : "Request revision"}
            </button>
          </div>
        </div>
      )}

      {/* Deliverables list */}
      <div className="space-y-3">
        {deliverables.map((d) => (
          <div key={d.id} className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">
                    Version {d.version_number}
                  </span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-xs text-muted-foreground">{d.message}</p>
                {d.file_url && (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    View file →
                  </a>
                )}
                {d.revision_notes && (
                  <p className="text-xs text-amber-600 mt-1">
                    Revision notes: {d.revision_notes}
                  </p>
                )}
              </div>
              {/* Client review actions */}
              {canReview && d.id === latestDeliverable?.id && (
                <div className="flex gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => approveMutation.mutate(d.id)}
                    disabled={approveMutation.isPending}
                    className="text-xs font-medium px-3 py-1.5 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {approveMutation.isPending ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => setRevisionNotes(d.id)}
                    className="text-xs font-medium px-3 py-1.5 text-amber-600 border border-amber-600 rounded-lg hover:bg-amber-600/10 transition-colors"
                  >
                    Revision
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {deliverables.length === 0 && (
          <div className="text-center py-8 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">No deliverables yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Review Modal ---

function ReviewModal({
  contractId,
  otherPartyId,
  onClose,
}: {
  contractId: number;
  otherPartyId: number;
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

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-lg border border-border p-6 max-w-sm w-full mx-4 text-center">
          <p className="text-lg font-medium text-foreground mb-2">Review submitted</p>
          <p className="text-sm text-muted-foreground mb-4">
            Thank you for your feedback.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg border border-border p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Leave a review</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Rate your experience with the other party.
        </p>

        {/* Overall rating */}
        <StarRating
          label="Overall"
          value={overall}
          onChange={setOverall}
          required
        />

        {/* Dimension ratings */}
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

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share your experience..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={overall === 0 || submitMutation.isPending}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Star Rating Component ---

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
      <label className="block text-sm font-medium text-foreground mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="text-2xl leading-none transition-colors"
          >
            <span
              className={
                star <= (hover || value)
                  ? "text-yellow-500"
                  : "text-muted-foreground/30"
              }
            >
              ★
            </span>
          </button>
        ))}
        {value > 0 && (
          <span className="text-sm text-muted-foreground ml-2 self-center">
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
}
