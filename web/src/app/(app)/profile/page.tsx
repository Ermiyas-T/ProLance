"use client";

// Profile page — client vs freelancer form (Architecture.md §4).
// Client: display_name, bio, location, avatar_url.
// Freelancer: professional_title, bio, hourly_rate, skills (add/remove), portfolio items.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";
import { useSession } from "@/app/providers";
import {
  myClientProfileOptions,
  myFreelancerProfileOptions,
  skillsOptions,
} from "@/features/profiles/queries";
import {
  createClientProfile,
  updateMyClientProfile,
  createFreelancerProfile,
  updateMyFreelancerProfile,
  addFreelancerSkill,
  removeFreelancerSkill,
  addPortfolioItem,
} from "@/features/profiles/api";
import { profileKeys } from "@/features/profiles/queries";
import type { Skill } from "@/types/entities";
import type {
  ClientProfileCreateRequest,
  FreelancerProfileCreateRequest,
  PortfolioItemCreateRequest,
} from "@/features/profiles/types";

export default function ProfilePage() {
  const { user } = useSession();

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-foreground mb-2">Your profile</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {user.role === "CLIENT" && "Manage how freelancers see you."}
          {user.role === "FREELANCER" && "Showcase your skills and experience."}
        </p>

        {user.role === "CLIENT" && <ClientProfileForm />}
        {user.role === "FREELANCER" && <FreelancerProfileForm />}
        {user.role === "ADMIN" && (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Admin accounts don&apos;t have profiles.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Client Profile Form ---

function ClientProfileForm() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(myClientProfileOptions);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
      setLocation(profile.location ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (data: ClientProfileCreateRequest) =>
      profile ? updateMyClientProfile(data) : createClientProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.client.me() });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to save profile");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      display_name: displayName,
      bio: bio || null,
      location: location || null,
      avatar_url: avatarUrl || null,
    });
  };

  if (isLoading) {
    return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1.5">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          placeholder="How freelancers see you"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1.5">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
          placeholder="Tell freelancers about yourself or your company"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-foreground mb-1.5">
          Location
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          placeholder="City, Country"
        />
      </div>

      <div>
        <label htmlFor="avatarUrl" className="block text-sm font-medium text-foreground mb-1.5">
          Avatar URL
        </label>
        <input
          id="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          placeholder="https://example.com/avatar.jpg"
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : profile ? "Update profile" : "Create profile"}
      </button>
    </form>
  );
}

// --- Freelancer Profile Form ---

function FreelancerProfileForm() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(myFreelancerProfileOptions);
  const { data: allSkills = [] } = useQuery(skillsOptions);

  const [professionalTitle, setProfessionalTitle] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Portfolio form
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDesc, setPortfolioDesc] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  // Skill search
  const [skillSearch, setSkillSearch] = useState("");

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setProfessionalTitle(profile.professional_title ?? "");
      setBio(profile.bio ?? "");
      setHourlyRate(profile.hourly_rate);
    }
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: (data: FreelancerProfileCreateRequest) =>
      profile ? updateMyFreelancerProfile(data) : createFreelancerProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.freelancer.me() });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to save profile");
    },
  });

  const addSkillMutation = useMutation({
    mutationFn: addFreelancerSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.freelancer.me() });
      setSkillSearch("");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to add skill");
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: removeFreelancerSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.freelancer.me() });
    },
  });

  const addPortfolioMutation = useMutation({
    mutationFn: addPortfolioItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.freelancer.me() });
      setPortfolioTitle("");
      setPortfolioDesc("");
      setPortfolioUrl("");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to add portfolio item");
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({
      professional_title: professionalTitle || null,
      bio: bio || null,
      hourly_rate: hourlyRate,
    });
  };

  const handleAddSkill = (skillName: string) => {
    addSkillMutation.mutate(skillName);
  };

  const handleRemoveSkill = (skillId: number) => {
    removeSkillMutation.mutate(skillId);
  };

  const handleAddPortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioTitle.trim()) return;
    addPortfolioMutation.mutate({
      title: portfolioTitle,
      description: portfolioDesc || null,
      url: portfolioUrl || null,
    });
  };

  const currentSkills = profile?.skills ?? [];
  const currentPortfolio = profile?.portfolio_items ?? [];

  // Filter skills for search
  const filteredSkills = allSkills.filter(
    (s) =>
      s.name.toLowerCase().includes(skillSearch.toLowerCase()) &&
      !currentSkills.some((cs) => cs.id === s.id),
  );

  if (isLoading) {
    return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {/* Profile form */}
      <form onSubmit={handleProfileSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="professionalTitle" className="block text-sm font-medium text-foreground mb-1.5">
            Professional title
          </label>
          <input
            id="professionalTitle"
            type="text"
            value={professionalTitle}
            onChange={(e) => setProfessionalTitle(e.target.value)}
            className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            placeholder="e.g. Senior Frontend Developer"
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1.5">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
            placeholder="Describe your experience and expertise"
          />
        </div>

        <div>
          <label htmlFor="hourlyRate" className="block text-sm font-medium text-foreground mb-1.5">
            Hourly rate (USD)
          </label>
          <input
            id="hourlyRate"
            type="number"
            required
            step="0.01"
            min="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            placeholder="50.00"
          />
        </div>

        <button
          type="submit"
          disabled={profileMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {profileMutation.isPending ? "Saving…" : profile ? "Update profile" : "Create profile"}
        </button>
      </form>

      {/* Skills section (freelancer only, profile must exist) */}
      {profile && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>

          {/* Current skills */}
          <div className="flex flex-wrap gap-2">
            {currentSkills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills added yet.</p>
            )}
            {currentSkills.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
              >
                {skill.name}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill.id)}
                  className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Add skill */}
          <div className="relative">
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              placeholder="Search skills to add…"
            />
            {skillSearch && filteredSkills.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSkills.slice(0, 10).map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleAddSkill(skill.name)}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio section (freelancer only, profile must exist) */}
      {profile && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Portfolio</h2>

          {/* Current items */}
          {currentPortfolio.length > 0 ? (
            <div className="space-y-3">
              {currentPortfolio.map((item) => (
                <div key={item.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      {item.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio items yet.</p>
          )}

          {/* Add portfolio item */}
          <form onSubmit={handleAddPortfolio} className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium text-foreground">Add item</p>
            <input
              type="text"
              required
              value={portfolioTitle}
              onChange={(e) => setPortfolioTitle(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              placeholder="Project title"
            />
            <textarea
              value={portfolioDesc}
              onChange={(e) => setPortfolioDesc(e.target.value)}
              rows={2}
              className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
              placeholder="Brief description (optional)"
            />
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              placeholder="https://… (optional)"
            />
            <button
              type="submit"
              disabled={addPortfolioMutation.isPending || !portfolioTitle.trim()}
              className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {addPortfolioMutation.isPending ? "Adding…" : "Add item"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
