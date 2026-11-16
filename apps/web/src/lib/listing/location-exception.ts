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
    type LocationExceptionRequestCreated,
    type LocationExceptionTarget
} from '@repo/schemas';
import { apiClient } from '@/lib/api/client';
import type { ApiError, ApiResult } from '@/lib/api/types';

export type { LocationExceptionTarget };
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
 * - `approvedMove`: a request for the address the owner wants to MOVE to was
 *   approved; it stays dormant until the owner saves that address.
 * - `rejected`: the last request was rejected (the admin's reason is shown).
 */
export type LocationExceptionUiStatus =
    | 'none'
    | 'pending'
    | 'approved'
    | 'approvedMove'
    | 'rejected';

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
}): {
    readonly status: LocationExceptionUiStatus;
    readonly decisionReason: string | null;
    /** `true` when the request is for an address the listing is not at yet (a move). */
    readonly targetsNewAddress: boolean;
} {
    const none = { status: 'none', decisionReason: null, targetsNewAddress: false } as const;
    if (!locationException) return none;
    if (locationException.hasException) return { ...none, status: 'approved' };
    const request = locationException.request;
    if (!request) return none;
    const targetsNewAddress = request.targetsNewAddress;
    if (request.status === 'PENDING') return { ...none, status: 'pending', targetsNewAddress };
    if (request.status === 'APPROVED' && targetsNewAddress) {
        return { ...none, status: 'approvedMove', targetsNewAddress };
    }
    if (request.status === 'REJECTED') {
        return { status: 'rejected', decisionReason: request.decisionReason, targetsNewAddress };
    }
    return none;
}

/**
 * Whether the section panel may offer the request button: only when the saved
 * address really clashes (the API answers 409 NOT_NEEDED otherwise) and nothing
 * is pending or already granted.
 *
 * A rejected MOVE request is not asked again from here: the panel does not know
 * the address the owner was trying to save, so the owner re-saves and the
 * refused save offers the button again with that address.
 *
 * @param input.status - Resolved UI status.
 * @param input.locationDuplicate - The draft warning flag.
 * @param input.targetsNewAddress - The latest request is a move request.
 */
export function canRequestLocationException({
    status,
    locationDuplicate,
    targetsNewAddress = false
}: {
    readonly status: LocationExceptionUiStatus;
    readonly locationDuplicate: boolean;
    readonly targetsNewAddress?: boolean;
}): boolean {
    if (status === 'rejected' && targetsNewAddress) return false;
    return locationDuplicate && (status === 'none' || status === 'rejected');
}

/**
 * Build the address of a move request from the values the owner submitted. The
 * server recomputes the key from it, so only what was typed is sent.
 *
 * @param input - The submitted street, number, floor and apartment.
 * @returns The target, or `null` when street or number is blank (nothing to request for).
 */
export function buildLocationExceptionTarget({
    street,
    number,
    floor,
    apartment
}: {
    readonly street: string;
    readonly number: string;
    readonly floor?: string;
    readonly apartment?: string;
}): LocationExceptionTarget | null {
    const target: { street: string; number: string; floor?: string; apartment?: string } = {
        street: street.trim(),
        number: number.trim()
    };
    if (!target.street || !target.number) return null;
    if (floor?.trim()) target.floor = floor.trim();
    if (apartment?.trim()) target.apartment = apartment.trim();
    return target;
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
 * @param input.location - The address the owner was trying to save (a move request). Never a key.
 * @returns The created request or the API error.
 */
export function requestLocationException({
    vertical,
    listingId,
    reason,
    location
}: {
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    readonly reason: string;
    readonly location?: LocationExceptionTarget;
}): Promise<ApiResult<LocationExceptionRequestCreated>> {
    return apiClient.postProtected<LocationExceptionRequestCreated>({
        path: `/api/v1/protected/${PLURAL_BY_VERTICAL[vertical]}/${listingId}/location-exception-request`,
        body: location ? { reason: reason.trim(), location } : { reason: reason.trim() }
    });
}
