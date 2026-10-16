// Shared status badge for every entity lifecycle label (Architecture.md §2).
// Maps status enum values to consistent color tokens with optional domain specialization.

export interface StatusBadgeProps {
  status: string;
  domain?: "project" | "proposal" | "contract" | "task" | "deliverable" | "dispute";
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Project statuses
  DRAFT: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border border-neutral-500/20",
  OPEN: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
  IN_PROGRESS: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  // Proposal statuses
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  ACCEPTED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  WITHDRAWN: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border border-neutral-500/20",
  // Contract statuses
  ACTIVE: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
  DELIVERED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  // Task statuses
  TODO: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border border-neutral-500/20",
  DONE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  // Deliverable statuses
  SUBMITTED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  REVISION_REQUESTED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  // Dispute statuses
  OPEN_DISPUTE: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
};

// Domain-specific status overrides for overlapping status names
const DOMAIN_OVERRIDES: Record<string, Record<string, string>> = {
  dispute: {
    OPEN: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
    UNDER_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    RESOLVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  },
};

// Human-readable label for status values
function formatStatus(status: string): string {
  // convert SNAKE_CASE to Title Case for display
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, domain, className = "" }: StatusBadgeProps) {
  // resolve style from domain overrides if provided, otherwise default to global status map
  const overrideStyle = domain ? DOMAIN_OVERRIDES[domain]?.[status] : undefined;
  const styles =
    overrideStyle ??
    STATUS_STYLES[status] ??
    "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border border-neutral-500/20";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${styles} ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}
