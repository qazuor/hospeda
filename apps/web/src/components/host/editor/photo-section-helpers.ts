/**
 * @file photo-section-helpers.ts
 * @description Pure helper functions for `PhotoSection.client.tsx` (HOS-122).
 *
 * Extracted so the component file stays under the repo's 500-line ceiling
 * once multi-file upload, drag & drop, and manual reordering were added, and
 * so file validation / array reordering / row-splitting logic is unit
 * testable in isolation from React rendering.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import type { AccommodationMediaRow } from '@/lib/api/endpoints-protected';
import type { AccommodationMediaItem } from '@/lib/api/types';

/**
 * Translator function shape used across the editor — mirrors
 * `createTranslations(locale).t`.
 */
export type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, unknown>
) => string;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Validate a single file's MIME type and size against the shared entity
 * upload limits.
 *
 * @param file - The file selected or dropped by the user
 * @param t - Active translator
 * @returns A localized error message, or `null` when the file is valid
 */
export function validatePhotoFile(file: File, t: Translate): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
        return t(
            'host.properties.editor.photo.invalidType',
            'Solo se permiten archivos JPG, PNG o WebP'
        );
    }
    if (file.size > mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB)) {
        return t(
            'host.properties.editor.photo.tooLarge',
            'El archivo no puede superar {{maxSize}}MB',
            { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
        );
    }
    return null;
}

/**
 * Build the message shown when a multi-file selection (or drop) would
 * exceed the remaining gallery slots. Reported BEFORE any upload starts —
 * the host must know their whole batch was rejected up front, not discover
 * it after some files already uploaded.
 */
export function buildCapExceededOnSelectMessage({
    selectedCount,
    remainingSlots,
    cap,
    t
}: {
    readonly selectedCount: number;
    readonly remainingSlots: number;
    readonly cap: number;
    readonly t: Translate;
}): string {
    return t(
        'host.properties.editor.photo.galleryCapExceededOnSelect',
        'Elegiste {{selected}} fotos pero solo quedan {{remaining}} lugares libres (máx. {{cap}} en total)',
        { selected: selectedCount, remaining: Math.max(remainingSlots, 0), cap }
    );
}

/**
 * Move an array item from one index to another, returning a NEW array
 * (never mutates the input). Out-of-range indexes are a no-op copy.
 *
 * @param items - Source array
 * @param fromIndex - Index of the item to move
 * @param toIndex - Destination index
 * @returns A new array with the item relocated
 */
export function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
    if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= items.length ||
        toIndex >= items.length
    ) {
        return [...items];
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) {
        return next;
    }
    next.splice(toIndex, 0, moved);
    return next;
}

/**
 * Build the `orderedIds` payload for `accommodationMediaApi.reorderMedia`.
 *
 * The service validates the supplied set against ALL currently visible
 * rows — which includes the featured (portada) row, not just the gallery —
 * so the featured id (when present) must be included even though it never
 * moves in the UI.
 */
export function buildReorderPayload({
    featuredId,
    galleryIds
}: {
    readonly featuredId: string | null;
    readonly galleryIds: readonly string[];
}): readonly string[] {
    return featuredId ? [featuredId, ...galleryIds] : [...galleryIds];
}

/** Map an `AccommodationMediaRow` (API) to the local display item shape. */
export function mediaRowToItem(row: AccommodationMediaRow): AccommodationMediaItem {
    return {
        id: row.id,
        url: row.url,
        publicId: row.publicId ?? '',
        caption: row.caption,
        alt: row.alt,
        isFeatured: row.isFeatured
    };
}

/**
 * Split a full list of visible media rows (as returned by `listMedia` or
 * echoed back by `reorderMedia`) into the featured slot and the ordered
 * gallery array.
 */
export function splitMediaRows(rows: readonly AccommodationMediaRow[]): {
    readonly featured: AccommodationMediaItem | null;
    readonly gallery: readonly AccommodationMediaItem[];
} {
    const featuredRow = rows.find((r) => r.isFeatured) ?? null;
    const galleryRows = rows.filter((r) => !r.isFeatured);
    return {
        featured: featuredRow ? mediaRowToItem(featuredRow) : null,
        gallery: galleryRows.map(mediaRowToItem)
    };
}
