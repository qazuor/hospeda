/**
 * @file listing-media-upload.ts
 * @description The pure half of the listing photo editor (`MediaSection`):
 * the display item, row mappers, the bounded upload to the protected
 * `media/upload-entity` endpoint and its error wording. Split out of
 * `MediaSection.client.tsx` (902 lines) when it moved to the kit skin
 * (HOS-2489), with no behaviour change. See that file's header for the
 * persistence model (HOS-372).
 */

import type { Image } from '@repo/schemas';
import type { ListingMediaRow } from '@/lib/api/endpoints-protected';
import type { ApiError } from '@/lib/api/types';
import { getApiUrl } from '@/lib/env';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import type { MediaAttribution } from '@/lib/media';
import { resolveUploadTimeoutMs } from '@/lib/media/upload-entity';
import { buildUploadEntityError, describeUploadEntityError } from '@/lib/media/upload-entity-error';
import type { Translate } from './media-section-helpers';

/**
 * Display item used by this component's local state. Extends the DB row's
 * essentials with an `id` — empty (`''`) for SSR-only placeholders that have
 * not been hydrated from the API yet, which is what gates ops availability.
 */
export interface ListingMediaItem {
    readonly id: string;
    readonly url: string;
    readonly publicId?: string;
    readonly caption: string | undefined;
    /**
     * Longer photo description. Added by HOS-1036 alongside `attribution`:
     * both columns existed on the media tables from HOS-372 and were simply
     * never read here, because nothing in this section could write them.
     */
    readonly description: string | undefined;
    readonly alt: string | undefined;
    /** Photo credit, when the owner declared one. */
    readonly attribution: MediaAttribution | undefined;
    readonly isFeatured: boolean;
}

/**
 * Thrown when the upload exceeds its client-side budget.
 *
 * A distinct type because the browser's own abort error carries a
 * vendor-specific English message, and the catch path renders `err.message`
 * directly.
 */
export class UploadTimeoutError extends Error {
    constructor() {
        super('upload-timeout');
        this.name = 'UploadTimeoutError';
    }
}

/**
 * Map a `ListingMediaRow` (from the API) to the local display shape.
 */
export function rowToItem(row: ListingMediaRow): ListingMediaItem {
    return {
        id: row.id,
        url: row.url,
        publicId: row.publicId ?? undefined,
        caption: row.caption ?? undefined,
        description: row.description ?? undefined,
        alt: row.alt ?? undefined,
        attribution: row.attribution ?? undefined,
        isFeatured: row.isFeatured
    };
}

/**
 * Map a legacy `Image` (no DB id, SSR-only) to a partial display object.
 * Used only for the first-paint placeholder; once `listMedia` resolves,
 * these are replaced by real `ListingMediaItem` values that carry DB ids.
 * The empty id prevents any API call until the real rows load.
 */
export function legacyToDisplay(img: Image, isFeatured: boolean): ListingMediaItem {
    return {
        id: '',
        url: img.url,
        publicId: img.publicId ?? undefined,
        caption: img.caption ?? undefined,
        description: img.description ?? undefined,
        alt: img.alt ?? undefined,
        attribution: img.attribution ?? undefined,
        isFeatured
    };
}

/**
 * Upload a single image to the protected entity-upload endpoint. Unchanged
 * by HOS-372 — only what happens AFTER a successful upload changed (see the
 * file header).
 *
 * @returns The uploaded `Image` (Cloudinary url + metadata, moderationState APPROVED).
 */
export async function uploadEntityImage({
    file,
    vertical,
    listingId,
    role
}: {
    readonly file: File;
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
    readonly role: 'featured' | 'gallery';
}): Promise<Image> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', vertical);
    formData.append('entityId', listingId);
    formData.append('role', role);

    // Bounded like the accommodation editor's XHR helper (BETA-134). Without a
    // signal this `fetch` waits forever, so a stalled connection leaves the
    // owner on a spinner with no error and no way out but a reload — a risk
    // that grew with the raised size cap, since a bigger photo spends longer on
    // the wire. Uses the same size-scaled budget so both editors behave alike.
    //
    // `AbortController` + `setTimeout` rather than `AbortSignal.timeout`: the
    // latter needs Safari 16, and nothing else this app ships to a browser
    // requires anything that recent. On an older iOS it would not degrade — the
    // property access throws before `fetch` runs, breaking listing uploads
    // outright. This pairing also matches how the rest of the codebase cancels
    // requests.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), resolveUploadTimeoutMs(file.size));

    let response: Response;
    try {
        response = await fetch(`${getApiUrl()}/api/v1/protected/media/upload-entity`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            signal: controller.signal
        });
    } catch (error) {
        // An abort surfaces as a vendor-specific English DOMException whose
        // `message` would otherwise be rendered verbatim in a Spanish UI, since
        // `DOMException` satisfies `instanceof Error`. Re-throw a typed marker
        // the caller can translate.
        if (controller.signal.aborted) {
            throw new UploadTimeoutError();
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }

    const json = (await response.json().catch(() => null)) as {
        readonly success?: boolean;
        readonly data?: Image;
        readonly error?: {
            readonly code?: string;
            readonly reason?: string;
            readonly message?: string;
            readonly details?: unknown;
        };
    } | null;

    if (!response.ok || !json?.data) {
        throw buildUploadEntityError({ body: json, status: response.status });
    }
    return json.data;
}

/**
 * Turn an upload failure into a message worth showing.
 *
 * A timeout gets its own localized sentence: the browser's abort error carries
 * vendor-specific English text ("signal timed out"), and because `DOMException`
 * satisfies `instanceof Error`, a naive `err.message` would render it verbatim
 * in a Spanish UI.
 *
 * @param err - The thrown value
 * @param t - Active translator
 * @returns A user-facing message
 */
export function describeUploadError(err: unknown, t: Translate): string {
    if (err instanceof UploadTimeoutError) {
        return t(
            'listing.owner.editor.media.uploadTimeout',
            'La subida tardó demasiado. Probá de nuevo.'
        );
    }
    return describeUploadEntityError({
        err,
        t,
        fallback: t('listing.owner.editor.media.uploadFailed', 'Error al subir la imagen')
    });
}

/**
 * Whether an `addMedia` failure is the gallery cap rather than any other
 * error, for a multi-file batch upload (HOS-832, mirrors the accommodation
 * editor's `isPlanLimitReached` gate for the same reason — see below).
 *
 * Unlike accommodation, a venue or experience listing has no per-plan photo entitlement: its
 * gallery cap is the single fixed `getGalleryCap(vertical)` constant, already
 * checked against the WHOLE batch before any upload starts (see
 * `handleGallerySelect`). Under normal operation the server can therefore
 * never reject on this path — but a concurrent edit in another tab can still
 * fill the remaining slots between that client-side check and this file's
 * turn in the sequential loop, and the server enforces the same cap with
 * `ServiceErrorCode.QUOTA_EXCEEDED` (`packages/service-core/src/services/venue/venue.media.ts`,
 * `packages/service-core/src/services/experience/experience.media.ts`,
 * mapped to HTTP 429 — `apps/api/src/middlewares/response.ts`). Once that
 * happens every remaining file in the batch would fail identically, so the
 * caller stops instead of firing one toast per file.
 */
export function isGalleryQuotaExceeded(error: ApiError): boolean {
    return error.status === 429 && error.code === 'QUOTA_EXCEEDED';
}
