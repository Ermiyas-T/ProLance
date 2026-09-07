"use client";

// Client create-project form (Architecture.md §4).
// Save draft (POST /projects) then optional POST /projects/{id}/publish.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { createProject, publishProject } from "@/features/projects/api";
import { projectKeys } from "@/features/projects/queries";
import { fetchSkills } from "@/features/profiles/api";
import { ApiError } from "@/lib/api-client";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated || !user) {
    router.replace("/login");
    return null;
  }

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

  // Step 1: Create the draft
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (project) => {
      setError(null);
      // Invalidate client projects cache
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
      // Navigate to the project detail page
      router.push(`/projects/${project.id}`);
    },
    onError: (err: ApiError) => {
      setError(err.message || "Failed to create project. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!title.trim() || !description.trim() || !budget || !deadline) {
      setError("Please fill in all required fields.");
      return;
    }

    const budgetNum = parseFloat(budget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setError("Budget must be a positive number.");
      return;
    }

    // Convert local datetime to ISO string with timezone
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      setError("Please enter a valid deadline.");
      return;
    }

    createMutation.mutate({
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
          <h1 className="text-2xl font-bold text-foreground">Create a project</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Describe what you need done. You can save a draft and publish later.
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
              placeholder="e.g. Build a responsive landing page"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
              placeholder="Describe the project requirements, deliverables, and any relevant details..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
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
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
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
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
                    onClick={() => toggleSkill(skill.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedSkillIds.includes(skill.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
              {selectedSkillIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {selectedSkillIds.length} skill{selectedSkillIds.length !== 1 ? "s" : ""} selected
                </p>
              )}
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
              href="/projects"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : "Save draft"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
