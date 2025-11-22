// Standardized API response types

export interface ApiResponse<T = unknown> {
  data?: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
  errors?: Array<{
    message: string;
    field?: string;
    code?: string;
  }>;
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  role: string;
  email: string;
}
