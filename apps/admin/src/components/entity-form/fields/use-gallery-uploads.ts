import { adminLogger } from '@/utils/logger';
import { extractPublicId } from '@repo/media';
import { ModerationStatusEnum } from '@repo/schemas';
import pLimit from 'p-limit';
import * as React from 'react';
import type { GalleryImage } from './gallery-types';

/**
 * Maximum number of parallel upload requests. Caps pressure on Cloudinary and
 * the admin's outbound connection budget while still amortising latency
 * across a large batch.
 */
export const GALLERY_UPLOAD_CONCURRENCY = 4;

/**
 * Inputs for the `useGalleryUploads` hook (RO-RO pattern).
 */
export interface UseGalleryUploadsInput {
    /** Current gallery value (uncontrolled snapshot). */
    value: GalleryImage[];
    /** Propagates changes to the gallery array back to the parent. */
    onChange?: (value: GalleryImage[]) => void;
    /** Maximum number of images allowed. */
    maxImages: number;
    /** Maximum per-file size in bytes. */
    maxSize: number;
    /** Allowed MIME types. */
    allowedTypes: readonly string[];
    /** Optional custom upload handler. If missing, uses `URL.createObjectURL`. */
    onUpload?: (file: File) => Promise<string>;
    /** Optional delete handler called with Cloudinary publicId before removal. */
    onDelete?: (publicId: string) => Promise<void>;
    /** Localized formatter for human-readable file sizes (used for errors). */
    formatFileSize: (bytes: number) => string;
}

/**
 * Snapshot describing the aggregate progress of the active batch upload.
 * Because `fetch()` does not expose request upload progress events, this is
 * inherently indeterminate: we track how many files the batch started with,
 * how many have resolved, and the total bytes being uploaded. GalleryField
 * surfaces these numbers inside a `role="status"` live region so assistive
 * tech announces activity even without a real percentage.
 */
export interface GalleryUploadProgress {
    /** Files resolved (successfully or with error). */
    completed: number;
    /** Total files selected in the current batch. */
    total: number;
    /** Aggregate size in bytes of the current batch (for display). */
    totalBytes: number;
}

/**
 * Outputs from the `useGalleryUploads` hook (RO-RO pattern).
 */
export interface UseGalleryUploadsOutput {
    /** True while a batch upload is in progress. */
    isUploading: boolean;
    /** IDs of gallery items currently uploading. */
    uploadingIds: ReadonlySet<string>;
    /** IDs of gallery items currently deleting. */
    deletingIds: ReadonlySet<string>;
    /** Current upload/delete error message, if any. */
    uploadError: string | null;
    /** Indeterminate progress snapshot for the active batch (null when idle). */
    progress: GalleryUploadProgress | null;
    /** Handle a FileList from input or drop event. */
    handleFilesSelect: (files: FileList) => Promise<void>;
    /** Remove an image from the gallery (optionally deleting from storage). */
    handleRemoveImage: (imageId: string, imageUrl: string) => Promise<void>;
    /** Update caption/alt/description on a single image. */
    handleUpdateImage: (imageId: string, updates: Partial<GalleryImage>) => void;
}

const generateId = (): string => `img-${crypto.randomUUID()}`;

interface UploadOutcome {
    file: File;
    tempId: string;
    url?: string;
    error?: unknown;
}

/**
 * Encapsulates the upload, delete, and per-item update logic for GalleryField.
 *
 * Kept as a standalone hook so GalleryField.tsx stays under the 500 LOC limit
 * and the upload/delete flow can be tested in isolation.
 *
 * T-046 (SPEC-078-GAPS):
 * - Parallel batch upload via `p-limit` (cap = {@link GALLERY_UPLOAD_CONCURRENCY}).
 *   Replaces the previous `for...of await` sequential loop so a 6-file drop
 *   finishes in roughly `ceil(6/4)` round trips instead of six.
 * - Exposes a `progress` snapshot for the active batch so GalleryField can
 *   surface an aria-live indicator ("Uploading X MB...").
 */
