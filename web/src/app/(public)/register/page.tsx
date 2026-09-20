"use client";

// Register page — public route. Role (CLIENT | FREELANCER), full_name, email,
// password. POST /auth/register, then auto-login. No verify-email page.
// Redirect to /dashboard if already authenticated (Architecture.md §4).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { register as apiRegister } from "@/features/auth/api";
import { useSession } from "@/app/providers";
import { ApiError } from "@/lib/api-client";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PasswordInput } from "@/components/shared/password-input";
import type { Role } from "@/types/entities";

export default function RegisterPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useSession();

  const [role, setRole] = useState<Extract<Role, "CLIENT" | "FREELANCER">>("FREELANCER");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // redirect authenticated users away to /dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRegister({ full_name: fullName, email, password, role });
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="text-lg font-bold text-foreground hover:opacity-80 transition-opacity">
          ProLance
        </Link>
        <ThemeToggle />
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-card text-card-foreground rounded-xl shadow-lg border border-border p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Join ProLance and start your journey
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  I want to…
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("FREELANCER")}
                    className={`relative flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all ${
                      role === "FREELANCER"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    {role === "FREELANCER" && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <span className="text-sm font-medium">Find work</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("CLIENT")}
                    className={`relative flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all ${
                      role === "CLIENT"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    {role === "CLIENT" && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <span className="text-sm font-medium">Hire talent</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  {role === "FREELANCER"
                    ? "Browse projects and submit proposals"
                    : "Post projects and hire freelancers"}
                </p>
              </div>

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-1.5">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm
                    text-foreground placeholder:text-muted-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                    transition-colors"
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm
                    text-foreground placeholder:text-muted-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                    transition-colors"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <PasswordInput
                id="password"
                label="Password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm
                  text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                  transition-colors"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium
                  hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          </div>

          {/* Footer link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground font-medium hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
