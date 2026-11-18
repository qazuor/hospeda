/**
 * Alliance Leads — TanStack Query hooks.
 *
 * Provides:
 *  - `allianceLeadKeys`           — stable query-key factory.
 *  - `useAllianceLeadsQuery`      — paginated list of leads (GET /admin/alliance/leads).
 *  - `useMarkAllianceLeadHandledMutation` — POST /admin/alliance/leads/:id/mark-handled
 *    (approve/reject). Approving a `service_provider` lead provisions its directory
 *    listing server-side; the response carries the optional `provisioning` outcome
 *    (HOS-2339).
 *  - `useProvisionAllianceLeadMutation` — POST /admin/alliance/leads/:id/provision,
 *    the dedicated retry for an approval that skipped provisioning. It never
 *    re-sends the approval email (HOS-2339).
 *
 * All fetchers unwrap the `{success, data: {items, pagination}}` API envelope.
 * Gate: ALLIANCE_LEAD_VIEW_ALL (list) / ALLIANCE_LEAD_MANAGE (mutations).
 *
 * Partner leads are still provisioned through a separate action
 * (approve-and-provision-partner); there is no mutation for it here yet.
 */

import type {
    AllianceLead,
    AllianceLeadKind,
    AllianceLeadStatus,
    AllianceLeadWithProvisioning
} from '@repo/schemas';
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
 * optional note. Returns the updated lead plus, for an approved
 * `service_provider`, the provisioning outcome.
 */
async function markAllianceLeadHandled(
    payload: MarkAllianceLeadHandledPayload
): Promise<AllianceLeadWithProvisioning> {
    const { id, ...body } = payload;
    const result = await fetchApi<{ success: boolean; data: AllianceLeadWithProvisioning }>({
        path: `/api/v1/admin/alliance/leads/${id}/mark-handled`,
        method: 'POST',
        body
    });
    return result.data.data;
}

/**
 * Calls POST /admin/alliance/leads/:id/provision (no body). Returns the lead
 * plus the provisioning outcome.
 */
async function provisionAllianceLead(payload: {
    readonly id: string;
}): Promise<AllianceLeadWithProvisioning> {
    const result = await fetchApi<{ success: boolean; data: AllianceLeadWithProvisioning }>({
        path: `/api/v1/admin/alliance/leads/${payload.id}/provision`,
        method: 'POST'
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
 * Invalidates the leads list on success so the inbox refreshes. The resolved
 * value carries the provisioning outcome of a `service_provider` approval.
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

/**
 * TanStack mutation hook — retry provisioning of an approved `service_provider`
 * lead (HOS-2339). Invalidates the leads list on success so the "provider not
 * created" badge refreshes.
 *
 * @example
 * ```tsx
 * const mutation = useProvisionAllianceLeadMutation();
 * const result = await mutation.mutateAsync({ id: lead.id });
 * ```
 */
export const useProvisionAllianceLeadMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { readonly id: string }) => provisionAllianceLead(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: allianceLeadKeys.lists() });
        }
    });
};
