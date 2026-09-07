// Canonical TS types shared across features (Architecture.md §5).
// These mirror the FastAPI schemas 1:1 — update both sides together.

export type Role = "CLIENT" | "FREELANCER" | "ADMIN";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

// --- Projects ---
export type ProjectStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Project {
  id: number;
  owner_id: number;
  title: string;
  description: string;
  budget: string; // Decimal(10,2) as string — never parsed for math client-side
  currency: string; // ISO 4217, e.g. "USD"
  deadline: string; // ISO date
  status: ProjectStatus;
  skills: Skill[];
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: number;
  name: string;
}

export interface ClientProfile {
  id: number;
  user_id: number;
  display_name: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: number;
  freelancer_profile_id: number;
  title: string;
  description: string | null;
  url: string | null;
  created_at: string;
}

export interface FreelancerProfile {
  id: number;
  user_id: number;
  professional_title: string | null;
  bio: string | null;
  hourly_rate: string;
  avg_rating: string;
  completed_projects_count: number;
  skills: Skill[];
  portfolio_items: PortfolioItem[];
  created_at: string;
  updated_at: string;
}

// --- Proposals ---
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface Proposal {
  id: number;
  project_id: number;
  freelancer_id: number;
  proposed_price: string;
  delivery_days: number;
  cover_letter: string;
  status: ProposalStatus;
  created_at: string;
}

// --- Contracts ---
export type ContractStatus = "ACTIVE" | "DELIVERED" | "COMPLETED" | "CANCELLED";

export interface Contract {
  id: number;
  project_id: number;
  proposal_id: number;
  client_id: number;
  freelancer_id: number;
  agreed_price: string;
  deadline: string;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
}

// --- Tasks ---
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: number;
  contract_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

// --- Deliverables ---
export type DeliverableStatus = "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED";

export interface Deliverable {
  id: number;
  contract_id: number;
  submitted_by: number;
  version_number: number;
  message: string;
  file_url: string | null;
  status: DeliverableStatus;
  revision_notes: string | null;
  created_at: string;
}

// --- Reviews ---
export type ReviewType = "CLIENT_TO_FREELANCER" | "FREELANCER_TO_CLIENT";

export interface Review {
  id: number;
  contract_id: number;
  reviewer_id: number;
  reviewee_id: number;
  review_type: ReviewType;
  rating_overall: number; // 1–5
  rating_communication: number | null;
  rating_quality: number | null;
  rating_timeliness: number | null;
  comment: string | null;
  created_at: string;
}

// --- Disputes ---
export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

export interface Dispute {
  id: number;
  contract_id: number;
  opened_by: number;
  title: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolved_by: number | null;
  created_at: string;
  updated_at: string;
}
