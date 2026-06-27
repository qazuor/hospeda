/**
 * Commerce Leads — TanStack Query hooks.
 *
 * Provides:
 *  - `commerceLeadKeys`          — stable query-key factory.
 *  - `useCommerceLeadsQuery`     — paginated list of leads (GET /admin/commerce/leads).
 *  - `useMarkLeadHandledMutation`— POST /admin/commerce/leads/:id/handle (approve/reject).
 *  - `useProvisionOwnerMutation` — POST /admin/commerce/leads/:id/provision-owner.
 *
 * All fetchers unwrap the `{success, data: {items, pagination}}` API envelope.
 * Gate: COMMERCE_VIEW_ALL (list) / COMMERCE_EDIT_ALL (mutations).
 */

import { fetchApi } from '@/lib/api/client';
import type { CommerceLead } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

/** Response from the provision-owner endpoint. */
export type ProvisionOwnerResult = {
    readonly userId: string;
    readonly email: string;
    readonly name: string;
};

/** Payload for the combined approve-and-provision mutation (SPEC-249 Part D). */
export type ApproveAndProvisionPayload = {
    readonly id: string;
    readonly adminNote?: string;
};

/** Response from the approve-and-provision endpoint. */
export type ApproveAndProvisionResult = {
    readonly lead: CommerceLead;
    readonly userId: string;
    /** `true` when a new owner account was created; `false` when already provisioned. */
    readonly provisioned: boolean;
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

/**
 * Calls POST /admin/commerce/leads/:id/provision-owner.
 * Creates the COMMERCE_OWNER account and emails temp credentials.
 * Returns `{userId, email, name}` — NEVER a password.
 */
async function provisionOwner(id: string): Promise<ProvisionOwnerResult> {
    const result = await fetchApi<{ success: boolean; data: ProvisionOwnerResult }>({
        path: `/api/v1/admin/commerce/leads/${id}/provision-owner`,
        method: 'POST',
        body: {}
    });
    return result.data.data;
}

/**
 * Calls POST /admin/commerce/leads/:id/approve-and-provision.
 * Approves the lead AND provisions its COMMERCE_OWNER account in one action.
 * Idempotent server-side via `lead.provisionedUserId`. Returns
 * `{lead, userId, provisioned}` — NEVER a password.
 */
async function approveAndProvision(
    payload: ApproveAndProvisionPayload
): Promise<ApproveAndProvisionResult> {
    const { id, ...body } = payload;
    const result = await fetchApi<{ success: boolean; data: ApproveAndProvisionResult }>({
        path: `/api/v1/admin/commerce/leads/${id}/approve-and-provision`,
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

/**
 * TanStack mutation hook — provision a COMMERCE_OWNER account for a lead.
 *
 * Creates the user and emails temp credentials.  Invalidates the leads list on
 * success (so the lead's `handledAt` / `status` are refreshed from the server).
 * The returned `ProvisionOwnerResult` includes `{userId, email, name}` — the
 * temp password is NEVER included in the response.
 *
 * @example
 * ```tsx
 * const mutation = useProvisionOwnerMutation();
 * const result = await mutation.mutateAsync(lead.id);
 * // result.email — show in success toast
 * ```
 */
export const useProvisionOwnerMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => provisionOwner(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: commerceLeadKeys.lists() });
        }
    });
};

/**
 * TanStack mutation hook — approve a lead AND provision its owner in one action
 * (SPEC-249 Part D). Invalidates the leads list on success so the inbox
 * reflects the new `status` / `provisionedUserId`.
 *
 * @example
 * ```tsx
 * const mutation = useApproveAndProvisionMutation();
 * const result = await mutation.mutateAsync({ id: lead.id, adminNote: 'OK' });
 * ```
 */
export const useApproveAndProvisionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ApproveAndProvisionPayload) => approveAndProvision(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: commerceLeadKeys.lists() });
        }
    });
};
