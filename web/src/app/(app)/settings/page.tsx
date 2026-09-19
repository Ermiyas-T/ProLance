"use client";

// Settings — account overview. The backend (V1) exposes no account-mutation
// endpoints (email/password change, deletion), so this page is read-only:
// identity from /auth/me, a link to /profile for editable details, and
// sign-out. No fake controls (Architecture.md §1.1).

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "@/app/providers";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useSession();

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Main content */}
      <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your account details.
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Full name</span>
            <span className="text-sm text-foreground font-medium">{user.full_name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm text-foreground font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-sm text-foreground font-medium">{user.role}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm text-foreground font-medium">
              {user.created_at.slice(0, 10)}
            </span>
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/profile"
            className="text-sm text-primary hover:underline w-fit"
          >
            Edit profile details →
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 dark:text-red-400 hover:underline w-fit"
          >
            Log out of this account
          </button>
        </div>
      </main>
    </div>
  );
}
