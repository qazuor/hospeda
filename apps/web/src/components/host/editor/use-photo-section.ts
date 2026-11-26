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
import type { AccommodationMediaItem, ApiError } from '@/lib/api/types';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { compressImageForUpload, isCompressionUnavailable } from '@/lib/media/compress-image';
import { describeUploadEntityError, UploadEntityError } from '@/lib/media/upload-entity-error';
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
    describeAddMediaError,
    isPlanLimitReached,
    legacyToDisplay,
    type UploadBatchProgress,
    type UsePhotoSectionParams,
    type UsePhotoSectionResult
} from './photo-section-model';
import { usePhotoAllowance } from './use-photo-allowance';
import { usePhotoGalleryMutations } from './use-photo-gallery-mutations';

export type { UploadBatchProgress, UsePhotoSectionParams, UsePhotoSectionResult };

/**
 * Self-contained photo-section state machine (SPEC-204 persistence model +
 * HOS-122 multi-upload / reorder / promote / drag-drop). See
 * `PhotoSection.client.tsx` for the rendered UI that consumes this hook.
 */
export function usePhotoSection({
    locale,
    api,
    listingId,
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

    // HOS-2495: the cap is the listing's photo allowance, read from the API
    // that enforces it — the same number step 7 uses, for every vertical.
    const {
        allowance,
        capView,
        galleryCap,
        isGalleryFull,
        isGalleryUploadOpen,
        isCoverUploadOpen,
        overCapIds,
        capUpsell,
        refreshAllowance
    } = usePhotoAllowance({ api, listingId, galleryItems, locale });

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;
        setMediaLoadSucceeded(false);

        api.listMedia({ id: listingId })
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
    }, [api, listingId]);

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

            // HOS-332: compress before the size check; a failed compression
            // falls back to the original file and never blocks the upload.
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
                const uploaded = await api.uploadImage({
                    file: uploadFile,
                    listingId,
                    role: 'featured',
                    onProgress: setUploadProgress
                });

                // HOS-803: ONE request. It creates the row already featured and
                // disposes of the previous cover in the same transaction, so an
                // owner at the gallery cap can still change their cover.
                const addResult = await api.addFeaturedMedia({
                    id: listingId,
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

                // The replaced cover is deleted server-side, so it is NOT
                // appended to the gallery here.
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
                // A cover change can change `coverAllowed`; re-read the allowance.
                void refreshAllowance();
            }
        },
        [api, listingId, t, reportUploadError, reportAddMediaError, refreshAllowance]
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
            if (isUploading || isCompressing || opLoading || !isCoverUploadOpen) return;
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            void processFeaturedFile(file);
        },
        [processFeaturedFile, isUploading, isCompressing, opLoading, isCoverUploadOpen]
    );

    const handleFeaturedDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setIsDragOverFeatured(true);
    }, []);

    const handleFeaturedDragLeave = useCallback(() => setIsDragOverFeatured(false), []);

    // --- Gallery ---

    const processGalleryFiles = useCallback(
        async (files: readonly File[]) => {
            if (files.length === 0 || !isGalleryUploadOpen) return;

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

            // HOS-332: compress the whole batch (concurrently) BEFORE the size
            // check, mirroring `processFeaturedFile`.
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
                    const uploaded = await api.uploadImage({
                        file,
                        listingId,
                        role: 'gallery',
                        onProgress: setUploadProgress
                    });

                    const addResult = await api.addMedia({
                        id: listingId,
                        body: {
                            url: uploaded.url,
                            publicId: uploaded.publicId,
                            moderationState: 'APPROVED'
                        }
                    });

                    if (!addResult.ok) {
                        allSaved = false;
                        reportAddMediaError(addResult.error);
                        // HOS-724: at the cap every remaining file would fail
                        // the same way; stop after one toast.
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
                    // HOS-2495: the upload itself is capped too (step 7 on
                    // upload-entity). At the cap every remaining file would be
                    // refused the same way, so stop after one message.
                    if (
                        err instanceof UploadEntityError &&
                        err.status === 403 &&
                        err.code === 'LIMIT_REACHED'
                    ) {
                        break;
                    }
                }
            }

            // The batch changed `used` (and maybe `hiddenCount`): re-read it.
            void refreshAllowance();

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
            api,
            listingId,
            galleryCap,
            galleryItems.length,
            isGalleryUploadOpen,
            t,
            tPlural,
            reportUploadError,
            reportAddMediaError,
            refreshAllowance
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
        api,
        listingId,
        t,
        featuredItem,
        galleryItems,
        isHydrated,
        setFeaturedItem,
        setGalleryItems,
        setError,
        setOpLoading,
        reportUploadError,
        confirmRemoval,
        onUsageChanged: refreshAllowance
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
        allowance,
        capView,
        overCapIds,
        isGalleryUploadOpen,
        isCoverUploadOpen,
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
