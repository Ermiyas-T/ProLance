export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}
