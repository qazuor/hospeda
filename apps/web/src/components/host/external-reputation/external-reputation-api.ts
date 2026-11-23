/**
 * @file external-reputation-api.ts
 * @description Fetch calls behind the external reputation section (HOS-2515).
 *
 * Every function resolves to a typed result and never throws: a network error,
 * a bad status or an env failure all become a failure result the caller maps to
 * its own copy.
 *
 * The base URL is resolved PER CALL (HOS-290): `getApiUrl()` runs the whole env
 * validation and THROWS when it fails, and this module is imported statically
 * by the editor island. A module-scope throw would take down the entire editor;
 * inside a call it degrades to this section's own error message.
 */

import {
    AccommodationExternalListingSchema,
    type AccommodationExternalListingsResponse,
    AccommodationExternalListingsResponseSchema
} from '@repo/schemas';
import { getApiUrl } from '@/lib/env';
import type { RefreshResultBody } from '@/lib/host/external-reputation-refresh';
import { hasNothingToRefresh } from '@/lib/host/external-reputation-refresh';
import {
    type ExternalPlatform,
    type ListingToggleField,
    retryAfterMinutes
} from './external-reputation-types';

/** Outcome of {@link loadExternalListings}. */
export type LoadListingsResult =
    | { readonly ok: true; readonly data: AccommodationExternalListingsResponse }
    | { readonly ok: false };

/** Outcome of {@link createExternalListing}. */
export type CreateListingResult =
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly kind: 'duplicate' | 'failed';
          /** Server-authored user-facing text, when the API sent any. */
          readonly message: string | null;
      };

/** Outcome of {@link requestRefresh}. */
export type RefreshResult =
    | { readonly kind: 'rateLimited'; readonly minutes: number }
    | { readonly kind: 'enqueued' }
    | { readonly kind: 'inline'; readonly nothingToRefresh: boolean }
    | { readonly kind: 'failed' };

/** Both error shapes the API can answer with (see {@link createExternalListing}). */
interface ErrorBody {
    readonly error?: {
        readonly code?: string;
        readonly message?: string;
        readonly details?: { readonly reason?: string };
        readonly userFriendlyMessage?: string;
        readonly summary?: string;
    };
}

