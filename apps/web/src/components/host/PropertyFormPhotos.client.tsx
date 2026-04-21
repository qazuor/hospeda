/**
 * @file PropertyFormPhotos.client.tsx
 * @description Section 5 — Photos upload section for the PropertyForm wizard.
 * Embeds AccommodationImageUploader. Converts the media.gallery schema array
 * ({ url, caption?, description?, moderationState } items) to a plain URL
 * array for the uploader, and converts back on change.
 *
 * Upload endpoint note (TODO before real beta): POST /api/v1/admin/media/upload
 * currently requires ADMIN permission. HOST users will receive 403 until the
 * SPEC-078 permission gap is resolved. The component is wired but will fail
 * for non-admin users in production until that gap is closed.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { ModerationStatusEnum } from '@repo/schemas';
import { AccommodationImageUploader } from './AccommodationImageUploader.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a single gallery image entry as stored in form state. */
type GalleryItem = {
    readonly url: string;
    readonly caption?: string;
    readonly description?: string;
    readonly moderationState: ModerationStatusEnum;
};

/** Props for PropertyFormPhotos. */
export type PropertyFormPhotosProps = {
    /**
     * Current gallery array from form state (`media.gallery`).
     * Schema shape: `Array<{ url, caption?, description?, moderationState }>`.
     */
    readonly gallery: ReadonlyArray<GalleryItem> | undefined;
    /**
     * Called when the gallery changes (upload or remove).
     * Receives the updated full gallery array.
     */
    readonly onChange: (gallery: ReadonlyArray<GalleryItem>) => void;
    /**
     * Accommodation UUID used by the upload endpoint.
     * May be undefined before the first autosave creates the record.
     */
    readonly entityId?: string;
    /** API base URL. */
    readonly apiUrl: string;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
    /** Maximum gallery images. Defaults to 20. */
    readonly maxImages?: number;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Section 5 — Photos upload for the PropertyForm wizard.
 *
 * Adapts the `AccommodationImageUploader` (which works with plain URL arrays)
 * to the form's `media.gallery` schema shape (object array with metadata).
 * New uploads are stored with `moderationState: PENDING`.
 *
 * @example
 * ```tsx
 * <PropertyFormPhotos
 *   gallery={form.values.media?.gallery}
 *   onChange={(items) => form.setValue('media.gallery', items)}
 *   entityId={accommodationId}
 *   apiUrl={apiUrl}
 *   locale={locale}
 * />
 * ```
 */
export function PropertyFormPhotos({
    gallery,
    onChange,
    entityId,
    apiUrl,
    locale,
    maxImages = 20
}: PropertyFormPhotosProps) {
    // Extract plain URL array from gallery object array for the uploader.
    const urls: ReadonlyArray<string> = (gallery ?? []).map((item) => item.url);

    /**
     * Called by AccommodationImageUploader with the full updated URL array.
     * Re-builds the gallery object array, preserving existing metadata where
     * the URL already exists, and using defaults for new URLs.
     */
    function handleUrlsChange(newUrls: ReadonlyArray<string>): void {
        const existingByUrl = new Map<string, GalleryItem>(
            (gallery ?? []).map((item) => [item.url, item])
        );

        const newGallery: ReadonlyArray<GalleryItem> = newUrls.map((url) => {
            const existing = existingByUrl.get(url);
            if (existing) {
                return existing;
            }
            // New URL: create a gallery item with PENDING moderation.
            return {
                url,
                moderationState: ModerationStatusEnum.PENDING
            };
        });

        onChange(newGallery);
    }

    return (
        <AccommodationImageUploader
            value={urls}
            onChange={handleUrlsChange}
            entityId={entityId}
            apiUrl={apiUrl}
            maxImages={maxImages}
            locale={locale}
        />
    );
}
