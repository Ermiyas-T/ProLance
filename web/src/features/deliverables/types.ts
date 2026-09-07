// Deliverable-specific request/response types (shared entity shapes in @/types/entities).

// POST /contracts/{contractId}/deliverables body
export interface DeliverableSubmitRequest {
  message: string;
  file_url?: string;
}

// POST /deliverables/{id}/request-revision body
export interface DeliverableRevisionRequest {
  revision_notes: string;
}
