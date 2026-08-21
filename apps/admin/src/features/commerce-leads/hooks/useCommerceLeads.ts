/**
 * Commerce Leads — TanStack Query hooks.
 *
 * Provides:
 *  - `commerceLeadKeys`          — stable query-key factory.
 *  - `useCommerceLeadsQuery`     — paginated list of leads (GET /admin/commerce/leads).
 *  - `useMarkLeadHandledMutation`— POST /admin/commerce/leads/:id/handle (approve/reject).
 *
 * All fetchers unwrap the `{success, data: {items, pagination}}` API envelope.
 * Gate: COMMERCE_VIEW_ALL (list) / COMMERCE_EDIT_ALL (mutations).
 *
 * HOS-693 §6.2 removed the admin owner-provisioning flow (the
 * `POST /admin/commerce/leads/:id/provision-owner` and
 * `.../approve-and-provision` endpoints, and their hooks that used to live
 * here) — owners now grant themselves the COMMERCE_OWNER role by creating
 * their own listing (HOS-687), so there is nothing left for the admin to
 * provision.
 */

import type { CommerceLead } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pagination metadata returned by the list endpoint. */
export type CommerceLeadPagination = {
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
};

/** Paginated response returned by `useCommerceLeadsQuery`. */
export type CommerceLeadsPage = {
    readonly items: CommerceLead[];
    readonly pagination: CommerceLeadPagination;
};

/** Query parameters for the commerce leads list. */
export type CommerceLeadsQueryParams = {
    readonly status?: string;
    readonly domain?: string;
    readonly page: number;
    readonly pageSize: number;
};

/** Payload for the mark-handled mutation. */
export type MarkLeadHandledPayload = {
    readonly id: string;
    readonly status: 'approved' | 'rejected';
    readonly adminNote?: string;
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Stable, hierarchical query-key factory for commerce lead queries.
 *
 * @example
 * ```ts
 * commerceLeadKeys.list({ page: 1, pageSize: 20 }) // ['commerce-leads', 'list', {...}]
 * ```
 */
export const commerceLeadKeys = {
    all: ['commerce-leads'] as const,
    lists: () => [...commerceLeadKeys.all, 'list'] as const,
    list: (params: CommerceLeadsQueryParams) => [...commerceLeadKeys.lists(), params] as const
} as const;

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetches a paginated list of commerce leads from the admin API.
 * Unwraps the `{success, data: {items, pagination}}` envelope.
 */
async function fetchCommerceLeads(params: CommerceLeadsQueryParams): Promise<CommerceLeadsPage> {
    const searchParams = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize)
    });

    if (params.status) searchParams.set('status', params.status);
    if (params.domain) searchParams.set('domain', params.domain);

    const result = await fetchApi<{
        success: boolean;
        data: { items: CommerceLead[]; pagination: CommerceLeadPagination };
    }>({
        path: `/api/v1/admin/commerce/leads?${searchParams.toString()}`
    });

    return result.data.data;
}

/**
 * Calls POST /admin/commerce/leads/:id/handle with approve/reject + optional note.
 * Returns the updated `CommerceLead` entity.
 */
async function markLeadHandled(payload: MarkLeadHandledPayload): Promise<CommerceLead> {
    const { id, ...body } = payload;
    const result = await fetchApi<{ success: boolean; data: CommerceLead }>({
        path: `/api/v1/admin/commerce/leads/${id}/handle`,
        method: 'POST',
        body
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * TanStack Query hook — paginated list of commerce leads.
 *
 * @param params - Pagination + filter parameters.
 * @returns Standard `UseQueryResult` wrapping `CommerceLeadsPage`.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCommerceLeadsQuery({ page: 1, pageSize: 20 });
 * ```
 */
export const useCommerceLeadsQuery = (params: CommerceLeadsQueryParams) => {
    return useQuery({
        queryKey: commerceLeadKeys.list(params),
        queryFn: () => fetchCommerceLeads(params),
        staleTime: 30_000
    });
};

/**
 * TanStack mutation hook — mark a lead as approved or rejected.
 *
 * Invalidates the leads list on success so the inbox refreshes.
 *
 * @example
 * ```tsx
 * const mutation = useMarkLeadHandledMutation();
 * mutation.mutate({ id: lead.id, status: 'approved', adminNote: 'OK' });
 * ```
 */
export const useMarkLeadHandledMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: MarkLeadHandledPayload) => markLeadHandled(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: commerceLeadKeys.lists() });
        }
    });
};
