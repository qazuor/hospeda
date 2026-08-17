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
import type { MediaAttribution } from '@/lib/media';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';

/**
 * Translator function shape used across the editor — mirrors
 * `createTranslations(locale).t`.
 */
export type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, unknown>
) => string;

/**
 * Count-aware translator. Mirrors `createTranslations().tPlural` — the count is
 * the SECOND argument, unlike `Translate`, where the second slot is the
 * fallback.
 */
export type PluralTranslate = (
    key: string,
    count: number,
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
    t,
    tPlural
}: {
    readonly selectedCount: number;
    readonly remainingSlots: number;
    readonly cap: number;
    readonly t: Translate;
    readonly tPlural: PluralTranslate;
}): string {
    // Two independent counts, so two pairs composed in rather than one. A
    // single `_one`/`_other` pair cannot express both: picking one photo with
    // several slots free needs the singular in one half and the plural in the
    // other. `cap` takes no pair — "máx. {{cap}} en total" has no noun to
    // inflect.
    const remaining = Math.max(remainingSlots, 0);
    return t(
        'host.properties.editor.photo.galleryCapExceededOnSelect',
        'Elegiste {{pickedPhrase}} pero solo queda(n) {{remainingPhrase}} (máx. {{cap}} en total)',
        {
            pickedPhrase: tPlural(
                'host.properties.editor.photo.galleryCapExceededOnSelectPicked',
                selectedCount,
                { count: selectedCount }
            ),
            remainingPhrase: tPlural(
                'host.properties.editor.photo.galleryCapExceededOnSelectRemaining',
                remaining,
                { count: remaining }
            ),
            cap
        }
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
        description: row.description,
        alt: row.alt,
        // The credit has to round-trip: the panel re-syncs from the row every
        // time it opens, so a photo already credited must show its current
        // values instead of an empty form that would silently clear them.
        attribution: row.attribution ?? undefined,
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

// ----------------------------------------------------------------------------
// Photo text-metadata editing (HOS-125 — correct alt/caption/description)
// ----------------------------------------------------------------------------

/**
 * Length bounds for the three free-text photo fields, mirroring
 * `AccommodationMediaUpdatePayloadSchema` in `@repo/schemas` exactly (min/max
 * on `alt`, `caption`, `description`). Kept as named constants here so the
 * client rejects an out-of-bounds value BEFORE calling the API, instead of
 * round-tripping to a 400.
 */
export const PHOTO_ALT_MAX_LENGTH = 200;
export const PHOTO_CAPTION_MIN_LENGTH = 3;
export const PHOTO_CAPTION_MAX_LENGTH = 100;
export const PHOTO_DESCRIPTION_MIN_LENGTH = 10;
export const PHOTO_DESCRIPTION_MAX_LENGTH = 300;
/** Mirrors `ImageAttributionSchema.photographer` in `@repo/schemas`. */
export const PHOTO_PHOTOGRAPHER_MAX_LENGTH = 200;

/** Raw form field values for the photo metadata editor, always plain strings. */
export interface PhotoMetadataFormValues {
    readonly alt: string;
    readonly caption: string;
    readonly description: string;
    /** Who took the photo — the visible half of the credit. */
    readonly photographer: string;
    /** Optional link to the author. Validated as http/https before it is sent. */
    readonly creditUrl: string;
}

/** Per-field validation errors — a field is present only when it is invalid. */
export interface PhotoMetadataFieldErrors {
    readonly alt?: string;
    readonly caption?: string;
    readonly description?: string;
    readonly photographer?: string;
    readonly creditUrl?: string;
}

/** PATCH body accepted by `accommodationMediaApi.updateMedia`. */
export interface PhotoMetadataUpdateBody {
    readonly alt?: string | null;
    readonly caption?: string | null;
    readonly description?: string | null;
    /** The whole credit object, or `null` to clear it. */
    readonly attribution?: MediaAttribution | null;
}

/**
 * Validate the three free-text photo fields against the same length bounds
 * the API enforces. An EMPTY (post-trim) field is always valid — it means
 * "clear this field" once submitted — so the minimum length only applies to
 * a field the host actually filled in.
 *
 * @param values - Current form field values
 * @param t - Active translator
 * @returns Per-field error messages; a field with no error is omitted
 */
export function validatePhotoMetadataFields(
    values: PhotoMetadataFormValues,
    t: Translate
): PhotoMetadataFieldErrors {
    const errors: {
        alt?: string;
        caption?: string;
        description?: string;
        photographer?: string;
        creditUrl?: string;
    } = {};

    const alt = values.alt.trim();
    if (alt.length > PHOTO_ALT_MAX_LENGTH) {
        errors.alt = t(
            'host.properties.editor.photo.altTooLong',
            'El texto no puede superar {{max}} caracteres',
            { max: PHOTO_ALT_MAX_LENGTH }
        );
    }

    const caption = values.caption.trim();
    if (caption.length > 0 && caption.length < PHOTO_CAPTION_MIN_LENGTH) {
        errors.caption = t(
            'host.properties.editor.photo.captionTooShort',
            'El epígrafe debe tener al menos {{min}} caracteres, o dejalo vacío',
            { min: PHOTO_CAPTION_MIN_LENGTH }
        );
    } else if (caption.length > PHOTO_CAPTION_MAX_LENGTH) {
        errors.caption = t(
            'host.properties.editor.photo.captionTooLong',
            'El epígrafe no puede superar {{max}} caracteres',
            { max: PHOTO_CAPTION_MAX_LENGTH }
        );
    }

    const description = values.description.trim();
    if (description.length > 0 && description.length < PHOTO_DESCRIPTION_MIN_LENGTH) {
        errors.description = t(
            'host.properties.editor.photo.descriptionTooShort',
            'La descripción debe tener al menos {{min}} caracteres, o dejala vacía',
            { min: PHOTO_DESCRIPTION_MIN_LENGTH }
        );
    } else if (description.length > PHOTO_DESCRIPTION_MAX_LENGTH) {
        errors.description = t(
            'host.properties.editor.photo.descriptionTooLong',
            'La descripción no puede superar {{max}} caracteres',
            { max: PHOTO_DESCRIPTION_MAX_LENGTH }
        );
    }

    // --- Credit -------------------------------------------------------------
    // Both fields are optional: most hosts photograph their own place and never
    // fill either one. What is NOT optional is the pairing — a link with no name
    // credits nobody, and a link the browser cannot open is a broken promise at
    // best and a `javascript:` payload at worst.
    const photographer = values.photographer.trim();
    const creditUrl = values.creditUrl.trim();

    if (photographer.length > PHOTO_PHOTOGRAPHER_MAX_LENGTH) {
        errors.photographer = t(
            'host.properties.editor.photo.photographerTooLong',
            'El crédito no puede superar {{max}} caracteres',
            { max: PHOTO_PHOTOGRAPHER_MAX_LENGTH }
        );
    }

    if (creditUrl.length > 0 && photographer.length === 0) {
        errors.photographer = t(
            'host.properties.editor.photo.photographerRequiredWithUrl',
            'Escribí a quién pertenece la foto para poder enlazar su sitio'
        );
    }

    // Not a formatting nicety: the same value ends up in an `href`, and the API
    // accepts `javascript:` (z.string().url() does not restrict the scheme).
    if (creditUrl.length > 0 && !resolveSafeExternalUrl(creditUrl)) {
        errors.creditUrl = t(
            'host.properties.editor.photo.creditUrlInvalid',
            'El link tiene que empezar con http:// o https://'
        );
    }

    return errors;
}

/**
 * Build the PATCH body for `accommodationMediaApi.updateMedia` from raw form
 * values: a blank (post-trim) field becomes `null` — CLEAR — never `''`. The
 * API treats `null` and "omitted" differently from an empty string (which
 * would fail the schema's `min()` bound instead of clearing the column), so
 * this mapping is the one place that distinction must never be lost.
 */
export function buildPhotoMetadataUpdateBody(
    values: PhotoMetadataFormValues,
    currentAttribution?: MediaAttribution
): PhotoMetadataUpdateBody {
    const toNullable = (raw: string): string | null => {
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : null;
    };

    return {
        alt: toNullable(values.alt),
        caption: toNullable(values.caption),
        description: toNullable(values.description),
        attribution: buildAttribution(values, currentAttribution)
    };
}

/**
 * Compose the credit object the PATCH persists.
 *
 * The form collects two fields; the stored object has four. The two it does not
 * collect are carried over from what is already on the row, because they are
 * how a stock import proves where the photo came from — overwriting `provider`
 * with `'user-upload'` every time a host fixes a typo in the photographer's
 * name would erase the provenance Unsplash's and Pexels' API terms require us
 * to keep displaying.
 *
 * @param values - Current form values
 * @param current - Credit already stored on this row, when there is one
 * @returns The credit to persist, or `null` to clear it
 */
function buildAttribution(
    values: PhotoMetadataFormValues,
    current?: MediaAttribution
): MediaAttribution | null {
    const photographer = values.photographer.trim();
    // No name, no credit. Clearing the name clears the whole object rather than
    // leaving an orphan link or licence pointing at nobody.
    if (photographer.length === 0) {
        return null;
    }

    const attribution: {
        photographer: string;
        sourceUrl?: string;
        license?: string;
        provider?: MediaAttribution['provider'];
    } = { photographer };

    const sourceUrl = resolveSafeExternalUrl(values.creditUrl.trim());
    if (sourceUrl) {
        attribution.sourceUrl = sourceUrl;
    }
    if (current?.license) {
        attribution.license = current.license;
    }
    attribution.provider = current?.provider ?? 'user-upload';

    return attribution;
}
