// Shared status badge for every entity lifecycle label (Architecture.md §2).
// Maps status enum values to consistent color tokens.

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Project statuses
  DRAFT: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400",
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  // Proposal statuses
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACCEPTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  WITHDRAWN: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400",
  // Contract statuses
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DELIVERED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  // Task statuses
  TODO: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  // Deliverable statuses
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REVISION_REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  // Dispute statuses
  OPEN_DISPUTE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

// Human-readable label for status values
function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const styles =
    STATUS_STYLES[status] ??
    "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${styles} ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}
