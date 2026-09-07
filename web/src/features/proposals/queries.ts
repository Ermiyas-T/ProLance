// Query keys + queryOptions for proposals — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchOwnProposals, fetchProjectProposals, fetchProposal } from "./api";

export const proposalKeys = {
  all: ["proposals"] as const,
  lists: () => [...proposalKeys.all, "list"] as const,
  own: () => [...proposalKeys.lists(), "own"] as const,
  project: (projectId: number) => [...proposalKeys.all, "project", projectId] as const,
  details: () => [...proposalKeys.all, "detail"] as const,
  detail: (id: number) => [...proposalKeys.details(), id] as const,
};

// Fetches the current freelancer's own proposals
export const ownProposalsOptions = (page = 1, page_size = 20) =>
  queryOptions({
    queryKey: [...proposalKeys.own(), { page, page_size }],
    queryFn: () => fetchOwnProposals(page, page_size),
  });

// Fetches a single proposal by ID
export const proposalDetailOptions = (id: number) =>
  queryOptions({
    queryKey: proposalKeys.detail(id),
    queryFn: () => fetchProposal(id),
  });

// Fetches proposals for a specific project (client only)
export const projectProposalsOptions = (projectId: number, page = 1, page_size = 20) =>
  queryOptions({
    queryKey: [...proposalKeys.project(projectId), { page, page_size }],
    queryFn: () => fetchProjectProposals(projectId, page, page_size),
  });
