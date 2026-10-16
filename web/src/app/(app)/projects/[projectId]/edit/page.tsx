"use client";

// Client edit-project form (Architecture.md §4).
// Edits are only permitted while project is in DRAFT status. Non-DRAFT states are presented read-only.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { clientProjectDetailOptions, projectKeys } from "@/features/projects/queries";
import { updateProject } from "@/features/projects/api";
import { skillsOptions } from "@/features/profiles/queries";
import { ApiError } from "@/lib/api-client";
import { isUuid } from "@/lib/identity";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Project, Skill } from "@/types/entities";

const CURRENCIES = ["ETB", "USD", "EUR", "GBP", "CAD", "AUD"];

export default function EditProjectPage() {
  const params = useParams<{ projectId: string }>();
  // route segments carry UUID strings, so never coerce them with Number()
  const projectId = params.projectId ?? "";
  const { user } = useSession();

  // fetch project details for this client
  const { data: project, isLoading: projectLoading } = useQuery(
    clientProjectDetailOptions(projectId),
  );

  // reuse the shared skills query key so the profile and project forms share one cache entry
  const { data: skills = [] } = useQuery(skillsOptions);

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  // reject malformed project URLs instead of querying the API with an invalid UUID
  if (!isUuid(projectId)) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-2xl border border-border p-8">
            <p className="text-muted-foreground">This project link is not valid.</p>
            <Link href="/projects" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              ← Back to My Projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // loading skeleton
  if (projectLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
          <div className="space-y-4 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  // not found placeholder
  if (!project) {
    return (
      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
          <div className="text-center py-12 bg-card rounded-2xl border border-border p-8">
            <p className="text-muted-foreground">Project not found or you do not have permission to view it.</p>
            <Link href="/projects" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              ← Back to My Projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
        {/* Navigation back link */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-3 group"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Project Details
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit project brief</h1>
            <StatusBadge status={project.status} domain="project" />
          </div>
        </div>

        {/* Read-only notification if project is no longer in DRAFT */}
        {project.status !== "DRAFT" ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-800 dark:text-amber-300">
            <h2 className="font-semibold text-base mb-1">Project is locked for edits</h2>
            <p className="leading-relaxed">
              This project is currently <span className="font-bold">{project.status}</span>. In accordance with platform integrity rules, only projects in <strong>DRAFT</strong> status can be edited.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 text-white px-4 py-2 text-xs font-semibold hover:bg-amber-700 transition-colors"
              >
                View Project Details
              </Link>
              <Link
                href="/projects"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                My Projects Hub
              </Link>
            </div>
          </div>
        ) : (
          <EditProjectForm key={project.id} project={project} projectId={projectId} skills={skills} />
        )}
      </main>
    </div>
  );
}

// ─── Subcomponent Form (Initialized cleanly from props without useEffect cascades) ──────

function EditProjectForm({
  project,
  projectId,
  skills,
}: {
  project: Project;
  projectId: string;
  skills: Skill[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Convert ISO date to datetime-local format for input
  const initialDeadline = (() => {
    try {
      const d = new Date(project.deadline);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return "";
    }
  })();

  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [budget, setBudget] = useState(project.budget);
  const [currency, setCurrency] = useState(project.currency || "ETB");
  const [deadline, setDeadline] = useState(initialDeadline);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>(
    project.skills.map((s) => s.id),
  );
  const [error, setError] = useState<string | null>(null);

  // update mutation handler
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
      setError(err.message || "Failed to update project. Please check your inputs.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // guard: required inputs
    if (!title.trim() || !description.trim() || !budget.trim() || !deadline) {
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
      setError("Please enter a valid deadline date.");
      return;
    }

    // trigger mutation
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
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId],
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-card rounded-2xl border border-border p-6 shadow-xs">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-foreground mb-1.5">
          Project Title <span className="text-destructive">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          placeholder="e.g. Modern E-Commerce Web App"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-semibold text-foreground mb-1.5">
          Project Description <span className="text-destructive">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y min-h-[140px] transition-colors leading-relaxed"
          placeholder="Provide detailed project requirements, deliverables, and expectations..."
        />
      </div>

      {/* Budget & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="budget" className="block text-sm font-semibold text-foreground mb-1.5">
            Budget <span className="text-destructive">*</span>
          </label>
          <input
            id="budget"
            type="number"
            min="0.01"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-semibold text-foreground mb-1.5">
            Currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label htmlFor="deadline" className="block text-sm font-semibold text-foreground mb-1.5">
          Deadline <span className="text-destructive">*</span>
        </label>
        <input
          id="deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>

      {/* Skills Picker */}
      {skills.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Required Skills
          </label>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                  selectedSkillIds.includes(skill.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                }`}
              >
                {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20">
          {error}
        </div>
      )}

      {/* Form Submit Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
        <Link
          href={`/projects/${projectId}`}
          className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? "Saving changes…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
