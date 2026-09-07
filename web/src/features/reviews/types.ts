// Review-specific request/response types (shared entity shapes in @/types/entities).

// POST /reviews body
export interface ReviewCreateRequest {
  contract_id: number;
  rating_overall: number;
  rating_communication?: number | null;
  rating_quality?: number | null;
  rating_timeliness?: number | null;
  comment: string;
}

// GET /users/{id}/reviews/average response
export interface AverageRatingResponse {
  user_id: number;
  average_rating: number | null;
}
