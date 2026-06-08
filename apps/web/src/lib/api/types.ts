/**
 * Shared types for the web2 API client.
 * Maps to the standard response shapes from @repo/schemas.
 */

/** Pagination metadata returned by list endpoints */
export interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
}

/** Standard paginated response from list endpoints */
export interface PaginatedResponse<T> {
    readonly items: readonly T[];
    readonly pagination: PaginationMeta;
}

/** Standard API success response wrapper */
export interface ApiSuccessResponse<T> {
    readonly success: true;
    readonly data: T;
    readonly metadata?: {
        readonly timestamp: string;
        readonly requestId?: string;
        readonly version?: string;
    };
}

/** Standard API error response */
export interface ApiErrorResponse {
    readonly success: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
    };
    readonly metadata?: {
        readonly timestamp: string;
        readonly requestId?: string;
    };
}

/** API client error with status and structured info */
export interface ApiError {
    readonly status: number;
    readonly message: string;
    readonly code?: string;
    readonly details?: unknown;
}

/** Result type for API calls: either success data or error */
export type ApiResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly error: ApiError };

/** Common query parameters for list endpoints */
export interface ListParams {
    readonly page?: number;
    readonly pageSize?: number;
    readonly q?: string;
    readonly sort?: string;
    readonly order?: 'asc' | 'desc';
    readonly [key: string]: string | number | boolean | undefined;
}

/**
 * Host dashboard data for the HostDashboard React island.
 * Transformed from the API response by `transformHostDashboard`.
 */
export interface HostDashboardData {
    readonly propertySummary: {
        readonly total: number;
        readonly published: number;
        readonly draft: number;
    };
    readonly planInfo: {
        readonly name: string;
        readonly status: string;
        readonly isTrial: boolean;
    } | null;
    readonly unreadCount: number;
    readonly quickActions: ReadonlyArray<{
        readonly label: string;
        readonly href: string;
        readonly icon: string;
    }>;
}
