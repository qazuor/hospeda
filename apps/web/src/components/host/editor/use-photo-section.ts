/**
 * @file use-photo-section.ts
 * @description State + handlers for `PhotoSection.client.tsx` (HOS-122),
 * extracted into a hook so the component file stays render-focused and under
 * the repo's 500-line ceiling.
 *
 * Owns: hydration from `listMedia`, per-operation persistence (add / remove /
 * set-featured / reorder), multi-file sequential upload, and drag-and-drop
 * state for both the featured slot and the gallery grid. See
 * `PhotoSection.client.tsx`'s file header for the full behavioral contract —
 * this file is the "how", that one is the "what/why".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { reportEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import { accommodationMediaApi } from '@/lib/api/endpoints-protected';
import type { AccommodationMediaItem, ApiError } from '@/lib/api/types';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { compressImageForUpload, isCompressionUnavailable } from '@/lib/media/compress-image';
import { uploadEntityImage } from '@/lib/media/upload-entity';
import { describeUploadEntityError } from '@/lib/media/upload-entity-error';
import { addToast } from '@/store/toast-store';
import {
    buildCapExceededOnSelectMessage,
    buildCompressionUnsupportedTooLargeMessage,
    mediaRowToItem,
    splitMediaRows,
    validatePhotoFileSize,
    validatePhotoFileType
} from './photo-section-helpers';
import {
    buildCapUpsell,
    describeAddMediaError,
    isPlanLimitReached,
    legacyToDisplay,
    type UploadBatchProgress,
    type UsePhotoSectionParams,
    type UsePhotoSectionResult
} from './photo-section-model';
import { usePhotoGalleryMutations } from './use-photo-gallery-mutations';

export type { UploadBatchProgress, UsePhotoSectionParams, UsePhotoSectionResult };

/**
 * Self-contained photo-section state machine (SPEC-204 persistence model +
 * HOS-122 multi-upload / reorder / promote / drag-drop). See
 * `PhotoSection.client.tsx` for the rendered UI that consumes this hook.
 */
