/**
 * Revalidation HTTP Adapter for Admin Application
 *
 * Provides typed HTTP functions to interact with the ISR revalidation API.
 * All requests are routed through the centralized `fetchApi` client which
 * handles base URL resolution, JSON serialization, error handling, and
 * Better Auth session cookies automatically.
 *
 * Endpoints are under `/api/v1/admin/revalidation/*` (admin tier only).
 *
 * @module lib/revalidation-http-adapter
 */

import type {
    ManualRevalidateRequest,
    RevalidationConfig,
    RevalidationLog,
    RevalidationResponse,
    RevalidationStats,
    UpdateRevalidationConfigInput,
} from '@repo/schemas';

import { fetchApi } from '../api/client';

const BASE = '/api/v1/admin/revalidation';

/**
 * Unwraps a `{ data: T }` API envelope returned by admin list/get endpoints.
 *
 * @param path - The endpoint path to fetch
 * @param method - HTTP method (defaults to GET)
 * @param body - Optional request body
 * @returns The unwrapped `data` field from the response envelope
 */
async function revalidationFetch<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
): Promise<T> {
    const { data } = await fetchApi<{ data: T } | T>({ path, method, body });
    if (data !== null && typeof data === 'object' && 'data' in (data as object)) {
        return (data as { data: T }).data;
    }
    return data as T;
}

/**
 * Triggers a manual revalidation of a specific list of URL paths.
 *
 * @param input - Paths to revalidate and an optional audit reason
 * @returns Revalidation result with per-path success/failure breakdown
 */
export async function manualRevalidate(
    input: ManualRevalidateRequest
): Promise<RevalidationResponse> {
    return revalidationFetch<RevalidationResponse>(`${BASE}/revalidate/manual`, 'POST', input);
}

/**
 * Triggers revalidation of all paths associated with a specific entity instance.
 *
 * @param entityType - The type of entity (e.g., `'accommodation'`)
 * @param entityId - The ID of the specific entity instance
 * @param reason - Optional audit reason
 * @returns Revalidation result with per-path success/failure breakdown
 */
export async function revalidateEntity(
    entityType: string,
    entityId: string,
    reason = 'Manual admin revalidation'
): Promise<RevalidationResponse> {
    return revalidationFetch<RevalidationResponse>(
        `${BASE}/revalidate/entity`,
        'POST',
        { entityType, entityId, reason }
    );
}

/**
 * Returns the revalidation configuration records for all entity types.
 *
 * @returns List of revalidation config records
 */
export async function getRevalidationConfigs(): Promise<RevalidationConfig[]> {
    return revalidationFetch<RevalidationConfig[]>(`${BASE}/config`);
}

/**
 * Updates the revalidation configuration for a specific entity type.
 *
 * @param id - UUID of the config record to update
 * @param input - Partial fields to update (PATCH semantics)
 * @returns The updated revalidation config record
 */
export async function updateRevalidationConfig(
    id: string,
    input: UpdateRevalidationConfigInput
): Promise<RevalidationConfig> {
    return revalidationFetch<RevalidationConfig>(`${BASE}/config/${id}`, 'PATCH', input);
}

/**
 * Returns recent revalidation log entries.
 *
 * @returns List of revalidation log records
 */
export async function getRevalidationLogs(): Promise<RevalidationLog[]> {
    return revalidationFetch<RevalidationLog[]>(`${BASE}/logs`);
}

/**
 * Returns aggregated revalidation statistics for the admin dashboard.
 *
 * @returns Revalidation stats including success rate and per-entity breakdowns
 */
export async function getRevalidationStats(): Promise<RevalidationStats> {
    return revalidationFetch<RevalidationStats>(`${BASE}/stats`);
}
