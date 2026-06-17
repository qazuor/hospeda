/**
 * @file use-host-dashboard.ts
 * @description Hook for fetching the host dashboard aggregated data (SPEC-243 T-040).
 *
 * Endpoint: GET /api/v1/protected/host/dashboard
 * Response shape:
 *   { properties: { total, published, draft, archived }, plan: { slug, name, status, isTrial } | null, unreadConversations: number }
 *
 * The response schema is defined locally (not in @repo/schemas) since
 * `HostDashboardResponseSchema` is defined in the API route and not exported
 * from the schemas package.
 *
 * @module lib/api/hooks/use-host-dashboard
 */
import { z } from 'zod';
import { useApiQuery } from '../use-api-query';

// ---------------------------------------------------------------------------
// Wire schema — mirrors apps/api/src/routes/host/protected/dashboard.ts
// ---------------------------------------------------------------------------

/** Plan status values the API can return. */
const HostDashboardPlanStatusSchema = z.enum([
    'active',
    'trial',
    'cancelled',
    'expired',
    'past_due'
]);

/** Plan sub-object schema. */
const HostDashboardPlanSchema = z.object({
    slug: z.string(),
    name: z.string(),
    status: HostDashboardPlanStatusSchema,
    isTrial: z.boolean()
});

/**
 * Zod schema for the `data` payload of GET /api/v1/protected/host/dashboard.
 *
 * Kept local to the mobile app (not in @repo/schemas) because this schema
 * is defined directly in the API route handler, not in the shared schemas
 * package. The shape is stable per the API implementation.
 */
export const HostDashboardSchema = z.object({
    properties: z.object({
        total: z.number().int().min(0),
        published: z.number().int().min(0),
        draft: z.number().int().min(0),
        archived: z.number().int().min(0)
    }),
    plan: HostDashboardPlanSchema.nullable(),
    unreadConversations: z.number().int().min(0)
});

export type HostDashboard = z.infer<typeof HostDashboardSchema>;

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

/** Stable TanStack Query key for the host dashboard. */
export const hostDashboardQueryKey = ['host', 'dashboard'] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches the host dashboard aggregated data.
 *
 * Returns property counts by lifecycle state, unread conversation count,
 * and current plan info (or null if no active plan).
 *
 * @returns TanStack `UseQueryResult<HostDashboard>`.
 *
 * @example
 * ```ts
 * const { data, isLoading, error } = useHostDashboard();
 * if (data) {
 *   console.log(data.properties.total, data.plan?.name);
 * }
 * ```
 */
export function useHostDashboard() {
    return useApiQuery({
        queryKey: hostDashboardQueryKey,
        path: '/api/v1/protected/host/dashboard',
        schema: HostDashboardSchema,
        staleTime: 60 * 1000 // 1 minute — dashboard counts are relatively fresh
    });
}
