"use client";

// Client edit-project form (Architecture.md §4).
// Same fields as create; 409-handle when the service forbids edits (non-DRAFT).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectDetailOptions } from "@/features/projects/queries";
import { updateProject } from "@/features/projects/api";
import { projectKeys } from "@/features/projects/queries";
import { fetchSkills } from "@/features/profiles/api";
import { ApiError } from "@/lib/api-client";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

export default function EditProjectPage() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

  const { data: project, isLoading: projectLoading } = useQuery(
    clientProjectDetailOptions(projectId),
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [deadline, setDeadline] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: skills = [] } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  // Populate form when project loads
  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDescription(project.description);
      setBudget(project.budget);
      setCurrency(project.currency);
      // Convert ISO date to datetime-local input format
      const d = new Date(project.deadline);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDeadline(local);
      setSelectedSkillIds(project.skills.map((s) => s.id));
    }
  }, [project]);

  // 409 — edit forbidden (non-DRAFT)
  const isReadOnly = project != null && project.status !== "DRAFT";

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProject>[1]) =>
      updateProject(projectId, data),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: projectKeys.clientDetail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
      router.push(`/projects/${projectId}`);
    },
    onError: (err: ApiError) => {
      setError(err.message || "Failed to update project. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim() || !budget || !deadline) {
      setError("Please fill in all required fields.");
      return;
    }

    const budgetNum = parseFloat(budget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setError("Budget must be a positive number.");
      return;
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      setError("Please enter a valid deadline.");
      return;
    }

    updateMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      budget: budgetNum.toFixed(2),
      currency,
      deadline: deadlineDate.toISOString(),
      skill_ids: selectedSkillIds,
    });
  };

  const toggleSkill = (skillId: number) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">ProLance</Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">Project not found.</p>
            <Link href="/projects" className="mt-3 inline-block text-sm text-foreground font-medium hover:underline">
              Back to projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

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

      <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Edit project</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isReadOnly
              ? "This project can no longer be edited (it has been published or is in progress)."
              : "Update your project details before publishing."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1.5">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={isReadOnly}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1.5">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              disabled={isReadOnly}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Budget + Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label htmlFor="budget" className="block text-sm font-medium text-foreground mb-1.5">
                Budget <span className="text-destructive">*</span>
              </label>
              <input
                id="budget"
                type="number"
                min="0.01"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-foreground mb-1.5">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-foreground mb-1.5">
              Deadline <span className="text-destructive">*</span>
            </label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => !isReadOnly && toggleSkill(skill.id)}
                    disabled={isReadOnly}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedSkillIds.includes(skill.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                    } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
