/**
 * @file use-listing-media.ts
 * @description State and handlers of the listing photo editor
 * (`MediaSection.client.tsx`), split out of that file when it moved to the
 * kit skin (HOS-2489). Same persistence model as before (HOS-372: every op
 * hits its endpoint at once); new here are the kit `useConfirm` question
 * before a delete (injected as `confirmRemoval`) and the report of every
 * persisted action to the shell auto-save chip.
 */

import { getGalleryCap, type Image } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { runRetryableEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import type { PhotoMetadataUpdateBody } from '@/components/host/editor/photo-section-helpers';
import { listingMediaApi } from '@/lib/api/endpoints-protected';
import { visibleApiMessage } from '@/lib/api-errors';
import { useSingleFlight } from '@/lib/forms/use-single-flight';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { webLogger } from '@/lib/logger';
import { addToast } from '@/store/toast-store';
import { type ListingMediaItem, legacyToDisplay, rowToItem } from './listing-media-upload';
import { useListingMediaUpload } from './use-listing-media-upload';

/** Params of {@link useListingMedia}. */
export interface UseListingMediaParams {
    readonly locale: SupportedLocale;
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
    readonly initialFeaturedImage: Image | null;
    readonly initialGallery: readonly Image[];
    /** Asks before a delete (HOS-2429); the section renders the kit dialog. */
    readonly confirmRemoval: () => Promise<boolean>;
}

/**
 * The listing photo editor's state machine: hydration from `listMedia`,
 * featured and gallery uploads, removals and text edits.
 *
 * @param params - See {@link UseListingMediaParams}.
 * @returns State and handlers for the render layer.
 */
export function useListingMedia({
    locale,
    vertical,
    listingId,
    initialFeaturedImage,
    initialGallery,
    confirmRemoval
}: UseListingMediaParams) {
    const { t, tPlural } = createTranslations(locale);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [featuredItem, setFeaturedItem] = useState<ListingMediaItem | null>(() =>
        initialFeaturedImage ? legacyToDisplay(initialFeaturedImage, true) : null
    );
    const [galleryItems, setGalleryItems] = useState<readonly ListingMediaItem[]>(() =>
        initialGallery.map((img) => legacyToDisplay(img, false))
    );

    const [isHydrated, setIsHydrated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    /**
     * Whether a selected file is currently being resized/recompressed
     * client-side (HOS-332), BEFORE the upload itself starts.
     */
    const [isCompressing, setIsCompressing] = useState(false);
    /** "Uploading photo X of Y" marker for a multi-file gallery batch (HOS-832). */
    const [uploadBatch, setUploadBatch] = useState<{
        readonly current: number;
        readonly total: number;
    } | null>(null);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const galleryCap = getGalleryCap(vertical);
    const isGalleryFull = galleryItems.length >= galleryCap;
    // Selecting exactly one remaining slot with `multiple` on would still let
    // the OS picker offer more than one file, only to reject the whole batch
    // instantly — so `multiple` is only declared once there is room for more
    // than one upload (mirrors the accommodation editor, HOS-122).
    const remainingGallerySlots = Math.max(galleryCap - galleryItems.length, 0);

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;

        listingMediaApi
            .listMedia({ vertical, id: listingId })
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[MediaSection] listMedia failed:', result.error);
                    // Keep SSR placeholders; flag as hydrated so ops become available
                    setIsHydrated(true);
                    return;
                }
                const rows = result.data.media;
                const featured = rows.find((r) => r.isFeatured) ?? null;
                const gallery = rows.filter((r) => !r.isFeatured);
                setFeaturedItem(featured ? rowToItem(featured) : null);
                setGalleryItems(gallery.map(rowToItem));
                setIsHydrated(true);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                webLogger.warn('[MediaSection] listMedia error:', err);
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [vertical, listingId]);

    /**
     * Report a failure both inline (existing behavior) and via the global
     * toast store, mirroring PhotoSection's BETA-144 behavior.
     */
    const reportError = useCallback((message: string) => {
        setError(message);
        addToast({ type: 'error', message });
    }, []);

    const { handleFeaturedSelect, handleGallerySelect } = useListingMediaUpload({
        vertical,
        listingId,
        t,
        tPlural,
        galleryCap,
        galleryCount: galleryItems.length,
        featuredInputRef,
        galleryInputRef,
        setFeaturedItem,
        setGalleryItems,
        setError,
        setIsUploading,
        setIsCompressing,
        setUploadBatch,
        reportError
    });

    /**
     * Remove the current featured row. There is no "unfeature" endpoint —
     * removing is the clear action. `removeMedia` deletes the Cloudinary
     * binary server-side before dropping the row.
     */
    const runSingleFlight = useSingleFlight();
    const handleFeaturedRemove = useCallback(async () => {
        if (!featuredItem?.id) {
            return;
        }
        // HOS-2429: the delete is immediate and irreversible, so ask first.
        if (!(await runSingleFlight(confirmRemoval))) {
            return;
        }
        const mediaId = featuredItem.id;
        // HOS-2489: every persisted photo action reports to the shell chip.
        await runRetryableEditorAutoSave({
            save: async () => {
                setError(null);
                setOpLoading(true);
                const result = await listingMediaApi.removeMedia({
                    vertical,
                    id: listingId,
                    mediaId
                });
                if (result.ok) {
                    setFeaturedItem(null);
                } else {
                    reportError(
                        visibleApiMessage({ error: result.error }) ??
                            t('listing.owner.editor.media.removeFailed')
                    );
                }
                setOpLoading(false);
                return result.ok;
            }
        });
    }, [featuredItem, vertical, listingId, t, reportError, runSingleFlight, confirmRemoval]);

    /**
     * Remove a gallery photo by its DB UUID. On failure, keeps the item in
     * state (consistent with the server).
     */
    const handleGalleryRemove = useCallback(
        async (item: ListingMediaItem) => {
            if (!item.id) {
                return;
            }
            // HOS-2429: the delete is immediate and irreversible, so ask first.
            if (!(await runSingleFlight(confirmRemoval))) {
                return;
            }
            await runRetryableEditorAutoSave({
                save: async () => {
                    setError(null);
                    setOpLoading(true);
                    const result = await listingMediaApi.removeMedia({
                        vertical,
                        id: listingId,
                        mediaId: item.id
                    });
                    if (result.ok) {
                        setGalleryItems((prev) => prev.filter((g) => g.id !== item.id));
                    } else {
                        reportError(
                            visibleApiMessage({ error: result.error }) ??
                                t('listing.owner.editor.media.removeFailed')
                        );
                    }
                    setOpLoading(false);
                    return result.ok;
                }
            });
        },
        [vertical, listingId, t, reportError, runSingleFlight, confirmRemoval]
    );

    /**
     * Persist a photo's text metadata (alt / caption / description / credit).
     *
     * Immediate and per-photo like every other op here: `updateMedia` PATCHes
     * only this row, and the listing editor's Save button never carries photo
     * data. A blank field arrives as `null` (clear) rather than `''` — see
     * `buildPhotoMetadataUpdateBody`, which is what the panel builds the body
     * with.
     *
     * On success the row is replaced in local state so re-opening the panel
     * shows the CURRENT values rather than the ones it mounted with.
     *
     * @returns `true` when the PATCH succeeded — the panel shows its saved
     *   badge only then.
     */
    const handleUpdateText = useCallback(
        async (item: ListingMediaItem, body: PhotoMetadataUpdateBody): Promise<boolean> => {
            // An SSR placeholder carries `id: ''` and has no row to patch yet.
            if (!item.id) {
                return false;
            }
            const { ok } = await runRetryableEditorAutoSave({
                save: async () => {
                    setError(null);
                    setOpLoading(true);
                    const result = await listingMediaApi.updateMedia({
                        vertical,
                        id: listingId,
                        mediaId: item.id,
                        body
                    });
                    setOpLoading(false);
                    if (!result.ok) {
                        reportError(
                            visibleApiMessage({ error: result.error }) ??
                                t(
                                    'listing.owner.editor.media.metadataSaveFailed',
                                    'No se pudieron guardar los datos de la foto'
                                )
                        );
                        return false;
                    }
                    const updated = rowToItem(result.data.media);
                    if (updated.isFeatured) {
                        setFeaturedItem(updated);
                    } else {
                        setGalleryItems((prev) =>
                            prev.map((g) => (g.id === updated.id ? updated : g))
                        );
                    }
                    return true;
                }
            });
            return ok;
        },
        [vertical, listingId, t, reportError]
    );

    const anyOpInFlight = isUploading || isCompressing || opLoading;

    return {
        featuredInputRef,
        galleryInputRef,
        featuredItem,
        galleryItems,
        isUploading,
        isCompressing,
        uploadBatch,
        error,
        galleryCap,
        isGalleryFull,
        remainingGallerySlots,
        anyOpInFlight,
        // Ops require hydrated DB ids; SSR placeholders (id='') cannot be operated on.
        opsReady: isHydrated,
        handleFeaturedSelect,
        handleFeaturedRemove,
        handleGallerySelect,
        handleGalleryRemove,
        handleUpdateText
    } as const;
}

/** What {@link useListingMedia} returns. */
export type UseListingMediaResult = ReturnType<typeof useListingMedia>;

/** Re-exported for the render layer. */
export type { ListingMediaItem };
