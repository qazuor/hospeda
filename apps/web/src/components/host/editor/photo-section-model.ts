/**
 * @file photo-section-model.ts
 * @description Types and pure helpers of `usePhotoSection`
 * (`use-photo-section.ts`), split out to keep that hook under the repo's
 * 500-line ceiling when the photo editor moved to the kit skin (HOS-2489).
 */

import type { ListingPhotoAllowance } from '@repo/schemas';
import type { ListingPhotoApi } from '@/lib/api/listing-photo-api';
import type { AccommodationMediaItem, ApiError } from '@/lib/api/types';
import { translateApiError } from '@/lib/api-errors';
import {
    buildLimitReachedPayloadFromDetails,
    type LimitReachedToastPayload
} from '@/lib/billing-limit-error';
import type { SupportedLocale } from '@/lib/i18n';
import type { GalleryCapView } from './photo-cap-view';
import type { PhotoMetadataUpdateBody, Translate } from './photo-section-helpers';

/**
 * First-paint image from SSR (no DB id). Both the accommodation `MediaImage`
 * and the listing `Image` satisfy it (HOS-2495).
 */
export interface PhotoSectionInitialImage {
    readonly url: string;
    readonly publicId?: string | null;
}

/**
 * Map a legacy `MediaImage` (no DB id, SSR-only) to a partial display object.
 * Used only for the first-paint placeholder; once listMedia resolves, these
 * are replaced by real `AccommodationMediaItem` values that carry DB ids.
 * The empty id prevents any API call until the real rows load.
 *
 * @param img - The SSR image.
 * @param isFeatured - Whether it is the cover.
 * @returns The display item.
 */
export function legacyToDisplay(
    img: PhotoSectionInitialImage,
    isFeatured: boolean
): AccommodationMediaItem {
    return {
        id: '',
        url: img.url,
        publicId: img.publicId ?? '',
        // Spelled out rather than omitted: the four text keys are REQUIRED on
        // `AccommodationMediaItem` precisely so a mapper cannot forget one (see
        // `PhotoMetadataEditableItem`). `MediaImage` — the SSR-only legacy
        // shape — carries none of them, so `undefined` is the honest answer
        // here, and the empty `id` keeps the panel shut until the real rows
        // arrive with the real text.
        caption: undefined,
        description: undefined,
        alt: undefined,
        attribution: undefined,
        isFeatured
    };
}

/**
 * Whether an `addMedia` failure is the plan's photo cap rather than any other
 * upload error (HOS-724).
 *
 * Both halves are load-bearing: `LIMIT_REACHED` is the code and `403` is the
 * status the API error contract pairs it with. The same literal pair is what
 * `FavoriteButton` and `CreatePropertyMiniForm` match on; the literal is pinned
 * against `ServiceErrorCode.LIMIT_REACHED` in
 * `test/components/host/editor/PhotoSection.limit.test.tsx` so a rename of the
 * enum member cannot leave this string behind. It is spelled out rather than
 * imported from `@repo/billing`, whose barrel drags `@repo/logger` into the
 * client bundle, where it reads the process environment at module scope and
 * kills the island during hydration — see
 * `test/static-guards/billing-barrel-client-isolation.test.ts`.
 *
 * @param error - The API error.
 * @returns Whether it is the plan cap.
 */
export function isPlanLimitReached(error: ApiError): boolean {
    return error.status === 403 && error.code === 'LIMIT_REACHED';
}

/**
 * What to show for a failed `addMedia` call (HOS-724).
 *
 * Hitting the plan's photo cap is NOT an ordinary upload failure: it is the
 * product's most natural upsell moment. The payload — copy AND which CTA
 * leads — comes whole from `buildLimitReachedPayloadFromDetails`, exactly as
 * the two other limit toasts in the app consume it (guarded by
 * `test/lib/billing-limit-toast-actions.guard.test.ts`). `payload.title` is the
 * message on purpose: it is the photo-specific, localized line.
 *
 * Every OTHER failure resolves from `code`/`reason`/`details` (HOS-1218): the
 * API's `message` is log text, so it is deliberately not forwarded.
 *
 * @param params - The error, the locale and the translator.
 * @returns The message, plus the limit toast's action when it is the cap.
 */
export function describeAddMediaError({
    error,
    locale,
    t
}: {
    readonly error: ApiError;
    readonly locale: SupportedLocale;
    readonly t: Translate;
}): { readonly message: string; readonly limit: LimitReachedToastPayload | null } {
    if (isPlanLimitReached(error)) {
        const limit = buildLimitReachedPayloadFromDetails({ details: error.details, locale });
        return { message: limit.title, limit };
    }
    const message = translateApiError({
        error: {
            code: error.code,
            reason: error.reason,
            details: error.details,
            status: error.status
        },
        t,
        fallback: t(
            'host.properties.editor.photo.persistFailed',
            'No se pudo guardar la imagen en la base de datos'
        )
    });
    return { message, limit: null };
}