export const useGalleryUploads = ({
    value,
    onChange,
    maxImages,
    maxSize,
    allowedTypes,
    onUpload,
    onDelete,
    formatFileSize
}: UseGalleryUploadsInput): UseGalleryUploadsOutput => {
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadingIds, setUploadingIds] = React.useState<Set<string>>(new Set());
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());
    const [progress, setProgress] = React.useState<GalleryUploadProgress | null>(null);

    const uploadFile = async (file: File, tempId: string): Promise<UploadOutcome> => {
        try {
            const url = onUpload ? await onUpload(file) : URL.createObjectURL(file);
            return { file, tempId, url };
        } catch (err) {
            adminLogger.error(`Upload failed: ${file.name}`, err);
            return { file, tempId, error: err };
        } finally {
            setUploadingIds((prev) => {
                const next = new Set(prev);
                next.delete(tempId);
                return next;
            });
            setProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : prev));
        }
    };

    const handleFilesSelect = async (files: FileList) => {
        if (!files.length) return;

        const filesToProcess = Array.from(files).slice(0, maxImages - value.length);

        // Partition into valid and invalid so we report validation errors
        // upfront without touching the upload queue.
        const validFiles: Array<{ file: File; tempId: string }> = [];
        let firstValidationError: string | null = null;

        for (const file of filesToProcess) {
            if (!allowedTypes.includes(file.type)) {
                adminLogger.error(`Invalid file type: ${file.name}`);
                if (!firstValidationError) {
                    firstValidationError = `"${file.name}": invalid type. Allowed: ${allowedTypes.join(', ')}`;
                }
                continue;
            }
            if (file.size > maxSize) {
                adminLogger.error(`File too large: ${file.name}`);
                if (!firstValidationError) {
                    firstValidationError = `"${file.name}": file exceeds max size of ${formatFileSize(maxSize)}`;
                }
                continue;
            }
            validFiles.push({ file, tempId: generateId() });
        }

        if (firstValidationError) {
            setUploadError(firstValidationError);
        } else {
            setUploadError(null);
        }

        if (validFiles.length === 0) return;

        const totalBytes = validFiles.reduce((sum, v) => sum + v.file.size, 0);

        setIsUploading(true);
        setProgress({ completed: 0, total: validFiles.length, totalBytes });
        setUploadingIds(() => new Set(validFiles.map((v) => v.tempId)));

        try {
            const limit = pLimit(GALLERY_UPLOAD_CONCURRENCY);
            const outcomes = await Promise.all(
                validFiles.map(({ file, tempId }) => limit(() => uploadFile(file, tempId)))
            );

            const successes = outcomes.filter(
                (o): o is UploadOutcome & { url: string } => typeof o.url === 'string'
            );
            const firstFailure = outcomes.find((o) => o.error !== undefined);

            if (firstFailure) {
                const err = firstFailure.error;
                setUploadError(
                    err instanceof Error
                        ? err.message
                        : `Failed to upload "${firstFailure.file.name}"`
                );
            }

            if (successes.length > 0) {
                const newImages: GalleryImage[] = successes.map((outcome, index) => ({
                    id: generateId(),
                    url: outcome.url,
                    alt: outcome.file.name,
                    order: value.length + index,
                    // ImageSchema.moderationState is required. New uploads default
                    // to PENDING so the moderation pipeline can review them; the
                    // admin can flip the value via the moderation UI if needed.
                    moderationState: ModerationStatusEnum.PENDING
                }));
                onChange?.([...value, ...newImages]);
            }
        } finally {
            setIsUploading(false);
            setUploadingIds(new Set());
            setProgress(null);
        }
    };

    const handleRemoveImage = async (imageId: string, imageUrl: string) => {
        setUploadError(null);
        setDeletingIds((prev) => new Set(prev).add(imageId));

        try {
            const publicId = extractPublicId(imageUrl);
            if (publicId && onDelete) {
                try {
                    await onDelete(publicId);
                } catch (deleteErr) {
                    adminLogger.error('Failed to delete image from Cloudinary', deleteErr);
                }
            }
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(imageId);
                return next;
            });
        }

        const updatedImages = value.filter((img) => img.id !== imageId);
        const reorderedImages = updatedImages.map((img, index) => ({ ...img, order: index }));
        onChange?.(reorderedImages);
    };

    const handleUpdateImage = (imageId: string, updates: Partial<GalleryImage>) => {
        const updatedImages = value.map((img) =>
            img.id === imageId ? { ...img, ...updates } : img
        );
        onChange?.(updatedImages);
    };

    return {
        isUploading,
        uploadingIds,
        deletingIds,
        uploadError,
        progress,
        handleFilesSelect,
        handleRemoveImage,
        handleUpdateImage
    };
};
