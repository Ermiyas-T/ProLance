// Query keys + queryOptions for profiles — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import {
  fetchMyClientProfile,
  fetchMyFreelancerProfile,
  fetchFreelancerProfile,
  fetchSkills,
} from "./api";

export const profileKeys = {
  all: ["profiles"] as const,
  skills: () => [...profileKeys.all, "skills"] as const,
  client: {
    me: () => [...profileKeys.all, "client", "me"] as const,
  },
  freelancer: {
    me: () => [...profileKeys.all, "freelancer", "me"] as const,
    detail: (userId: number) => [...profileKeys.all, "freelancer", userId] as const,
  },
};

// Fetches all available skills
export const skillsOptions = queryOptions({
  queryKey: profileKeys.skills(),
  queryFn: fetchSkills,
});

// Fetches the current user's client profile
export const myClientProfileOptions = queryOptions({
  queryKey: profileKeys.client.me(),
  queryFn: fetchMyClientProfile,
});

// Fetches the current user's freelancer profile
export const myFreelancerProfileOptions = queryOptions({
  queryKey: profileKeys.freelancer.me(),
  queryFn: fetchMyFreelancerProfile,
});

// Fetches a freelancer profile by user ID
export const freelancerProfileOptions = (userId: number) =>
  queryOptions({
    queryKey: profileKeys.freelancer.detail(userId),
    queryFn: () => fetchFreelancerProfile(userId),
  });