/**
 * Sober "at the plan cap" upsell payload (HOS-1024). Reuses the exact copy/CTA
 * builder the failed-upload path uses, so the passive "gallery is full" state
 * and the active "upload rejected" state never show different copy for the
 * same limit.
 *
 * `null` whenever the gallery is not full — including the entire "plan cap not
 * yet known" window, since `PhotoSection` passes a placeholder cap large
 * enough that the gallery cannot be full until the real cap has resolved.
 *
 * @param params - Whether the gallery is full, its size, the cap and locale.
 * @returns The payload, or `null`.
 */
export function buildCapUpsell({
    isGalleryFull,
    limitKey,
    count,
    cap,
    locale
}: {
    readonly isGalleryFull: boolean;
    /** The vertical's photo limit key, as the allowance names it (HOS-2495). */
    readonly limitKey: string;
    readonly count: number;
    readonly cap: number;
    readonly locale: SupportedLocale;
}): LimitReachedToastPayload | null {
    if (!isGalleryFull) return null;
    return buildLimitReachedPayloadFromDetails({
        details: {
            limitKey,
            currentCount: count,
            maxAllowed: cap,
            usagePercent: 100,
            upgradeAudience: 'host'
        },
        locale
    });
}

/** Params of `usePhotoSection`. */
export interface UsePhotoSectionParams {
    readonly locale: SupportedLocale;
    /** The vertical's photo API (`createListingPhotoApi`, HOS-2495); it carries the vertical. */
    readonly api: ListingPhotoApi;
    readonly listingId: string;
    readonly initialFeaturedImage?: PhotoSectionInitialImage | null;
    readonly initialGallery?: readonly PhotoSectionInitialImage[];
    /**
     * Asks before a photo is deleted (HOS-2429). The section renders the kit
     * `useConfirm` dialog and passes its `confirm` here.
     */
    readonly confirmRemoval: () => Promise<boolean>;
}

/** Progress marker for a multi-file upload batch. */
export interface UploadBatchProgress {
    readonly current: number;
    readonly total: number;
}

/** What `usePhotoSection` returns. */
export interface UsePhotoSectionResult {
    readonly featuredItem: AccommodationMediaItem | null;
    readonly galleryItems: readonly AccommodationMediaItem[];
    readonly isUploading: boolean;
    /**
     * Whether a selected file is currently being resized/recompressed
     * client-side (HOS-332), BEFORE the upload itself starts.
     */
    readonly isCompressing: boolean;
    readonly uploadProgress: number | null;
    readonly uploadBatch: UploadBatchProgress | null;
    readonly error: string | null;
    readonly isDragOverFeatured: boolean;
    readonly isDragOverGallery: boolean;
    readonly isGalleryFull: boolean;
    /** The listing's photo allowance, `null` until the first read answers (HOS-2495). */
    readonly allowance: ListingPhotoAllowance | null;
    /** What the cap line says: loading / limited / unlimited / none / failed. */
    readonly capView: GalleryCapView;
    /** Ids (or URLs, for a placeholder) of the gallery tiles the public does not show. */
    readonly overCapIds: ReadonlySet<string>;
    /** Whether a gallery upload may start (the cap is known and grants photos). */
    readonly isGalleryUploadOpen: boolean;
    /** Whether a cover may be added or replaced (`coverAllowed` of the allowance). */
    readonly isCoverUploadOpen: boolean;
    /** Sober "at the plan cap" upsell payload (HOS-1024); `null` unless full. */
    readonly capUpsell: LimitReachedToastPayload | null;
    /** Controls are usable once the hydration attempt finished (success or failure). */
    readonly opsReady: boolean;
    /** True only when persisted media loaded; gates the alt-text warning, not controls. */
    readonly mediaLoadSucceeded: boolean;
    readonly anyOpInFlight: boolean;
    readonly featuredInputRef: React.RefObject<HTMLInputElement | null>;
    readonly galleryInputRef: React.RefObject<HTMLInputElement | null>;
    readonly handleFeaturedSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    readonly handleFeaturedDrop: (e: React.DragEvent<HTMLButtonElement>) => void;
    readonly handleFeaturedDragOver: (e: React.DragEvent<HTMLButtonElement>) => void;
    readonly handleFeaturedDragLeave: () => void;
    readonly handleFeaturedRemove: () => void;
    readonly handleGallerySelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    readonly handleGalleryDrop: (e: React.DragEvent<HTMLButtonElement>) => void;
    readonly handleGalleryDragOver: (e: React.DragEvent<HTMLButtonElement>) => void;
    readonly handleGalleryDragLeave: () => void;
    readonly handleGalleryRemove: (item: AccommodationMediaItem) => void;
    readonly handlePromoteToFeatured: (item: AccommodationMediaItem) => void;
    readonly handleMoveUp: (item: AccommodationMediaItem) => void;
    readonly handleMoveDown: (item: AccommodationMediaItem) => void;
    /** Drag-and-drop gallery reorder (HOS-2126). */
    readonly handleReorderGallery: (fromIndex: number, toIndex: number) => void;
    readonly handleUpdateMediaText: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}
