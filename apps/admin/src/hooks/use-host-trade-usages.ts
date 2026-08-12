/**
 * @file use-host-trade-usages.ts
 * @description TanStack Query hooks for the benefit-usage audit screen
 * (HOS-376 T-056).
 *
 * Mirrors `use-host-trade-moderation.ts`: a query-key factory, typed response
 * shapes, API helpers, and named export hooks.
 *
 * TWO READS, ONE DECISION. The usage listing answers "is this provider
 * manufacturing usages?" and the suspension listing answers "who is blocked
 * right now?" — they come from different endpoints and neither is a filter of
 * the other. What joins them is the write: suspending and lifting are the same
 * endpoint with a boolean, so the screen can never grow a "suspend" button that
 * silently lifts.
 */

import type { HostTradeAdmin, HostTradeBenefitUsageAdmin } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Query keys for the audit screen's two reads.
 *
 * They branch under a shared root so a suspension decision can invalidate both
 * at once: lifting a suspension changes the suspension list AND the state of
 * every usage row belonging to that provider.
 */
export const hostTradeUsageQueryKeys = {
    all: ['host-trade-usages'] as const,
    usages: () => [...hostTradeUsageQueryKeys.all, 'usages'] as const,
    usageList: (filters: HostTradeUsageFilters) =>
        [...hostTradeUsageQueryKeys.usages(), filters] as const,
    suspensions: () => [...hostTradeUsageQueryKeys.all, 'suspensions'] as const,
    suspensionList: (page: number) => [...hostTradeUsageQueryKeys.suspensions(), page] as const
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four states a usage row can be read in. */
export type UsageStatusFilter = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';

/** Which side opened the record. */
export type UsageDeclaredByFilter = 'HOST' | 'PROVIDER';

/** How the record was opened. */
export type UsageChannelFilter = 'QR' | 'LINKED_SELECTOR' | 'EMAIL_LOOKUP';

/** Pagination metadata returned by the API. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Filters accepted by `GET /admin/host-trades/usages`. */
export interface HostTradeUsageFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly status?: UsageStatusFilter;
    readonly declaredBy?: UsageDeclaredByFilter;
    readonly creationChannel?: UsageChannelFilter;
    readonly hostTradeId?: string;
    readonly hostUserId?: string;
    readonly createdAfter?: string;
    readonly createdBefore?: string;
}

/** A paginated page of either read. */
interface AdminListResponse<TItem> {
    readonly success: boolean;
    readonly data: {
        readonly items: TItem[];
        readonly pagination: PaginationMeta;
    };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Serialises a filter object into query params, dropping what was not set.
 *
 * `undefined`, `null` and the empty string are omitted rather than sent as the
 * literal strings the URL would otherwise carry — an empty `status=` reaches
 * the API as a value it must reject, and `createAdminListRoute` refuses unknown
 * or unparseable params outright rather than ignoring them.
 *
 * @param filters - The filter object to serialise.
 * @returns The encoded query string, without a leading `?`.
 */
function buildQuery(filters: object): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') {
            continue;
        }
        params.set(key, String(value));
    }
    return params.toString();
}

async function fetchUsages(
    filters: HostTradeUsageFilters
): Promise<AdminListResponse<HostTradeBenefitUsageAdmin>['data']> {
    const query = buildQuery(filters);
    const result = await fetchApi<AdminListResponse<HostTradeBenefitUsageAdmin>>({
        path: `/api/v1/admin/host-trades/usages${query ? `?${query}` : ''}`
    });
    return result.data.data;
}

async function fetchSuspendedProviders(
    page: number
): Promise<AdminListResponse<HostTradeAdmin>['data']> {
    const query = buildQuery({ declarationSuspended: true, page, pageSize: 25 });
    const result = await fetchApi<AdminListResponse<HostTradeAdmin>>({
        path: `/api/v1/admin/host-trades?${query}`
    });
    return result.data.data;
}

async function setDeclarationSuspension(input: {
    hostTradeId: string;
    suspended: boolean;
    reason?: string;
}): Promise<{ suspended: boolean }> {
    const body: Record<string, unknown> = { suspended: input.suspended };
    // Sent only when suspending: the endpoint requires a reason to suspend and
    // takes none to lift, and a strict body rejects the extra key outright.
    if (input.suspended && input.reason !== undefined && input.reason !== '') {
        body.reason = input.reason;
    }

    const result = await fetchApi<{ data: { suspended: boolean } }>({
        path: `/api/v1/admin/host-trades/${input.hostTradeId}/declaration-suspension`,
        method: 'POST',
        body
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches a page of benefit usages — every state unless filtered.
 *
 * @param filters - Pagination and filter parameters.
 * @returns A TanStack Query result holding the page and its pagination.
 */
export function useHostTradeUsages(filters: HostTradeUsageFilters = {}) {
    return useQuery({
        queryKey: hostTradeUsageQueryKeys.usageList(filters),
        queryFn: () => fetchUsages(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches the providers whose declaring is currently suspended.
 *
 * Scoped to `declarationSuspended=true` at the API, never filtered client-side:
 * a suspension is rare by design, so the rows that matter would sit on page
 * seventeen of the directory.
 *
 * @param page - The page to read.
 * @returns A TanStack Query result holding the page and its pagination.
 */
export function useSuspendedProviders(page = 1) {
    return useQuery({
        queryKey: hostTradeUsageQueryKeys.suspensionList(page),
        queryFn: () => fetchSuspendedProviders(page),
        staleTime: 30_000
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Suspends a provider from declaring, or lifts an existing suspension.
 *
 * Invalidates the whole root rather than just the suspension list: a provider
 * who is suspended (or released) changes what the usage rows below him mean,
 * and the two lists must never disagree about his state.
 *
 * @returns A TanStack Query mutation result.
 */
export function useSetDeclarationSuspension() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: setDeclarationSuspension,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: hostTradeUsageQueryKeys.all });
        }
    });
}
