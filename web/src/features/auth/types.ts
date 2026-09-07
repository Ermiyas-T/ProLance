// Auth-specific request/response types (Architecture.md §3.3).
// Shared entity shapes live in @/types/entities.

import type { Role } from "@/types/entities";

// POST /auth/register body
export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  role: Extract<Role, "CLIENT" | "FREELANCER">;
}

// POST /auth/login body
export interface LoginRequest {
  email: string;
  password: string;
}

// POST /auth/login response
export interface TokenResponse {
  access_token: string;
  token_type: string;
}
