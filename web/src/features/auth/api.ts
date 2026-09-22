// Typed fetchers for auth endpoints (Architecture.md §3.3).
// Uses the shared apiFetch wrapper for automatic 401 recovery.

import { apiFetch } from "@/lib/api-client";
import type { User } from "@/types/entities";
import type { LoginRequest, RegisterRequest } from "./types";

// POST /auth/register — creates a new user account
export function register(data: RegisterRequest): Promise<User> {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /auth/login — establishes HttpOnly cookies without exposing a token to JavaScript
export function login(data: LoginRequest): Promise<void> {
  return apiFetch<void>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /auth/logout — revokes the current browser session and clears cookies
export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

// GET /auth/me — returns the currently authenticated user
export function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}