/** Absolute API base + protected prefix. */
function protectedBase({ accommodationId }: { readonly accommodationId: string }): string {
    return `${getApiUrl()}/api/v1/protected/accommodations/${accommodationId}`;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/**
 * Loads the listings and the reputation metadata, parsed through the SHARED
 * schema: an inline cast would "type" whatever the server sent, which is how
 * this section once shipped broken (HOS-290).
 *
 * @param params - `accommodationId`.
 * @returns The parsed payload, or a failure.
 */
export async function loadExternalListings({
    accommodationId
}: {
    readonly accommodationId: string;
}): Promise<LoadListingsResult> {
    try {
        const res = await fetch(`${protectedBase({ accommodationId })}/external-listings`, {
            credentials: 'include'
        });
        if (!res.ok) return { ok: false };
        const envelope = (await res.json()) as { data: unknown };
        const parsed = AccommodationExternalListingsResponseSchema.safeParse(envelope.data);
        return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
    } catch {
        return { ok: false };
    }
}

/**
 * Persists the master visibility toggle. The route's body schema is
 * `{ value: boolean }` (HOS-290).
 *
 * @param params - `accommodationId` and the requested `value`.
 * @returns Whether the server accepted it.
 */
export async function saveMasterToggle({
    accommodationId,
    value
}: {
    readonly accommodationId: string;
    readonly value: boolean;
}): Promise<boolean> {
    try {
        const res = await fetch(
            `${protectedBase({ accommodationId })}/external-reputation/master-toggle`,
            {
                method: 'PATCH',
                credentials: 'include',
                headers: JSON_HEADERS,
                body: JSON.stringify({ value })
            }
        );
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Checks a URL with the exact server rule (HOS-190), so a malformed value is
 * caught before the POST.
 *
 * @param params - The trimmed `url`.
 * @returns Whether the URL passes the shared schema.
 */
export function isValidListingUrl({ url }: { readonly url: string }): boolean {
    return AccommodationExternalListingSchema.shape.url.safeParse(url).success;
}

/**
 * Creates a listing. `accommodationId` is deliberately absent from the body:
 * it comes from the path.
 *
 * The API has TWO error shapes: validation failures send
 * `{ messageKey, summary, userFriendlyMessage }`; a handler-thrown ServiceError
 * (e.g. DUPLICATE_PLATFORM) is serialized as `{ code, message, details }`.
 * `message` is NEVER returned: for an unexpected 500 it is raw driver text.
 *
 * @param params - Request fields.
 * @returns Success, or the failure kind with any server-authored message.
 */
export async function createExternalListing({
    accommodationId,
    platform,
    url,
    showLink,
    showReviews
}: {
    readonly accommodationId: string;
    readonly platform: ExternalPlatform;
    readonly url: string;
    readonly showLink: boolean;
    readonly showReviews: boolean;
}): Promise<CreateListingResult> {
    try {
        const res = await fetch(`${protectedBase({ accommodationId })}/external-listings`, {
            method: 'POST',
            credentials: 'include',
            headers: JSON_HEADERS,
            body: JSON.stringify({ platform, url, showLink, showReviews })
        });
        if (res.ok) return { ok: true };
        const body = (await res.json().catch(() => ({}))) as ErrorBody;
        const isDuplicate =
            body.error?.details?.reason === 'DUPLICATE_PLATFORM' ||
            body.error?.code === 'DUPLICATE_PLATFORM';
        return {
            ok: false,
            kind: isDuplicate ? 'duplicate' : 'failed',
            message: body.error?.userFriendlyMessage ?? body.error?.summary ?? null
        };
    } catch {
        return { ok: false, kind: 'failed', message: null };
    }
}

/**
 * Persists one visibility flag of a listing.
 *
 * @param params - Ids, the `field` and its new `value`.
 * @returns Whether the server accepted it.
 */
export async function saveListingToggle({
    accommodationId,
    listingId,
    field,
    value
}: {
    readonly accommodationId: string;
    readonly listingId: string;
    readonly field: ListingToggleField;
    readonly value: boolean;
}): Promise<boolean> {
    try {
        const res = await fetch(
            `${protectedBase({ accommodationId })}/external-listings/${listingId}`,
            {
                method: 'PATCH',
                credentials: 'include',
                headers: JSON_HEADERS,
                body: JSON.stringify({ [field]: value })
            }
        );
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Deletes a listing.
 *
 * @param params - Ids.
 * @returns Whether the server accepted it.
 */
export async function deleteExternalListing({
    accommodationId,
    listingId
}: {
    readonly accommodationId: string;
    readonly listingId: string;
}): Promise<boolean> {
    try {
        const res = await fetch(
            `${protectedBase({ accommodationId })}/external-listings/${listingId}`,
            { method: 'DELETE', credentials: 'include' }
        );
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Asks the server to refresh the reputation. A 202 means Apify runs were
 * enqueued (poll the status); a 200 resolved inline, and with all three lists
 * empty it means NO platform was queried (HOS-1944).
 *
 * @param params - `accommodationId`.
 * @returns The refresh outcome.
 */
export async function requestRefresh({
    accommodationId
}: {
    readonly accommodationId: string;
}): Promise<RefreshResult> {
    try {
        const res = await fetch(
            `${protectedBase({ accommodationId })}/external-reputation/refresh`,
            {
                method: 'POST',
                credentials: 'include'
            }
        );
        if (res.status === 429) {
            const body = (await res.json().catch(() => null)) as {
                error?: { details?: { retryAfter?: number } };
            } | null;
            return {
                kind: 'rateLimited',
                minutes: retryAfterMinutes(
                    body?.error?.details?.retryAfter ?? res.headers.get('Retry-After')
                )
            };
        }
        if (res.status === 202) return { kind: 'enqueued' };
        if (!res.ok) return { kind: 'failed' };
        const body = (await res.json().catch(() => null)) as { data?: RefreshResultBody } | null;
        return { kind: 'inline', nothingToRefresh: hasNothingToRefresh({ result: body?.data }) };
    } catch {
        return { kind: 'failed' };
    }
}
