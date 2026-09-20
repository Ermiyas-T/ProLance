"use client";

// Client create-project form (Architecture.md §4).
// Save draft (POST /projects) then optional POST /projects/{id}/publish.
// Designed as a multi-section card form inspired by modern freelance platforms.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { createProject, publishProject } from "@/features/projects/api";
import { projectKeys } from "@/features/projects/queries";
import { fetchSkills } from "@/features/profiles/api";
import { ApiError } from "@/lib/api-client";

// Currency options with labels — ETB first as the default for the Ethiopian market
const CURRENCIES = [
  { code: "ETB", label: "ETB — Ethiopian Birr" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
];

const MAX_TITLE = 200;
const MAX_SKILLS = 10;

// Compute tomorrow's date string (YYYY-MM-DD) as the minimum selectable deadline
function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("ETB");
  const [deadline, setDeadline] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Track which action the user chose so we can branch in onSuccess
  const [pendingAction, setPendingAction] = useState<"draft" | "publish">(
    "draft",
  );

  const { data: skills = [] } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  // Filter skills by search term for large lists
  const filteredSkills = useMemo(() => {
    if (!skillSearch.trim()) return skills;
    const lower = skillSearch.toLowerCase();
    return skills.filter((s) => s.name.toLowerCase().includes(lower));
  }, [skills, skillSearch]);

  // Create draft, then optionally publish in sequence
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (project) => {
      setError(null);
      // If the user clicked "Publish Now", chain the publish call
      if (pendingAction === "publish") {
        try {
          await publishProject(project.id);
        } catch {
          // Draft was created successfully; publish failed — navigate anyway
        }
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.clients() });
      router.push(`/projects/${project.id}`);
    },
    onError: (err: ApiError) => {
      setError(err.message || "Failed to create project. Please try again.");
    },
  });

  // Hooks must be called before early returns (rules-of-hooks)
  if (!user) return null;

  // Compute form completion progress for the visual indicator
  const completedFields = [
    title.trim().length > 0,
    description.trim().length >= 30,
    parseFloat(budget) > 0,
    deadline.length > 0,
  ].filter(Boolean).length;
  const totalFields = 4;
  const progressPercent = Math.round((completedFields / totalFields) * 100);

  // Shared validation before both draft and publish
  const validate = (): boolean => {
    if (!title.trim()) {
      setError("Please add a project title.");
      return false;
    }
    if (!description.trim()) {
      setError("Please add a project description.");
      return false;
    }
    if (description.trim().length < 30) {
      setError(
        "Description is too short. Write at least 30 characters so freelancers understand your project.",
      );
      return false;
    }
    const budgetNum = parseFloat(budget);
    if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
      setError("Budget must be a positive number.");
      return false;
    }
    if (!deadline) {
      setError("Please select a project deadline.");
      return false;
    }
    // Convert date string to a Date and validate it's in the future
    const deadlineDate = new Date(deadline + "T23:59:59Z");
    if (isNaN(deadlineDate.getTime())) {
      setError("Please enter a valid deadline date.");
      return false;
    }
    if (deadlineDate <= new Date()) {
      setError("Deadline must be in the future.");
      return false;
    }
    return true;
  };

  const handleSubmit = (action: "draft" | "publish") => {
    setError(null);
    if (!validate()) return;

    setPendingAction(action);

    // Send deadline as end-of-day UTC ISO string (the backend expects AwareDatetime)
    const deadlineISO = new Date(deadline + "T23:59:59Z").toISOString();
    const budgetNum = parseFloat(budget);

    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      budget: budgetNum.toFixed(2),
      currency,
      deadline: deadlineISO,
      skill_ids: selectedSkillIds,
    });
  };

  const toggleSkill = (skillId: number) => {
    setSelectedSkillIds((prev) => {
      if (prev.includes(skillId)) return prev.filter((id) => id !== skillId);
      // Cap the number of skills to prevent cluttered project postings
      if (prev.length >= MAX_SKILLS) return prev;
      return [...prev, skillId];
    });
  };

  // Compute a human-friendly relative deadline label
  const deadlineLabel = useMemo(() => {
    if (!deadline) return null;
    const target = new Date(deadline + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return null;
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `${diffDays} days from now`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? "s" : ""} from now`;
    }
    const months = Math.floor(diffDays / 30);
    return `~${months} month${months > 1 ? "s" : ""} from now`;
  }, [deadline]);

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full">
        {/* Navigation & Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-4 group"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Projects
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Post a New Project
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
            A clear, detailed project brief attracts better proposals. Fill in
            each section below — you can save a draft and publish when ready.
          </p>

          {/* Progress indicator */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {completedFields} of {totalFields} sections
            </span>
          </div>
        </div>

        {/* Section 1: Project Details */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm mb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-sm font-bold">
              1
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Project Details
            </h2>
          </div>

          {/* Title */}
          <div className="mb-5">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Project Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="e.g. Build a responsive e-commerce website"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-muted-foreground">
                Write a clear, specific title that summarises the work.
              </p>
              <span
                className={`text-xs font-medium ${title.length > MAX_TITLE * 0.9 ? "text-warning" : "text-muted-foreground"}`}
              >
                {title.length}/{MAX_TITLE}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={7}
              placeholder={`Describe your project in detail. Consider covering:\n• What you need built or designed\n• Key deliverables and expected outcomes\n• Any technical requirements or preferences\n• Reference links or inspiration (if any)`}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y min-h-[120px] transition-colors"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-muted-foreground">
                {description.trim().length < 30
                  ? `At least 30 characters recommended (${description.trim().length} so far)`
                  : "Good — your description looks detailed enough."}
              </p>
              <span className="text-xs text-muted-foreground">
                {description.length} chars
              </span>
            </div>
          </div>
        </section>

        {/* Section 2: Budget & Timeline */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm mb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-sm font-bold">
              2
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Budget & Timeline
            </h2>
          </div>

          {/* Budget + Currency — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 mb-5">
            <div>
              <label
                htmlFor="budget"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Budget <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">
                  {currency}
                </span>
                <input
                  id="budget"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Set a realistic budget to attract qualified freelancers.
              </p>
            </div>

            <div className="sm:w-52">
              <label
                htmlFor="currency"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline — date only */}
          <div>
            <label
              htmlFor="deadline"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Deadline <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id="deadline"
                type="date"
                value={deadline}
                min={getTomorrowDateString()}
                onChange={(e) => setDeadline(e.target.value)}
                className="flex-1 sm:max-w-xs px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              {deadlineLabel && (
                <span className="hidden sm:inline text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  {deadlineLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              When do you need the project completed by?
            </p>
          </div>
        </section>

        {/* Section 3: Skills */}
        {skills.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm mb-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                3
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Required Skills
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-9">
              Select up to {MAX_SKILLS} skills to help freelancers find your
              project. This is optional.
            </p>

            {/* Search skills when there are many */}
            {skills.length > 8 && (
              <div className="mb-3">
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills…"
                  className="w-full sm:max-w-xs px-3 py-2 text-xs border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {filteredSkills.map((skill) => {
                const selected = selectedSkillIds.includes(skill.id);
                const atLimit =
                  !selected && selectedSkillIds.length >= MAX_SKILLS;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={atLimit}
                    onClick={() => toggleSkill(skill.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : atLimit
                          ? "bg-secondary text-muted-foreground border-border opacity-50 cursor-not-allowed"
                          : "bg-secondary text-secondary-foreground border-border hover:border-primary/50 hover:shadow-sm"
                    }`}
                  >
                    {selected && (
                      <span className="inline-block mr-1">✓</span>
                    )}
                    {skill.name}
                  </button>
                );
              })}
              {filteredSkills.length === 0 && skillSearch && (
                <p className="text-xs text-muted-foreground py-2">
                  No skills matching &quot;{skillSearch}&quot;
                </p>
              )}
            </div>

            {/* Selected count + clear button */}
            {selectedSkillIds.length > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {selectedSkillIds.length} skill
                  {selectedSkillIds.length !== 1 ? "s" : ""} selected
                  {selectedSkillIds.length >= MAX_SKILLS && " (max reached)"}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedSkillIds([])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </section>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-lg mb-5">
            <svg
              className="h-4 w-4 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Actions — two distinct paths */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-2">
          <Link
            href="/projects"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-center sm:text-left"
          >
            Cancel
          </Link>

          <div className="flex items-center gap-3">
            {/* Save Draft — secondary action */}
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => handleSubmit("draft")}
              className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium border border-border rounded-lg bg-background text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {createMutation.isPending && pendingAction === "draft"
                ? "Saving…"
                : "Save as Draft"}
            </button>

            {/* Publish Now — primary action */}
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => handleSubmit("publish")}
              className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {createMutation.isPending && pendingAction === "publish"
                ? "Publishing…"
                : "Publish Now"}
            </button>
          </div>
        </div>

        {/* Informational footer */}
        <p className="text-xs text-muted-foreground mt-4 text-center sm:text-right">
          Drafts are only visible to you. Published projects appear on the
          marketplace immediately.
        </p>
      </main>
    </div>
  );
}
