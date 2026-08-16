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
    readonly handleUpdateMediaText: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

/**
 * Non-upload photo mutations: remove (featured / gallery), promote a gallery
 * photo to portada, and button-driven manual reordering.
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

            if (result.ok) {
                const promoted = mediaRowToItem(result.data.media);
                setGalleryItems((prev) => {
                    const withoutPromoted = prev.filter((g) => g.id !== item.id);
                    return featuredItem
                        ? [...withoutPromoted, { ...featuredItem, isFeatured: false }]
                        : withoutPromoted;
                });
                setFeaturedItem(promoted);
            } else {
                reportUploadError(
                    result.error.message ??
                        t(
                            'host.properties.editor.photo.promoteFailed',
                            'No se pudo usar esta foto como portada'
                        )
                );
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
     */
    const persistGalleryOrder = useCallback(
        async (nextGalleryItems: readonly AccommodationMediaItem[]) => {
            if (!isHydrated) return;
            if (nextGalleryItems.some((g) => !g.id) || (featuredItem && !featuredItem.id)) return;

            setError(null);
            setOpLoading(true);

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
     * Correct a single photo's text metadata (alt/caption/description) via
     * `updateMedia` (HOS-125). Targets exactly ONE row by its DB UUID — a
     * save on one photo never touches any other photo's fields — and merges
     * the server's authoritative row back into whichever slot the item lives
     * in (portada or gallery), without disturbing the rest of that slot's
     * state. Returns `true` on success so the calling form can show a
     * "saved" confirmation and stay open for further edits.
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
        handleUpdateMediaText
    };
}
