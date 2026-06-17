/**
 * @file use-own-accommodations.ts
 * @description Hooks for host-scoped accommodation list and single item (SPEC-243 T-041/T-042).
 *
 * List endpoint:   GET /api/v1/protected/accommodations
 *   Query params:  page, pageSize, lifecycleState?, sortBy?, sortOrder?
 *   Response data: { items: AccommodationProtected[], pagination: { total, page, pageSize, totalPages } }
 *
 * Detail endpoint: GET /api/v1/protected/accommodations/:id
 *   Response data: AccommodationProtected | null
 *
 * @module lib/api/hooks/use-own-accommodations
 */
import { AccommodationProtectedSchema } from '@repo/schemas';
import { z } from 'zod';
import { useApiQuery } from '../use-api-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle state filter values accepted by the list endpoint. */
export type AccommodationLifecycleFilter = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

/** Sort field options for the list endpoint. */
export type AccommodationSortBy = 'createdAt' | 'name' | 'updatedAt';

/** Sort direction options. */
export type AccommodationSortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Pagination envelope schema shared by list endpoints. */
const PaginationSchema = z.object({
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().min(0)
});

/**
 * List response schema for GET /api/v1/protected/accommodations.
 * The API client unwraps the `{success,data}` envelope; this schema
 * validates the `data` payload.
 */
export const OwnAccommodationsListSchema = z.object({
    items: z.array(AccommodationProtectedSchema),
    pagination: PaginationSchema
});

export type OwnAccommodationsList = z.infer<typeof OwnAccommodationsListSchema>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** Stable TanStack Query keys for own accommodations. */
export const ownAccommodationKeys = {
    all: ['own-accommodations'] as const,
    lists: () => [...ownAccommodationKeys.all, 'list'] as const,
    list: (params: Record<string, unknown>) => [...ownAccommodationKeys.lists(), params] as const,
    details: () => [...ownAccommodationKeys.all, 'detail'] as const,
    detail: (id: string) => [...ownAccommodationKeys.details(), id] as const
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Input params for {@link useOwnAccommodations}.
 */
export interface UseOwnAccommodationsInput {
    /** Page number (1-based). Defaults to 1. */
    readonly page?: number;
    /** Items per page. Defaults to 12. */
    readonly pageSize?: number;
    /** Filter by lifecycle state. Omit to return all states. */
    readonly lifecycleState?: AccommodationLifecycleFilter;
    /** Sort field. */
    readonly sortBy?: AccommodationSortBy;
    /** Sort direction. */
    readonly sortOrder?: AccommodationSortOrder;
}

/**
 * Fetches the authenticated host's own accommodations (paginated).
 *
 * The API automatically scopes results to `ownerId = actor.id`, so no
 * client-side filtering is needed.
 *
 * @param input - Optional pagination and filter params.
 * @returns TanStack `UseQueryResult<OwnAccommodationsList>`.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useOwnAccommodations({ page: 1, pageSize: 12 });
 * data?.items.forEach(item => console.log(item.name));
 * ```
 */
export function useOwnAccommodations({
    page = 1,
    pageSize = 12,
    lifecycleState,
    sortBy,
    sortOrder
}: UseOwnAccommodationsInput = {}) {
    const params: Record<string, unknown> = { page, pageSize };
    if (lifecycleState) params.lifecycleState = lifecycleState;
    if (sortBy) params.sortBy = sortBy;
    if (sortOrder) params.sortOrder = sortOrder;

    return useApiQuery({
        queryKey: ownAccommodationKeys.list(params),
        path: '/api/v1/protected/accommodations',
        query: params as Record<string, string | number | boolean | null | undefined>,
        schema: OwnAccommodationsListSchema,
        staleTime: 2 * 60 * 1000 // 2 minutes
    });
}

/**
 * Fetches a single own accommodation by ID.
 *
 * Uses the dedicated GET /api/v1/protected/accommodations/:id endpoint which
 * enforces ownership on the server side (returns 404 if not owned by the actor).
 *
 * @param id - Accommodation UUID. Query is disabled when falsy.
 * @returns TanStack `UseQueryResult<AccommodationProtected | null>`.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useOwnAccommodation('abc-123');
 * console.log(data?.name);
 * ```
 */
export function useOwnAccommodation(id: string | undefined) {
    return useApiQuery({
        queryKey: ownAccommodationKeys.detail(id ?? ''),
        path: `/api/v1/protected/accommodations/${id ?? ''}`,
        schema: AccommodationProtectedSchema.nullable(),
        enabled: !!id,
        staleTime: 2 * 60 * 1000 // 2 minutes
    });
}
