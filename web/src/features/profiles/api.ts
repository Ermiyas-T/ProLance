// Typed fetchers for profiles, skills, and portfolio (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { ClientProfile, FreelancerProfile, Skill } from "@/types/entities";
import type {
  ClientProfileCreateRequest,
  ClientProfileUpdateRequest,
  FreelancerProfileCreateRequest,
  FreelancerProfileUpdateRequest,
  PortfolioItemCreateRequest,
} from "./types";

// --- Skills ---

// GET /skills — list all available skills
export function fetchSkills(): Promise<Skill[]> {
  return apiFetch<Skill[]>("/skills");
}

// --- Client Profile ---

// POST /profiles/client — create client profile
export function createClientProfile(
  data: ClientProfileCreateRequest,
): Promise<ClientProfile> {
  return apiFetch<ClientProfile>("/profiles/client", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// GET /profiles/client/me — get own client profile
export function fetchMyClientProfile(): Promise<ClientProfile> {
  return apiFetch<ClientProfile>("/profiles/client/me");
}

// PUT /profiles/client/me — update own client profile
export function updateMyClientProfile(
  data: ClientProfileUpdateRequest,
): Promise<ClientProfile> {
  return apiFetch<ClientProfile>("/profiles/client/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Freelancer Profile ---

// POST /profiles/freelancer — create freelancer profile
export function createFreelancerProfile(
  data: FreelancerProfileCreateRequest,
): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>("/profiles/freelancer", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// GET /profiles/freelancer/me — get own freelancer profile
export function fetchMyFreelancerProfile(): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>("/profiles/freelancer/me");
}

// PUT /profiles/freelancer/me — update own freelancer profile
export function updateMyFreelancerProfile(
  data: FreelancerProfileUpdateRequest,
): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>("/profiles/freelancer/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// GET /profiles/freelancer/{userId} — public freelancer profile by user ID
export function fetchFreelancerProfile(userId: number): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>(`/profiles/freelancer/${userId}`);
}

// --- Freelancer Skills ---

// POST /profiles/freelancer/skills?skill_name=X — add skill to freelancer
export function addFreelancerSkill(skillName: string): Promise<Skill> {
  const params = new URLSearchParams({ skill_name: skillName });
  return apiFetch<Skill>(`/profiles/freelancer/skills?${params.toString()}`, {
    method: "POST",
  });
}

// DELETE /profiles/freelancer/skills/{skillId} — remove skill from freelancer
export function removeFreelancerSkill(skillId: number): Promise<void> {
  return apiFetch<void>(`/profiles/freelancer/skills/${skillId}`, {
    method: "DELETE",
  });
}

// --- Freelancer Portfolio ---

// POST /profiles/freelancer/portfolio — add portfolio item
export function addPortfolioItem(
  data: PortfolioItemCreateRequest,
): Promise<{ id: number; freelancer_profile_id: number; title: string; description: string | null; url: string | null; created_at: string }> {
  return apiFetch("/profiles/freelancer/portfolio", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
