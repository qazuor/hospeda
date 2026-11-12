/**
 * @file use-photo-gallery-mutations.ts
 * @description Non-upload photo mutations for the accommodation photo editor
 * (HOS-122): removing the portada, removing a gallery photo, promoting a
 * gallery photo to portada, and manual reordering. Split out of
 * `use-photo-section.ts` to keep both files under the repo's 500-line
 * ceiling.
 *
 * These handlers share the SAME state (featured/gallery items, error, op
 * loading) owned by `usePhotoSection` — they receive the setters as params
 * rather than owning their own `useState`, so there is exactly one source of
 * truth for the section's local state.
 */

import { useCallback } from 'react';
import { accommodationMediaApi } from '@/lib/api/endpoints-protected';
import type { AccommodationMediaItem } from '@/lib/api/types';
import {
    buildReorderPayload,
    mediaRowToItem,
    moveArrayItem,
    type PhotoMetadataUpdateBody,
    splitMediaRows,
    type Translate
} from './photo-section-helpers';

export interface UsePhotoGalleryMutationsParams {
    readonly accommodationId: string;
    readonly t: Translate;
    readonly featuredItem: AccommodationMediaItem | null;
    readonly galleryItems: readonly AccommodationMediaItem[];
    readonly isHydrated: boolean;
    readonly setFeaturedItem: (item: AccommodationMediaItem | null) => void;
    readonly setGalleryItems: React.Dispatch<
        React.SetStateAction<readonly AccommodationMediaItem[]>
    >;
    readonly setError: (message: string | null) => void;
    readonly setOpLoading: (loading: boolean) => void;
    readonly reportUploadError: (message: string) => void;
}

export interface UsePhotoGalleryMutationsResult {
    readonly handleFeaturedRemove: () => void;
    readonly handleGalleryRemove: (item: AccommodationMediaItem) => void;
    readonly handlePromoteToFeatured: (item: AccommodationMediaItem) => void;
    readonly handleMoveUp: (item: AccommodationMediaItem) => void;
    readonly handleMoveDown: (item: AccommodationMediaItem) => void;
    /** Drag-and-drop reorder: move the gallery photo at `fromIndex` to `toIndex`. */
    readonly handleReorderGallery: (fromIndex: number, toIndex: number) => void;
    readonly handleUpdateMediaText: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

/**
 * Non-upload photo mutations: remove (featured / gallery), promote a gallery
 * photo to portada, and manual reordering (buttons and drag-and-drop).
 */
export function usePhotoGalleryMutations({
    accommodationId,
    t,
    featuredItem,
    galleryItems,
    isHydrated,
    setFeaturedItem,
    setGalleryItems,
    setError,
    setOpLoading,
    reportUploadError
}: UsePhotoGalleryMutationsParams): UsePhotoGalleryMutationsResult {
    /**
     * Delete the current featured (portada) row.
     * There is no "unfeature" endpoint — removing is the clear action.
     */
    const handleFeaturedRemove = useCallback(async () => {
        if (!featuredItem?.id) return;
        setError(null);
        setOpLoading(true);

        const result = await accommodationMediaApi.removeMedia({
            id: accommodationId,
            mediaId: featuredItem.id
        });

        if (result.ok) {
            setFeaturedItem(null);
        } else {
            setError(
                result.error.message ??
                    t('host.properties.editor.photo.removeFailed', 'No se pudo eliminar la imagen')
            );
        }
        setOpLoading(false);
    }, [featuredItem, accommodationId, t, setError, setOpLoading, setFeaturedItem]);

    /**
     * Delete a gallery photo by its DB UUID.
     * On failure: keeps the item in state (consistent with server).
     */
    const handleGalleryRemove = useCallback(
        async (item: AccommodationMediaItem) => {
            if (!item.id) return;
            setError(null);
            setOpLoading(true);

            const result = await accommodationMediaApi.removeMedia({
                id: accommodationId,
                mediaId: item.id
            });

            if (result.ok) {
                setGalleryItems((prev) => prev.filter((g) => g.id !== item.id));
            } else {
                setError(
                    result.error.message ??
                        t(
                            'host.properties.editor.photo.removeFailed',
                            'No se pudo eliminar la imagen'
                        )
                );
            }
            setOpLoading(false);
        },
        [accommodationId, t, setError, setOpLoading, setGalleryItems]
    );

    /**
     * Promote an existing gallery photo to portada by calling
     * `setFeaturedMedia` alone — no re-upload, so no second Cloudinary asset
     * is created.
     *
     * HOS-904: the demoted cover KEEPS its own `sortOrder` on the server
     * (`setFeaturedMedia` only flips `isFeatured`), so it lands wherever that
     * number puts it — usually FIRST, because every reorder writes the cover
     * at index 0 (`buildReorderPayload`). This handler used to append it to
     * the END of the local gallery instead, so the editor showed an order the
     * server never saved until the next reload, and the public page (which
     * sorts by `sortOrder`) disagreed with the editor. The fix re-reads the
     * list after the promotion and renders exactly what was saved. The local
     * composition survives only as a best-effort fallback for a failed re-read.
     */
    const handlePromoteToFeatured = useCallback(
        async (item: AccommodationMediaItem) => {
            if (!item.id) return;
            setError(null);
            setOpLoading(true);

            const result = await accommodationMediaApi.setFeaturedMedia({
                id: accommodationId,
                mediaId: item.id
            });

            if (!result.ok) {
                reportUploadError(
                    result.error.message ??
                        t(
                            'host.properties.editor.photo.promoteFailed',
                            'No se pudo usar esta foto como portada'
                        )
                );
                setOpLoading(false);
                return;
            }

            const refreshed = await accommodationMediaApi
                .listMedia({ id: accommodationId })
                .catch(() => null);

            if (refreshed?.ok) {
                const { featured, gallery } = splitMediaRows(refreshed.data.media);
                setFeaturedItem(featured);
                setGalleryItems(gallery);
            } else {
                setGalleryItems((prev) => {
                    const withoutPromoted = prev.filter((g) => g.id !== item.id);
                    return featuredItem
                        ? [...withoutPromoted, { ...featuredItem, isFeatured: false }]
                        : withoutPromoted;
                });
                setFeaturedItem(mediaRowToItem(result.data.media));
            }
            setOpLoading(false);
        },
        [
            accommodationId,
            featuredItem,
            t,
            reportUploadError,
            setError,
            setOpLoading,
            setGalleryItems,
            setFeaturedItem
        ]
    );

    /**
     * Persist a new gallery order. `orderedIds` must include the featured
     * row's id too (the server validates against ALL visible rows), even
     * though it never moves in the UI. On success the response's full media
     * list is the new source of truth for both slots.
     *
     * HOS-2126: OPTIMISTIC. The new order is shown immediately — a drag that
     * snapped back to its origin until the server answered would read as a
     * failed drop — and the previous order is restored, with an error toast,
     * if the server rejects it. The move-up/move-down buttons share this
     * path, so both gestures behave identically.
     */
    const persistGalleryOrder = useCallback(
        async (nextGalleryItems: readonly AccommodationMediaItem[]) => {
            if (!isHydrated) return;
            if (nextGalleryItems.some((g) => !g.id) || (featuredItem && !featuredItem.id)) return;

            const previousGalleryItems = galleryItems;
            setError(null);
            setOpLoading(true);
            setGalleryItems(nextGalleryItems);

            const orderedIds = buildReorderPayload({
                featuredId: featuredItem?.id ?? null,
                galleryIds: nextGalleryItems.map((g) => g.id)
            });

            const result = await accommodationMediaApi.reorderMedia({
                id: accommodationId,
                orderedIds
            });

            if (result.ok) {
                const { featured, gallery } = splitMediaRows(result.data.media);
                setFeaturedItem(featured);
                setGalleryItems(gallery);
            } else {
                setGalleryItems(previousGalleryItems);
                reportUploadError(
                    result.error.message ??
                        t(
                            'host.properties.editor.photo.reorderFailed',
                            'No se pudo guardar el nuevo orden'
                        )
                );
            }
            setOpLoading(false);
        },
        [
            accommodationId,
            featuredItem,
            galleryItems,
            isHydrated,
            t,
            reportUploadError,
            setError,
            setOpLoading,
            setFeaturedItem,
            setGalleryItems
        ]
    );

    const handleMoveGalleryItem = useCallback(
        (item: AccommodationMediaItem, direction: -1 | 1) => {
            const index = galleryItems.findIndex((g) => g.id === item.id);
            if (index === -1) return;
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= galleryItems.length) return;
            void persistGalleryOrder(moveArrayItem(galleryItems, index, targetIndex));
        },
        [galleryItems, persistGalleryOrder]
    );

