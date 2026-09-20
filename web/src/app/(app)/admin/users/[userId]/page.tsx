"use client";

// Admin single user detail view — shows user identity and Stage 11 moderation notice
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId;

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {/* Navigation header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">User detail</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">User #{userId}</h1>
          </div>
          <Link
            href="/admin/users"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to users
          </Link>
        </div>

        {/* User Detail Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
              #{userId}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">User Account #{userId}</h2>
              <p className="text-sm text-muted-foreground">Detailed account profile inspection</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Account moderation actions (suspend, restore, audit profile) are scheduled in Stage 11 of the API blueprint.
          </div>
        </div>
      </main>
    </div>
  );
}
