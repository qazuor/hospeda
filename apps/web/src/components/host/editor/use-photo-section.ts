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
import { accommodationMediaApi } from '@/lib/api/endpoints-protected';
import type { AccommodationMediaItem, MediaImage } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { uploadEntityImage } from '@/lib/media/upload-entity';
import { addToast } from '@/store/toast-store';
import {
    buildCapExceededOnSelectMessage,
    mediaRowToItem,
    type PhotoMetadataUpdateBody,
    splitMediaRows,
    validatePhotoFile
} from './photo-section-helpers';
import { usePhotoGalleryMutations } from './use-photo-gallery-mutations';

/**
 * Map a legacy `MediaImage` (no DB id, SSR-only) to a partial display object.
 * Used only for the first-paint placeholder; once listMedia resolves, these
 * are replaced by real `AccommodationMediaItem` values that carry DB ids.
 * The empty id prevents any API call until the real rows load.
 */
function legacyToDisplay(img: MediaImage, isFeatured: boolean): AccommodationMediaItem {
    return {
        id: '',
        url: img.url,
        publicId: img.publicId,
        isFeatured
    };
}

export interface UsePhotoSectionParams {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly galleryCap: number;
    readonly initialFeaturedImage?: MediaImage | null;
    readonly initialGallery?: readonly MediaImage[];
}

/** Progress marker for a multi-file upload batch. */
export interface UploadBatchProgress {
    readonly current: number;
    readonly total: number;
}

export interface UsePhotoSectionResult {
    readonly featuredItem: AccommodationMediaItem | null;
    readonly galleryItems: readonly AccommodationMediaItem[];
    readonly isUploading: boolean;
    readonly uploadProgress: number | null;
    readonly uploadBatch: UploadBatchProgress | null;
    readonly error: string | null;
    readonly isDragOverFeatured: boolean;
    readonly isDragOverGallery: boolean;
    readonly isGalleryFull: boolean;
    readonly opsReady: boolean;
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
    readonly handleUpdateMediaText: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

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
    initialGallery = []
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
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadBatch, setUploadBatch] = useState<UploadBatchProgress | null>(null);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOverFeatured, setIsDragOverFeatured] = useState(false);
    const [isDragOverGallery, setIsDragOverGallery] = useState(false);

    const isGalleryFull = galleryItems.length >= galleryCap;

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;

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

    // --- Featured image ---

    const processFeaturedFile = useCallback(
        async (file: File) => {
            const validationError = validatePhotoFile(file, t);
            if (validationError) {
                reportUploadError(validationError);
                return;
            }

            setError(null);
            setIsUploading(true);
            setUploadProgress(0);

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
                    reportUploadError(
                        addResult.error.message ??
                            t(
                                'host.properties.editor.photo.persistFailed',
                                'No se pudo guardar la imagen en la base de datos'
                            )
                    );
                    return;
                }

                const newRow = addResult.data.media;
                const featuredResult = await accommodationMediaApi.setFeaturedMedia({
                    id: accommodationId,
                    mediaId: newRow.id
                });

                if (!featuredResult.ok) {
                    reportUploadError(
                        featuredResult.error.message ??
                            t(
                                'host.properties.editor.photo.featuredFailed',
                                'No se pudo marcar la imagen como portada'
                            )
                    );
                    return;
                }

                setGalleryItems((prev) => {
                    const base = featuredItem
                        ? [...prev, { ...featuredItem, isFeatured: false }]
                        : [...prev];
                    return base;
                });
                setFeaturedItem(mediaRowToItem(featuredResult.data.media));
            } catch (err) {
                reportUploadError(
                    err instanceof Error
                        ? err.message
                        : t('host.properties.editor.photo.uploadFailed', 'Error al subir la imagen')
                );
            } finally {
                setIsUploading(false);
                setUploadProgress(null);
                if (featuredInputRef.current) {
                    featuredInputRef.current.value = '';
                }
            }
        },
        [accommodationId, featuredItem, t, reportUploadError]
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
            if (isUploading || opLoading) return;
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            void processFeaturedFile(file);
        },
        [processFeaturedFile, isUploading, opLoading]
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
                const validationError = validatePhotoFile(file, t);
                if (validationError) {
                    reportUploadError(validationError);
                    return;
                }
            }

            setError(null);
            setIsUploading(true);

            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
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
                        reportUploadError(
                            addResult.error.message ??
                                t(
                                    'host.properties.editor.photo.persistFailed',
                                    'No se pudo guardar la imagen en la base de datos'
                                )
                        );
                        continue;
                    }

                    setGalleryItems((prev) => [...prev, mediaRowToItem(addResult.data.media)]);
                } catch (err) {
                    reportUploadError(
                        err instanceof Error
                            ? err.message
                            : t(
                                  'host.properties.editor.photo.uploadFailed',
                                  'Error al subir la imagen'
                              )
                    );
                }
            }

            setIsUploading(false);
            setUploadProgress(null);
            setUploadBatch(null);
            if (galleryInputRef.current) {
                galleryInputRef.current.value = '';
            }
        },
        [accommodationId, galleryCap, galleryItems.length, t, tPlural, reportUploadError]
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
            if (isUploading || opLoading) return;
            const files = Array.from(e.dataTransfer.files ?? []);
            void processGalleryFiles(files);
        },
        [processGalleryFiles, isUploading, opLoading]
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
        reportUploadError
    });

    const anyOpInFlight = isUploading || opLoading;
    const opsReady = isHydrated;

    return {
        featuredItem,
        galleryItems,
        isUploading,
        uploadProgress,
        uploadBatch,
        error,
        isDragOverFeatured,
        isDragOverGallery,
        isGalleryFull,
        opsReady,
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
        handleUpdateMediaText
    };
}
