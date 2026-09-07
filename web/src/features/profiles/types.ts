// Profile-specific request/response types (shared entity shapes in @/types/entities).

// POST /profiles/client body
export interface ClientProfileCreateRequest {
  display_name: string;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
}

// PUT /profiles/client/me body
export interface ClientProfileUpdateRequest {
  display_name?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
}

// POST /profiles/freelancer body
export interface FreelancerProfileCreateRequest {
  professional_title?: string | null;
  bio?: string | null;
  hourly_rate: string;
  skills?: string[];
}

// PUT /profiles/freelancer/me body
export interface FreelancerProfileUpdateRequest {
  professional_title?: string | null;
  bio?: string | null;
  hourly_rate?: string | null;
  skills?: string[] | null;
}

// POST /profiles/freelancer/portfolio body
export interface PortfolioItemCreateRequest {
  title: string;
  description?: string | null;
  url?: string | null;
}

// Skill object returned by GET /skills
export interface Skill {
  id: number;
  name: string;
}
