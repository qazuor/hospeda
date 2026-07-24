/**
 * Alliance Leads — TanStack Query hooks.
 *
 * Provides:
 *  - `allianceLeadKeys`           — stable query-key factory.
 *  - `useAllianceLeadsQuery`      — paginated list of leads (GET /admin/alliance/leads).
 *  - `useMarkAllianceLeadHandledMutation` — POST /admin/alliance/leads/:id/mark-handled
 *    (approve/reject).
 *
 * All fetchers unwrap the `{success, data: {items, pagination}}` API envelope.
 * Gate: ALLIANCE_LEAD_VIEW_ALL (list) / ALLIANCE_LEAD_MANAGE (mutation).
 *
 * Unlike `useCommerceLeads`, there is deliberately NO provision-owner or
 * approve-and-provision mutation here — approving an alliance lead never
 * auto-provisions any role/entity in V1 (HOS-277 NG-1); the admin follows up
 * manually.
 */

import type { AllianceLead, AllianceLeadKind, AllianceLeadStatus } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pagination metadata returned by the list endpoint. */
export type AllianceLeadPagination = {
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
};

/** Paginated response returned by `useAllianceLeadsQuery`. */
export type AllianceLeadsPage = {
    readonly items: AllianceLead[];
    readonly pagination: AllianceLeadPagination;
};

/** Query parameters for the alliance leads list. */
export type AllianceLeadsQueryParams = {
    readonly status?: AllianceLeadStatus | '';
    readonly kind?: AllianceLeadKind | '';
    readonly page: number;
    readonly pageSize: number;
};

/** Payload for the mark-handled mutation. */
export type MarkAllianceLeadHandledPayload = {
    readonly id: string;
    readonly status: 'approved' | 'rejected';
    readonly adminNote?: string;
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Stable, hierarchical query-key factory for alliance lead queries.
 *
 * @example
 * ```ts
 * allianceLeadKeys.list({ page: 1, pageSize: 20 }) // ['alliance-leads', 'list', {...}]
 * ```
 */
export const allianceLeadKeys = {
    all: ['alliance-leads'] as const,
    lists: () => [...allianceLeadKeys.all, 'list'] as const,
    list: (params: AllianceLeadsQueryParams) => [...allianceLeadKeys.lists(), params] as const
} as const;

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetches a paginated list of alliance leads from the admin API.
 * Unwraps the `{success, data: {items, pagination}}` envelope.
 */
async function fetchAllianceLeads(params: AllianceLeadsQueryParams): Promise<AllianceLeadsPage> {
    const searchParams = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize)
    });

    if (params.status) searchParams.set('status', params.status);
    if (params.kind) searchParams.set('kind', params.kind);

    const result = await fetchApi<{
        success: boolean;
        data: { items: AllianceLead[]; pagination: AllianceLeadPagination };
    }>({
        path: `/api/v1/admin/alliance/leads?${searchParams.toString()}`
    });

    return result.data.data;
}

/**
 * Calls POST /admin/alliance/leads/:id/mark-handled with approve/reject +
 * optional note. Returns the updated `AllianceLead` entity.
 */
async function markAllianceLeadHandled(
    payload: MarkAllianceLeadHandledPayload
): Promise<AllianceLead> {
    const { id, ...body } = payload;
    const result = await fetchApi<{ success: boolean; data: AllianceLead }>({
        path: `/api/v1/admin/alliance/leads/${id}/mark-handled`,
        method: 'POST',
        body
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * TanStack Query hook — paginated list of alliance leads.
 *
 * @param params - Pagination + filter parameters.
 * @returns Standard `UseQueryResult` wrapping `AllianceLeadsPage`.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAllianceLeadsQuery({ page: 1, pageSize: 20 });
 * ```
 */
export const useAllianceLeadsQuery = (params: AllianceLeadsQueryParams) => {
    return useQuery({
        queryKey: allianceLeadKeys.list(params),
        queryFn: () => fetchAllianceLeads(params),
        staleTime: 30_000
    });
};

/**
 * TanStack mutation hook — mark a lead as approved or rejected.
 *
 * Invalidates the leads list on success so the inbox refreshes. Never
 * provisions any role/entity — see the module-level JSDoc.
 *
 * @example
 * ```tsx
 * const mutation = useMarkAllianceLeadHandledMutation();
 * mutation.mutate({ id: lead.id, status: 'approved', adminNote: 'OK' });
 * ```
 */
export const useMarkAllianceLeadHandledMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: MarkAllianceLeadHandledPayload) => markAllianceLeadHandled(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: allianceLeadKeys.lists() });
        }
    });
};
