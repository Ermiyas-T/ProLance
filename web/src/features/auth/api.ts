// Typed fetchers for auth endpoints (Architecture.md §3.3).
// Uses the shared apiFetch wrapper for automatic 401 recovery.

import { apiFetch } from "@/lib/api-client";
import type { User } from "@/types/entities";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
} from "./types";

// POST /auth/register — creates a new user account
export function register(data: RegisterRequest): Promise<User> {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /auth/login — returns a JWT access token
export function login(data: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// GET /auth/me — returns the currently authenticated user
export function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}
