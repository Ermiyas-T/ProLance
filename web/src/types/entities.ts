// Canonical TS types shared across features (Architecture.md §5).
// These mirror the FastAPI schemas 1:1 — update both sides together.
// Entity IDs are UUID strings on the wire because the backend models use uuid.UUID
// primary keys; never coerce them with Number(). Skills are the only integer keys.

export type Role = "CLIENT" | "FREELANCER" | "ADMIN";

export interface User {
  id: string;
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
  id: string;
  owner_id: string;
  title: string;
  description: string;
  budget: string; // Decimal(10,2) as string — never parsed for math client-side
  currency: string; // ISO 4217, e.g. "ETB" (platform default)
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
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: string;
  freelancer_profile_id: string;
  title: string;
  description: string | null;
  url: string | null;
  created_at: string;
}

export interface FreelancerProfile {
  id: string;
  user_id: string;
  professional_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  hourly_rate: string;
  currency: string; // ISO 4217 code for the hourly rate (ETB is the platform default)
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
  id: string;
  project_id: string;
  freelancer_id: string;
  proposed_price: string;
  currency: string;
  delivery_days: number;
  cover_letter: string;
  status: ProposalStatus;
  created_at: string;
}

// --- Contracts ---
export type ContractStatus = "ACTIVE" | "DELIVERED" | "COMPLETED" | "CANCELLED";

export interface Contract {
  id: string;
  project_id: string;
  proposal_id: string;
  client_id: string;
  freelancer_id: string;
  agreed_price: string;
  currency: string; // ISO 4217, inherited from the accepted proposal
  deadline: string;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
}

// --- Tasks ---
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

// --- Deliverables ---
export type DeliverableStatus = "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED";

export interface Deliverable {
  id: string;
  contract_id: string;
  submitted_by: string;
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
  id: string;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
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
  id: string;
  contract_id: string;
  opened_by: string;
  title: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}
