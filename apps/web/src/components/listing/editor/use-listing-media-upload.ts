/**
 * @file use-listing-media-upload.ts
 * @description The two upload paths of the listing photo editor (featured
 * slot and gallery batch), split out of `use-listing-media.ts` to keep both
 * under the repo's 500-line ceiling (HOS-2489). They share the parent hook's
 * state through the setters it passes, like `use-photo-gallery-mutations.ts`
 * does on the accommodation side. Each upload reports to the shell
 * auto-save chip: `saving` when the first byte leaves, then `saved`, or
 * `error` with no chip retry (the file has to be picked again).
 */

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback } from 'react';
import { reportEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import { listingMediaApi } from '@/lib/api/endpoints-protected';
import { visibleApiMessage } from '@/lib/api-errors';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { compressImageForUpload, isCompressionUnavailable } from '@/lib/media/compress-image';
import {
    describeUploadError,
    isGalleryQuotaExceeded,
    type ListingMediaItem,
    rowToItem,
    uploadEntityImage
} from './listing-media-upload';
import {
    buildMediaCompressionUnsupportedTooLargeMessage,
    type Translate,
    validateMediaFileSize,
    validateMediaFileType
} from './media-section-helpers';

/**
 * Closes an upload's chip report.
 *
 * @param params - Whether every file of the upload was saved.
 */
function reportUploadOutcome({ ok }: { readonly ok: boolean }): void {
    reportEditorAutoSave(ok ? { status: 'saved', savedAt: new Date() } : { status: 'error' });
}

/** Params of {@link useListingMediaUpload}. */
export interface UseListingMediaUploadParams {
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
    readonly t: Translate;
    readonly tPlural: (key: string, count: number, params?: Record<string, unknown>) => string;
    readonly galleryCap: number;
    readonly galleryCount: number;
    readonly featuredInputRef: RefObject<HTMLInputElement | null>;
    readonly galleryInputRef: RefObject<HTMLInputElement | null>;
    readonly setFeaturedItem: (item: ListingMediaItem | null) => void;
    readonly setGalleryItems: Dispatch<SetStateAction<readonly ListingMediaItem[]>>;
    readonly setError: (message: string | null) => void;
    readonly setIsUploading: (value: boolean) => void;
    readonly setIsCompressing: (value: boolean) => void;
    readonly setUploadBatch: (
        value: { readonly current: number; readonly total: number } | null
    ) => void;
    readonly reportError: (message: string) => void;
}

/**
 * The featured and gallery upload handlers.
 *
 * @param params - See {@link UseListingMediaUploadParams}.
 * @returns `{ handleFeaturedSelect, handleGallerySelect }`.
 */
export function useListingMediaUpload({
    vertical,
    listingId,
    t,
    tPlural,
    galleryCap,
    galleryCount,
    featuredInputRef,
    galleryInputRef,
    setFeaturedItem,
    setGalleryItems,
    setError,
    setIsUploading,
    setIsCompressing,
    setUploadBatch,
    reportError
}: UseListingMediaUploadParams) {
    // --- Featured image handlers ---

    /**
     * Upload a new photo and mark it as the featured image.
     *
     * Flow: upload → addFeaturedMedia. The server creates the cover and
     * replaces the old cover atomically without spending a gallery slot.
     */
    const handleFeaturedSelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            const typeError = validateMediaFileType(file, t);
            if (typeError) {
                reportError(typeError);
                return;
            }
            setError(null);

            // HOS-332: resize/recompress before the size cap is checked, so a
            // heavy original that shrinks under the cap is accepted. Any
            // failure to compress (unsupported format, no canvas support)
            // falls back to the original file — never blocks the upload.
            setIsCompressing(true);
            const compression = await compressImageForUpload({ file });
            setIsCompressing(false);

            const uploadFile = compression.file;
            const sizeError = validateMediaFileSize(uploadFile, t);
            if (sizeError) {
                reportError(
                    isCompressionUnavailable(compression)
                        ? buildMediaCompressionUnsupportedTooLargeMessage(t)
                        : sizeError
                );
                return;
            }

            setIsUploading(true);
            reportEditorAutoSave({ status: 'saving' });
            let saved = false;
            try {
                const uploaded = await uploadEntityImage({
                    file: uploadFile,
                    vertical,
                    listingId,
                    role: 'featured'
                });

                const featuredResult = await listingMediaApi.addFeaturedMedia({
                    vertical,
                    id: listingId,
                    body: {
                        url: uploaded.url,
                        publicId: uploaded.publicId,
                        moderationState: 'APPROVED'
                    }
                });

                if (!featuredResult.ok) {
                    reportError(
                        visibleApiMessage({ error: featuredResult.error }) ??
                            t('listing.owner.editor.media.persistFailed')
                    );
                    return;
                }

                // The server soft-deletes the replaced cover atomically.
                setFeaturedItem(rowToItem(featuredResult.data.media));
                saved = true;
            } catch (err) {
                reportError(describeUploadError(err, t));
            } finally {
                reportUploadOutcome({ ok: saved });
                setIsUploading(false);
                if (featuredInputRef.current) {
                    featuredInputRef.current.value = '';
                }
            }
        },
        [
            vertical,
            listingId,
            t,
            reportError,
            featuredInputRef,
            setError,
            setFeaturedItem,
            setIsCompressing,
            setIsUploading
        ]
    );

    // --- Gallery handlers ---

    /**
     * Upload a batch of gallery photos and persist each one immediately.
     *
     * Ported from the accommodation editor's `processGalleryFiles`
     * (`apps/web/src/components/host/editor/use-photo-section.ts`, HOS-122):
     * the cap is checked ONCE against the whole selected batch (checking it
     * file-by-file is where the accommodation editor's original bug lived —
     * the last file silently vanishing over the limit), every file is
     * validated up front so a bad file rejects the whole batch before any
     * upload starts, and files upload SEQUENTIALLY — one XHR at a time — so
     * the in-flight state keeps meaning something instead of resolving in an
     * arbitrary order. `uploadBatch` surfaces "uploading photo X of Y" while
     * a batch of more than one file is in flight, for the same reason.
     *
     * A single file's failure is reported and the loop continues to the next
     * file — UNLESS the gallery cap itself was hit (`isGalleryQuotaExceeded`),
     * in which case every remaining file would fail identically, so the loop
     * stops after ONE toast instead of firing one per remaining file (mirrors
     * the accommodation editor's `isPlanLimitReached` guard, HOS-724).
     *
     * Flow per file: upload → addMedia (creates a visible, non-featured row)
     * → append to state.
     */
    const handleGallerySelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) {
                return;
            }

            const remainingSlots = galleryCap - galleryCount;
            if (files.length > remainingSlots) {
                reportError(
                    tPlural('listing.owner.editor.media.capReached', galleryCap, {
                        cap: galleryCap
                    })
                );
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
                return;
            }

            for (const file of files) {
                const typeError = validateMediaFileType(file, t);
                if (typeError) {
                    reportError(typeError);
                    return;
                }
            }

            setError(null);

            // HOS-332: resize/recompress the whole batch BEFORE checking the
            // size cap, so a heavy original that shrinks under the cap is
            // accepted — mirrors `handleFeaturedSelect`. Run concurrently
            // since compression is CPU-bound (decode + canvas draw), not I/O.
            setIsCompressing(true);
            const compressions = await Promise.all(
                files.map((file) => compressImageForUpload({ file }))
            );
            setIsCompressing(false);

            for (const compression of compressions) {
                const sizeError = validateMediaFileSize(compression.file, t);
                if (sizeError) {
                    reportError(
                        isCompressionUnavailable(compression)
                            ? buildMediaCompressionUnsupportedTooLargeMessage(t)
                            : sizeError
                    );
                    return;
                }
            }

            setIsUploading(true);
            reportEditorAutoSave({ status: 'saving' });
            let allSaved = true;

            for (let index = 0; index < compressions.length; index += 1) {
                const file = compressions[index]?.file;
                if (!file) {
                    continue;
                }
                setUploadBatch(
                    files.length > 1 ? { current: index + 1, total: files.length } : null
                );

                try {
                    const uploaded = await uploadEntityImage({
                        file,
                        vertical,
                        listingId,
                        role: 'gallery'
                    });

                    const addResult = await listingMediaApi.addMedia({
                        vertical,
                        id: listingId,
                        body: {
                            url: uploaded.url,
                            publicId: uploaded.publicId,
                            moderationState: 'APPROVED'
                        }
                    });

                    if (!addResult.ok) {
                        allSaved = false;
                        reportError(
                            visibleApiMessage({ error: addResult.error }) ??
                                t('listing.owner.editor.media.persistFailed')
                        );
                        // The cap was hit: every remaining file in the batch
                        // would fail identically, so stop instead of firing
                        // one more toast per file.
                        if (isGalleryQuotaExceeded(addResult.error)) {
                            break;
                        }
                        continue;
                    }

                    setGalleryItems((prev) => [...prev, rowToItem(addResult.data.media)]);
                } catch (err) {
                    allSaved = false;
                    reportError(describeUploadError(err, t));
                }
            }

            reportUploadOutcome({ ok: allSaved });
            setIsUploading(false);
            setUploadBatch(null);
            if (galleryInputRef.current) {
                galleryInputRef.current.value = '';
            }
        },
        [
            galleryCount,
            vertical,
            listingId,
            t,
            reportError,
            galleryCap,
            tPlural,
            galleryInputRef,
            setError,
            setGalleryItems,
            setIsCompressing,
            setIsUploading,
            setUploadBatch
        ]
    );

    return { handleFeaturedSelect, handleGallerySelect } as const;
}
