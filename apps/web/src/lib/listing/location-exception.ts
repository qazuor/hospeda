/**
 * @file location-exception.ts
 * @description Owner side of the location exception request (HOS-2192).
 *
 * Pure helpers for the "Pedir una excepción" flow: which state to show, whether
 * a reason is long enough, which i18n message a failed request maps to, and the
 * request call itself. The API owns every rule; this module only mirrors the
 * input limits (shared constants from `@repo/schemas`) and never decides who may
 * publish.
 */

import {
    LOCATION_EXCEPTION_REASON_MAX,
    LOCATION_EXCEPTION_REASON_MIN,
    LOCATION_EXCEPTION_REASONS,
    type LocationExceptionOwnerView,
    type LocationExceptionRequestCreated
} from '@repo/schemas';
import { apiClient } from '@/lib/api/client';
import type { ApiError, ApiResult } from '@/lib/api/types';

export { LOCATION_EXCEPTION_REASON_MAX, LOCATION_EXCEPTION_REASON_MIN };

/** Verticals that carry the one-address rule (an experience has no address). */
export type LocationExceptionVertical = 'accommodation' | 'venue';

/** Protected API plural per vertical. */
const PLURAL_BY_VERTICAL: Readonly<Record<LocationExceptionVertical, string>> = {
    accommodation: 'accommodations',
    venue: 'venues'
};

/**
 * What the owner sees in the location section.
 *
 * - `none`: no exception and no request for the current address.
 * - `pending`: a request is waiting for an admin.
 * - `approved`: an exception is in force, the listing can be published.
 * - `rejected`: the last request was rejected (the admin's reason is shown).
 */
export type LocationExceptionUiStatus = 'none' | 'pending' | 'approved' | 'rejected';

/**
 * Resolve the UI status from the protected projection's `locationException`.
 *
 * An exception in force always wins. A request that is `APPROVED` while no
 * exception is in force (it was revoked later) reads as `none`.
 *
 * @param input.locationException - The projection block, absent on older payloads.
 * @returns The status plus the admin's reason on a rejection.
 */
export function resolveLocationExceptionStatus({
    locationException
}: {
    readonly locationException: LocationExceptionOwnerView | null | undefined;
}): { readonly status: LocationExceptionUiStatus; readonly decisionReason: string | null } {
    if (!locationException) return { status: 'none', decisionReason: null };
    if (locationException.hasException) return { status: 'approved', decisionReason: null };
    const request = locationException.request;
    if (request?.status === 'PENDING') return { status: 'pending', decisionReason: null };
    if (request?.status === 'REJECTED') {
        return { status: 'rejected', decisionReason: request.decisionReason };
    }
    return { status: 'none', decisionReason: null };
}

/**
 * Whether the request button may be offered: only when the listing really
 * clashes (the API answers 409 NOT_NEEDED otherwise) and nothing is pending or
 * already granted.
 *
 * @param input.status - Resolved UI status.
 * @param input.locationDuplicate - The draft warning flag.
 */
export function canRequestLocationException({
    status,
    locationDuplicate
}: {
    readonly status: LocationExceptionUiStatus;
    readonly locationDuplicate: boolean;
}): boolean {
    return locationDuplicate && (status === 'none' || status === 'rejected');
}

/**
 * Validate the owner's reason against the shared limits (trimmed, like the API).
 *
 * @param input.reason - Raw textarea value.
 * @returns `ok`, the trimmed length and the i18n key of the problem when invalid.
 */
export function validateLocationExceptionReason({ reason }: { readonly reason: string }): {
    readonly ok: boolean;
    readonly length: number;
    readonly errorKey: 'tooShort' | 'tooLong' | null;
} {
    const length = reason.trim().length;
    if (length < LOCATION_EXCEPTION_REASON_MIN) return { ok: false, length, errorKey: 'tooShort' };
    if (length > LOCATION_EXCEPTION_REASON_MAX) return { ok: false, length, errorKey: 'tooLong' };
    return { ok: true, length, errorKey: null };
}

/** `error.reason` → the i18n sub-key (under `listing.owner.locationException.errors`). */
const ERROR_KEY_BY_REASON: Readonly<Record<string, string>> = {
    [LOCATION_EXCEPTION_REASONS.REQUEST_PENDING]: 'requestPending',
    [LOCATION_EXCEPTION_REASONS.ALREADY_GRANTED]: 'alreadyGranted',
    [LOCATION_EXCEPTION_REASONS.NOT_NEEDED]: 'notNeeded',
    [LOCATION_EXCEPTION_REASONS.NEEDS_KEY]: 'needsKey'
};

/**
 * Map a failed request to its i18n sub-key under
 * `listing.owner.locationException.errors`. Never the generic one for a known
 * conflict: 409 reasons, 400 (short or long reason) and 404 each have a message.
 *
 * @param input.error - The API error.
 * @returns The sub-key.
 */
export function mapLocationExceptionError({
    error
}: {
    readonly error: Pick<ApiError, 'status' | 'reason'>;
}): string {
    if (error.status === 409 && error.reason && ERROR_KEY_BY_REASON[error.reason]) {
        return ERROR_KEY_BY_REASON[error.reason] as string;
    }
    if (error.status === 400) return 'invalidReason';
    if (error.status === 404) return 'notFound';
    return 'generic';
}

/**
 * POST the owner's request for a location exception.
 *
 * @param input.vertical - `accommodation` or `venue`.
 * @param input.listingId - The listing id.
 * @param input.reason - The owner's reason (trimmed here).
 * @returns The created request or the API error.
 */
export function requestLocationException({
    vertical,
    listingId,
    reason
}: {
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    readonly reason: string;
}): Promise<ApiResult<LocationExceptionRequestCreated>> {
    return apiClient.postProtected<LocationExceptionRequestCreated>({
        path: `/api/v1/protected/${PLURAL_BY_VERTICAL[vertical]}/${listingId}/location-exception-request`,
        body: { reason: reason.trim() }
    });
}
