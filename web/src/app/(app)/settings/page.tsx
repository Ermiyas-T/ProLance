"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "@/app/providers";
import { apiFetch, ApiError } from "@/lib/api-client";
import { PasswordInput } from "@/components/shared/password-input";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useSession();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Account deactivation state
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      await apiFetch<void>("/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.detail);
      } else {
        setPasswordError("Failed to update password. Please try again.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeactivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeactivateError(null);

    if (!deactivatePassword) {
      setDeactivateError("Please enter your password to confirm deactivation.");
      return;
    }

    setIsDeactivating(true);

    try {
      await apiFetch<void>("/auth/me/deactivate", {
        method: "POST",
        body: JSON.stringify({
          password: deactivatePassword,
        }),
      });

      logout();
      router.push("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        setDeactivateError(err.detail);
      } else {
        setDeactivateError("Failed to deactivate account. Please try again.");
      }
      setIsDeactivating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your account overview, security credentials, and preferences.
          </p>
        </div>

        {/* Account Overview Card */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Account Information</h2>
            <Link
              href="/profile"
              className="text-xs text-primary font-medium hover:underline"
            >
              Edit Profile Details →
            </Link>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border bg-muted/30">
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
          </div>
        </section>

        {/* Security Section: Change Password */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">Password & Security</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Update your account password. Use at least 8 characters with a mix of letters and numbers.
          </p>

          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <PasswordInput
              label="Current Password"
              labelClassName="block text-xs font-medium text-muted-foreground mb-1"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordInput
                label="New Password"
                labelClassName="block text-xs font-medium text-muted-foreground mb-1"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <PasswordInput
                label="Confirm New Password"
                labelClassName="block text-xs font-medium text-muted-foreground mb-1"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* Danger Zone: Account Deactivation */}
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h12a6 6 0 00-6-6zM21 12h-6" />
            </svg>
            <h2 className="text-lg font-semibold">Account Deactivation</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Deactivating your account will disable your active session and restrict account access.
          </p>

          {!showDeactivateConfirm ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(true)}
                className="inline-flex items-center justify-center rounded-md border border-destructive/50 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                Deactivate Account...
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeactivateAccount} className="space-y-4 pt-2 border-t border-destructive/20">
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  Are you sure you want to deactivate your account? Enter your password below to confirm this action.
                </span>
              </div>

              {deactivateError && (
                <p className="text-xs text-destructive font-medium">{deactivateError}</p>
              )}

              <PasswordInput
                label="Confirm Password"
                labelClassName="block text-xs font-medium text-muted-foreground mb-1"
                required
                value={deactivatePassword}
                onChange={(e) => setDeactivatePassword(e.target.value)}
                placeholder="Enter your current password"
                autoComplete="current-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
              />

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isDeactivating}
                  className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeactivateConfirm(false);
                    setDeactivatePassword("");
                    setDeactivateError(null);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Session Actions */}
        <div className="flex justify-start">
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Log out of session
          </button>
        </div>
      </main>
    </div>
  );
}
