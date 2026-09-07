// Query keys + queryOptions for reviews — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchUserReviews, fetchUserAverageRating } from "./api";

export const reviewKeys = {
  all: ["reviews"] as const,
  user: (userId: number) => [...reviewKeys.all, "user", userId] as const,
  userAverage: (userId: number) => [...reviewKeys.all, "user", userId, "average"] as const,
};

// Fetches all reviews for a user
export const userReviewsOptions = (userId: number) =>
  queryOptions({
    queryKey: reviewKeys.user(userId),
    queryFn: () => fetchUserReviews(userId),
  });

// Fetches the average rating for a user
export const userAverageRatingOptions = (userId: number) =>
  queryOptions({
    queryKey: reviewKeys.userAverage(userId),
    queryFn: () => fetchUserAverageRating(userId),
  });