export function usePhotoSection({
    locale,
    accommodationId,
    galleryCap,
    initialFeaturedImage = null,
    initialGallery = [],
    confirmRemoval
}: UsePhotoSectionParams): UsePhotoSectionResult {
    const { t, tPlural } = createTranslations(locale);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [featuredItem, setFeaturedItem] = useState<AccommodationMediaItem | null>(() =>
        initialFeaturedImage ? legacyToDisplay(initialFeaturedImage, true) : null
    );
    const [galleryItems, setGalleryItems] = useState<readonly AccommodationMediaItem[]>(() =>
        initialGallery.map((img) => legacyToDisplay(img, false))
    );

    const [isHydrated, setIsHydrated] = useState(false);
    const [mediaLoadSucceeded, setMediaLoadSucceeded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadBatch, setUploadBatch] = useState<UploadBatchProgress | null>(null);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOverFeatured, setIsDragOverFeatured] = useState(false);
    const [isDragOverGallery, setIsDragOverGallery] = useState(false);

    const isGalleryFull = galleryItems.length >= galleryCap;

    // HOS-1024: see `buildCapUpsell` for why this reuses the limit-toast copy.
    const capUpsell = buildCapUpsell({
        isGalleryFull,
        count: galleryItems.length,
        cap: galleryCap,
        locale
    });

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;
        setMediaLoadSucceeded(false);

        accommodationMediaApi
            .listMedia({ id: accommodationId })
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[PhotoSection] listMedia failed:', result.error);
                    setIsHydrated(true);
                    return;
                }
                const { featured, gallery } = splitMediaRows(result.data.media);
                setFeaturedItem(featured);
                setGalleryItems(gallery);
                setMediaLoadSucceeded(true);
                setIsHydrated(true);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                webLogger.warn('[PhotoSection] listMedia error:', err);
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [accommodationId]);

    const reportUploadError = useCallback((message: string) => {
        setError(message);
        addToast({ type: 'error', message });
    }, []);

    /** Report a failed `addMedia` call (HOS-724; see `describeAddMediaError`). */
    const reportAddMediaError = useCallback(
        (error: ApiError) => {
            const { message, limit } = describeAddMediaError({ error, locale, t });
            setError(message);
            addToast(
                limit
                    ? { type: 'error', message, action: limit.action }
                    : { type: 'error', message }
            );
        },
        [locale, t]
    );

    // --- Featured image ---

    const processFeaturedFile = useCallback(
        async (file: File) => {
            const typeError = validatePhotoFileType(file, t);
            if (typeError) {
                reportUploadError(typeError);
                return;
            }

            setError(null);

            // HOS-332: resize/recompress before the size cap is checked, so a
            // heavy original that shrinks under the cap is accepted. Any
            // failure to compress (unsupported format, no canvas support)
            // falls back to the original file — never blocks the upload by
            // itself.
            setIsCompressing(true);
            const compression = await compressImageForUpload({ file });
            setIsCompressing(false);

            const uploadFile = compression.file;
            const sizeError = validatePhotoFileSize(uploadFile, t);
            if (sizeError) {
                reportUploadError(
                    isCompressionUnavailable(compression)
                        ? buildCompressionUnsupportedTooLargeMessage(t)
                        : sizeError
                );
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);
            // HOS-2489: an upload is a save; the shell chip says so. No chip
            // retry: a failed upload needs the file picked again.
            reportEditorAutoSave({ status: 'saving' });
            let saved = false;

            try {
                const uploaded = await uploadEntityImage({
                    file: uploadFile,
                    accommodationId,
                    onProgress: setUploadProgress
                });

                // HOS-803: ONE request, not two. The old pair — register a
                // gallery row, then promote it — was refused at the first step
                // whenever the gallery sat at the plan cap, so an owner at the
                // cap could never change their cover. This endpoint creates the
                // row already featured and disposes of the previous cover in
                // the same transaction.
                const addResult = await accommodationMediaApi.addFeaturedMedia({
                    id: accommodationId,
                    body: {
                        url: uploaded.url,
                        publicId: uploaded.publicId,
                        moderationState: 'APPROVED'
                    }
                });

                if (!addResult.ok) {
                    reportAddMediaError(addResult.error);
                    return;
                }

                const { media: newRow } = addResult.data;
                saved = true;

                // The replaced cover is NOT added to the gallery. Uploading a
                // new cover deletes the old one server-side, so appending it
                // here would leave a photo on screen that no longer exists —
                // and it is that demotion, on this path, that used to grow the
                // gallery by one on every replacement.
                setFeaturedItem(mediaRowToItem(newRow));
            } catch (err) {
                reportUploadError(
                    describeUploadEntityError({
                        err,
                        t,
                        fallback: t(
                            'host.properties.editor.photo.uploadFailed',
                            'Error al subir la imagen'
                        )
                    })
                );
            } finally {
                reportEditorAutoSave(
                    saved ? { status: 'saved', savedAt: new Date() } : { status: 'error' }
                );
                setIsUploading(false);
                setUploadProgress(null);
                if (featuredInputRef.current) {
                    featuredInputRef.current.value = '';
                }
            }
        },
        // `featuredItem` is no longer read here: the replaced cover is deleted
        // server-side rather than appended to the gallery (HOS-803).
        [accommodationId, t, reportUploadError, reportAddMediaError]
    );

    const handleFeaturedSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void processFeaturedFile(file);
        },
        [processFeaturedFile]
    );

    const handleFeaturedDrop = useCallback(
        (e: React.DragEvent<HTMLButtonElement>) => {
            e.preventDefault();
            setIsDragOverFeatured(false);
            if (isUploading || isCompressing || opLoading) return;
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            void processFeaturedFile(file);
        },
        [processFeaturedFile, isUploading, isCompressing, opLoading]
    );

    const handleFeaturedDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setIsDragOverFeatured(true);
    }, []);

    const handleFeaturedDragLeave = useCallback(() => setIsDragOverFeatured(false), []);

    // --- Gallery ---

    const processGalleryFiles = useCallback(
        async (files: readonly File[]) => {
            if (files.length === 0) return;

            const remainingSlots = galleryCap - galleryItems.length;
            if (files.length > remainingSlots) {
                reportUploadError(
                    buildCapExceededOnSelectMessage({
                        selectedCount: files.length,
                        remainingSlots,
                        cap: galleryCap,
                        t,
                        tPlural
                    })
                );
                return;
            }

            for (const file of files) {
                const typeError = validatePhotoFileType(file, t);
                if (typeError) {
                    reportUploadError(typeError);
                    return;
                }
            }

            setError(null);

            // HOS-332: resize/recompress the whole batch BEFORE checking the
            // size cap, so a heavy original that shrinks under the cap is
            // accepted — mirrors `processFeaturedFile`. Run concurrently
            // (decode/encode is CPU-bound, not I/O-bound) so the batch is not
            // gated behind N sequential compressions before any upload starts.
            setIsCompressing(true);
            const compressions = await Promise.all(
                files.map((file) => compressImageForUpload({ file }))
            );
            setIsCompressing(false);

            for (const compression of compressions) {
                const sizeError = validatePhotoFileSize(compression.file, t);
                if (sizeError) {
                    reportUploadError(
                        isCompressionUnavailable(compression)
                            ? buildCompressionUnsupportedTooLargeMessage(t)
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
                if (!file) continue;
                setUploadProgress(0);
                setUploadBatch(
                    files.length > 1 ? { current: index + 1, total: files.length } : null
                );

                try {
                    const uploaded = await uploadEntityImage({
                        file,
                        accommodationId,
                        onProgress: setUploadProgress
                    });

                    const addResult = await accommodationMediaApi.addMedia({
                        id: accommodationId,
                        body: {
                            url: uploaded.url,
                            publicId: uploaded.publicId,
                            moderationState: 'APPROVED'
                        }
                    });

                    if (!addResult.ok) {
                        allSaved = false;
                        reportAddMediaError(addResult.error);
                        // HOS-724: at the plan cap every remaining file in the
                        // batch would fail identically. Stop instead of firing
                        // one more toast per file — the host has been told, and
                        // the CTA they need is already on screen.
                        if (isPlanLimitReached(addResult.error)) {
                            break;
                        }
                        continue;
                    }

                    setGalleryItems((prev) => [...prev, mediaRowToItem(addResult.data.media)]);
                } catch (err) {
                    allSaved = false;
                    reportUploadError(
                        describeUploadEntityError({
                            err,
                            t,
                            fallback: t(
                                'host.properties.editor.photo.uploadFailed',
                                'Error al subir la imagen'
                            )
                        })
                    );
                }
            }

            reportEditorAutoSave(
                allSaved ? { status: 'saved', savedAt: new Date() } : { status: 'error' }
            );
            setIsUploading(false);
            setUploadProgress(null);
            setUploadBatch(null);
            if (galleryInputRef.current) {
                galleryInputRef.current.value = '';
            }
        },
        [
            accommodationId,
            galleryCap,
            galleryItems.length,
            t,
            tPlural,
            reportUploadError,
            reportAddMediaError
        ]
    );

    const handleGallerySelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files ?? []);
            void processGalleryFiles(files);
        },
        [processGalleryFiles]
    );

    const handleGalleryDrop = useCallback(
        (e: React.DragEvent<HTMLButtonElement>) => {
            e.preventDefault();
            setIsDragOverGallery(false);
            if (isUploading || isCompressing || opLoading) return;
            const files = Array.from(e.dataTransfer.files ?? []);
            void processGalleryFiles(files);
        },
        [processGalleryFiles, isUploading, isCompressing, opLoading]
    );

    const handleGalleryDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setIsDragOverGallery(true);
    }, []);

    const handleGalleryDragLeave = useCallback(() => setIsDragOverGallery(false), []);

    const {
        handleFeaturedRemove,
        handleGalleryRemove,
        handlePromoteToFeatured,
        handleMoveUp,
        handleMoveDown,
        handleReorderGallery,
        handleUpdateMediaText
    } = usePhotoGalleryMutations({
        accommodationId,
        t,
        featuredItem,
        galleryItems,
        isHydrated,
        setFeaturedItem,
        setGalleryItems,
        setError,
        setOpLoading,
        reportUploadError,
        confirmRemoval
    });

    const anyOpInFlight = isUploading || isCompressing || opLoading;
    const opsReady = isHydrated;

    return {
        featuredItem,
        galleryItems,
        isUploading,
        isCompressing,
        uploadProgress,
        uploadBatch,
        error,
        isDragOverFeatured,
        isDragOverGallery,
        isGalleryFull,
        capUpsell,
        opsReady,
        mediaLoadSucceeded,
        anyOpInFlight,
        featuredInputRef,
        galleryInputRef,
        handleFeaturedSelect,
        handleFeaturedDrop,
        handleFeaturedDragOver,
        handleFeaturedDragLeave,
        handleFeaturedRemove,
        handleGallerySelect,
        handleGalleryDrop,
        handleGalleryDragOver,
        handleGalleryDragLeave,
        handleGalleryRemove,
        handlePromoteToFeatured,
        handleMoveUp,
        handleMoveDown,
        handleReorderGallery,
        handleUpdateMediaText
    };
}
