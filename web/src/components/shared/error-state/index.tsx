// Shared error-state component with optional retry callback (Architecture.md §2).

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-medium text-foreground">{title}</p>
      {message && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
