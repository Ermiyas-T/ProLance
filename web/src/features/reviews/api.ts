// Typed fetchers for reviews (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { Review } from "@/types/entities";
import type { AverageRatingResponse, ReviewCreateRequest } from "./types";

// GET /users/{userId}/reviews — list reviews for a user
export function fetchUserReviews(userId: string): Promise<Review[]> {
  return apiFetch<Review[]>(`/users/${userId}/reviews`);
}

// GET /users/{userId}/reviews/average — get average rating for a user
export function fetchUserAverageRating(userId: string): Promise<AverageRatingResponse> {
  return apiFetch<AverageRatingResponse>(`/users/${userId}/reviews/average`);
}

// POST /reviews — create a review
export function createReview(data: ReviewCreateRequest): Promise<Review> {
  return apiFetch<Review>("/reviews", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