    const handleMoveUp = useCallback(
        (item: AccommodationMediaItem) => handleMoveGalleryItem(item, -1),
        [handleMoveGalleryItem]
    );
    const handleMoveDown = useCallback(
        (item: AccommodationMediaItem) => handleMoveGalleryItem(item, 1),
        [handleMoveGalleryItem]
    );

    /**
     * Drag-and-drop reorder (HOS-2126): move the photo at `fromIndex` to
     * `toIndex` and persist. Same persistence path as the buttons.
     */
    const handleReorderGallery = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (fromIndex === toIndex) return;
            if (fromIndex < 0 || toIndex < 0) return;
            if (fromIndex >= galleryItems.length || toIndex >= galleryItems.length) return;
            void persistGalleryOrder(moveArrayItem(galleryItems, fromIndex, toIndex));
        },
        [galleryItems, persistGalleryOrder]
    );

    /**
     * Correct a single photo's text metadata (alt/caption/description) via
     * `updateMedia` (HOS-125). Targets exactly ONE row by its DB UUID — a
     * save on one photo never touches any other photo's fields — and merges
     * the server's authoritative row back into whichever slot the item lives
     * in (portada or gallery), without disturbing the rest of that slot's
     * state. It never asks about other photos' missing alt text: the HOS-1018
     * warning fires only when the host leaves Fotos (HOS-2043).
     */
    const handleUpdateMediaText = useCallback(
        async (item: AccommodationMediaItem, body: PhotoMetadataUpdateBody): Promise<boolean> => {
            if (!item.id) return false;
            setError(null);
            setOpLoading(true);

            const result = await accommodationMediaApi.updateMedia({
                id: accommodationId,
                mediaId: item.id,
                body
            });

            if (!result.ok) {
                reportUploadError(
                    result.error.message ??
                        t(
                            'host.properties.editor.photo.metadataSaveFailed',
                            'No se pudieron guardar los datos de la foto'
                        )
                );
                setOpLoading(false);
                return false;
            }

            const updated = mediaRowToItem(result.data.media);
            if (item.isFeatured) {
                setFeaturedItem(updated);
            } else {
                setGalleryItems((prev) => prev.map((g) => (g.id === item.id ? updated : g)));
            }
            setOpLoading(false);
            return true;
        },
        [
            accommodationId,
            t,
            reportUploadError,
            setError,
            setOpLoading,
            setFeaturedItem,
            setGalleryItems
        ]
    );

    return {
        handleFeaturedRemove,
        handleGalleryRemove,
        handlePromoteToFeatured,
        handleMoveUp,
        handleMoveDown,
        handleReorderGallery,
        handleUpdateMediaText
    };
}
