import { adminLogger } from '@/utils/logger';
import { extractPublicId } from '@repo/media';
import * as React from 'react';
import type { GalleryImage } from './gallery-types';

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
    /** Handle a FileList from input or drop event. */
    handleFilesSelect: (files: FileList) => Promise<void>;
    /** Remove an image from the gallery (optionally deleting from storage). */
    handleRemoveImage: (imageId: string, imageUrl: string) => Promise<void>;
    /** Update caption/alt/description on a single image. */
    handleUpdateImage: (imageId: string, updates: Partial<GalleryImage>) => void;
}

const generateId = (): string => `img-${crypto.randomUUID()}`;

/**
 * Encapsulates the upload, delete, and per-item update logic for GalleryField.
 *
 * Kept as a standalone hook so GalleryField.tsx stays under the 500 LOC limit
 * and the upload/delete flow can be tested in isolation.
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

    const handleFilesSelect = async (files: FileList) => {
        if (!files.length) return;

        const filesToProcess = Array.from(files).slice(0, maxImages - value.length);
        setIsUploading(true);
        setUploadError(null);

        try {
            const newImages: GalleryImage[] = [];

            for (const file of filesToProcess) {
                if (!allowedTypes.includes(file.type)) {
                    adminLogger.error(`Invalid file type: ${file.name}`);
                    setUploadError(
                        `"${file.name}": invalid type. Allowed: ${allowedTypes.join(', ')}`
                    );
                    continue;
                }

                if (file.size > maxSize) {
                    adminLogger.error(`File too large: ${file.name}`);
                    setUploadError(
                        `"${file.name}": file exceeds max size of ${formatFileSize(maxSize)}`
                    );
                    continue;
                }

                const tempId = generateId();
                setUploadingIds((prev) => new Set(prev).add(tempId));

                let imageUrl: string;

                try {
                    if (onUpload) {
                        imageUrl = await onUpload(file);
                    } else {
                        imageUrl = URL.createObjectURL(file);
                    }
                } catch (uploadErr) {
                    adminLogger.error(`Upload failed: ${file.name}`, uploadErr);
                    setUploadError(
                        uploadErr instanceof Error
                            ? uploadErr.message
                            : `Failed to upload "${file.name}"`
                    );
                    setUploadingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(tempId);
                        return next;
                    });
                    continue;
                }

                setUploadingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(tempId);
                    return next;
                });

                const galleryImage: GalleryImage = {
                    id: generateId(),
                    url: imageUrl,
                    alt: file.name,
                    order: value.length + newImages.length
                };
                newImages.push(galleryImage);
            }

            if (newImages.length > 0) {
                onChange?.([...value, ...newImages]);
            }
        } finally {
            setIsUploading(false);
            setUploadingIds(new Set());
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
        handleFilesSelect,
        handleRemoveImage,
        handleUpdateImage
    };
};
