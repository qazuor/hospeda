/**
 * @file hooks.ts
 * TanStack Query hooks and helpers of the location-exception feature (HOS-2192):
 * the admin queue of owner requests, its approve/reject decisions, and a
 * listing's exception state with its revoke/grant actions.
 *
 * @module location-exception-requests/hooks
 */

import type {
    LocationExceptionDecisionResult,
    LocationExceptionRequestStatus,
    LocationExceptionRequestsResponse,
    LocationExceptionState
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';

/** The two verticals the one-address rule covers. */
export type LocationExceptionVertical = 'accommodations' | 'venues';

/** Query-key root of the request queue. */
export const LOCATION_EXCEPTION_REQUESTS_QUERY_KEY = ['location-exception-requests'] as const;

/** Query-key root of a listing's exception state. */
export const LOCATION_EXCEPTION_STATE_QUERY_KEY = ['location-exception-state'] as const;

/**
 * Builds the admin path of the queue, of a decision, or of a listing's exception.
 *
 * @param input.vertical - `accommodations` or `venues`.
 * @param input.requestId - Request id, for a decision.
 * @param input.decision - `approve` or `reject`, with `requestId`.
 * @param input.listingId - Listing id, for the exception route.
 * @returns The `/api/v1/admin/...` path.
 */
export function buildLocationExceptionPath({
    vertical,
    requestId,
    decision,
    listingId
}: {
    readonly vertical: LocationExceptionVertical;
    readonly requestId?: string;
    readonly decision?: 'approve' | 'reject';
    readonly listingId?: string;
}): string {
    if (listingId) return `/api/v1/admin/${vertical}/${listingId}/location-exception`;
    const base = `/api/v1/admin/${vertical}/location-exception-requests`;
    return requestId && decision ? `${base}/${requestId}/${decision}` : base;
}

/** What the admin UI needs from a refused exception call. */
export interface LocationExceptionErrorInfo {
    readonly status: number | undefined;
    /** Top-level `error.reason` (one of `LOCATION_EXCEPTION_REASONS`). */
    readonly reason: string | undefined;
    /** Colliding listing of a `REVOKE_CONFLICT`, from `error.details`. */
    readonly existingListingId: string | undefined;
}

/**
 * Reads the machine-readable parts of an API error body. `fetchApi` keeps the raw
 * body on the error, where the envelope is `{ error: { reason, details } }`.
 *
 * @param error - Whatever a mutation threw.
 * @returns The status, `reason` and `existingListingId`, each possibly absent.
 */
export function readLocationExceptionError(error: unknown): LocationExceptionErrorInfo {
    if (!isApiError(error)) {
        return { status: undefined, reason: undefined, existingListingId: undefined };
    }
    const envelope = (error.body as { error?: Record<string, unknown> } | undefined)?.error;
    const details = (envelope?.details ?? error.details) as Record<string, unknown> | null;
    const reason = envelope?.reason ?? details?.reason;
    const existing = details?.existingListingId;
    return {
        status: error.status,
        reason: typeof reason === 'string' ? reason : undefined,
        existingListingId: typeof existing === 'string' ? existing : undefined
    };
}

/**
 * Reads one page of the request queue for a vertical and status.
 *
 * @returns A TanStack Query result.
 */
export function useLocationExceptionRequestsQuery({
    vertical,
    status,
    page,
    pageSize
}: {
    readonly vertical: LocationExceptionVertical;
    readonly status: LocationExceptionRequestStatus;
    readonly page: number;
    readonly pageSize: number;
}) {
    return useQuery({
        queryKey: [...LOCATION_EXCEPTION_REQUESTS_QUERY_KEY, vertical, status, page, pageSize],
        queryFn: async () => {
            const response = await fetchApi<{ data: LocationExceptionRequestsResponse }>({
                path: `${buildLocationExceptionPath({ vertical })}?status=${status}&page=${page}&pageSize=${pageSize}`
            });
            return response.data.data;
        }
    });
}

/**
 * Approves or rejects a request. The queue is refetched on success AND on a 409
 * (the request was already resolved or went stale, so the list is out of date).
 *
 * @returns A mutation taking `{ vertical, requestId, decision, reason }`.
 */
export function useDecideLocationExceptionRequestMutation() {
    const queryClient = useQueryClient();
    const refresh = () =>
        queryClient.invalidateQueries({ queryKey: LOCATION_EXCEPTION_REQUESTS_QUERY_KEY });
    return useMutation({
        mutationFn: async (input: {
            readonly vertical: LocationExceptionVertical;
            readonly requestId: string;
            readonly decision: 'approve' | 'reject';
            readonly reason: string;
        }) => {
            const response = await fetchApi<{ data: LocationExceptionDecisionResult }>({
                path: buildLocationExceptionPath(input),
                method: 'POST',
                body: { reason: input.reason }
            });
            return response.data.data;
        },
        onSuccess: refresh,
        onError: (error) => {
            if (readLocationExceptionError(error).status === 409) refresh();
        }
    });
}

/**
 * Reads a listing's exception in force and its audit history.
 *
 * @param input.enabled - Skip the call (no permission) when false.
 * @returns A TanStack Query result.
 */
export function useLocationExceptionStateQuery({
    vertical,
    listingId,
    enabled = true
}: {
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    readonly enabled?: boolean;
}) {
    return useQuery({
        queryKey: [...LOCATION_EXCEPTION_STATE_QUERY_KEY, vertical, listingId],
        enabled,
        queryFn: async () => {
            const response = await fetchApi<{ data: LocationExceptionState }>({
                path: buildLocationExceptionPath({ vertical, listingId })
            });
            return response.data.data;
        }
    });
}

/**
 * Revokes (`DELETE`, optional JSON body) or grants (`POST`) a listing's exception.
 * The state is refetched afterwards.
 *
 * @returns A mutation taking `{ vertical, listingId, action, reason }`; for
 *   `revoke` the reason may be omitted and then no body is sent.
 */
export function useChangeLocationExceptionMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            readonly vertical: LocationExceptionVertical;
            readonly listingId: string;
            readonly action: 'revoke' | 'grant';
            readonly reason?: string;
        }) => {
            await fetchApi({
                path: buildLocationExceptionPath(input),
                method: input.action === 'revoke' ? 'DELETE' : 'POST',
                ...(input.reason === undefined ? {} : { body: { reason: input.reason } })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: LOCATION_EXCEPTION_STATE_QUERY_KEY });
        }
    });
}
