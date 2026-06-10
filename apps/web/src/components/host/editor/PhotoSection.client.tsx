/**
 * @file PhotoSection.client.tsx
 * @description Photo section for the accommodation editor.
 *
 * Handles featured image and gallery image uploads via the protected
 * media upload endpoint. Provides file selection, preview, upload progress,
 * and delete functionality.
 *
 * Fix A (SPEC-208): On image remove, calls the protected DELETE endpoint
 * (best-effort) so Cloudinary assets are cleaned up when a host removes a photo.
 *
 * Fix B (SPEC-208): Enforces the client-side gallery cap derived from
 * `ENTITY_GALLERY_CAPS.accommodation` (imported from @repo/schemas) so the
 * upload control is disabled and a localised message is shown when the gallery
 * is full — preventing a round-trip to the server.
 */

import { protectedMediaApi } from '@/lib/api/endpoints-protected';
import type { MediaImage } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { ENTITY_GALLERY_CAPS } from '@repo/schemas';
import { useCallback, useRef, useState } from 'react';
import styles from './PhotoSection.module.css';

// Re-export for consumers that import MediaImage from this module
export type { MediaImage };

/** Gallery cap for accommodation entities (mirrors server-side enforcement). */
const ACCOMMODATION_GALLERY_CAP = ENTITY_GALLERY_CAPS.accommodation;

/** Photo section data extracted from the accommodation's media JSONB. */
export interface PhotoSectionData {
    readonly featuredImage: MediaImage | null;
    readonly gallery: readonly MediaImage[];
}

/** Props for PhotoSection. */
export interface PhotoSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly data: PhotoSectionData;
    readonly onFeaturedImageChange: (image: MediaImage | null) => void;
    readonly onGalleryChange: (gallery: readonly MediaImage[]) => void;
}

// ---------------------------------------------------------------------------
// Upload API helper
// ---------------------------------------------------------------------------

/**
 * Upload a file to the protected media upload-entity endpoint.
 *
 * @returns The uploaded image metadata on success.
 */
async function uploadEntityImage({
    file,
    accommodationId,
    role,
    onProgress
}: {
    readonly file: File;
    readonly accommodationId: string;
    readonly role: 'featured' | 'gallery';
    readonly onProgress?: (percent: number) => void;
}): Promise<MediaImage> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'accommodation');
    formData.append('entityId', accommodationId);
    formData.append('role', role);

    return new Promise<MediaImage>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/protected/media/upload-entity');
        xhr.withCredentials = true;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText) as {
                    success?: boolean;
                    data?: MediaImage;
                    error?: { message?: string };
                };
                if (xhr.status >= 200 && xhr.status < 300 && response.data) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error?.message ?? 'Upload failed'));
                }
            } catch {
                reject(new Error('Invalid response from upload endpoint'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.send(formData);
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Photo section for the accommodation editor.
 *
 * Manages featured image and gallery uploads. Uses XHR for upload progress
 * tracking. File validation (type, size) is performed client-side before
 * the upload request is sent.
 *
 * On remove: calls the protected DELETE endpoint for Cloudinary cleanup
 * (best-effort — failures are logged but do not block the UI).
 *
 * Gallery cap: upload control is disabled once the gallery reaches
 * ACCOMMODATION_GALLERY_CAP images; a localised message is shown.
 */
export function PhotoSection({
    locale,
    accommodationId,
    data,
    onFeaturedImageChange,
    onGalleryChange
}: PhotoSectionProps) {
    const { t } = createTranslations(locale);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    /** Whether the gallery has reached the per-accommodation cap. */
    const isGalleryFull = data.gallery.length >= ACCOMMODATION_GALLERY_CAP;

    // --- Validation ---

    const validateFile = useCallback(
        (file: File): string | null => {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                return t(
                    'host.properties.editor.photo.invalidType',
                    'Solo se permiten archivos JPG, PNG o WebP'
                );
            }
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                return t(
                    'host.properties.editor.photo.tooLarge',
                    'El archivo no puede superar 5MB'
                );
            }
            return null;
        },
        [t]
    );

    // --- Featured image upload ---

    const handleFeaturedSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const error = validateFile(file);
            if (error) {
                setUploadError(error);
                return;
            }

            setUploadError(null);
            setIsUploading(true);
            setUploadProgress(0);

            try {
                const result = await uploadEntityImage({
                    file,
                    accommodationId,
                    role: 'featured',
                    onProgress: setUploadProgress
                });
                onFeaturedImageChange(result);
            } catch (err) {
                setUploadError(
                    err instanceof Error
                        ? err.message
                        : t('host.properties.editor.photo.uploadFailed', 'Error al subir la imagen')
                );
            } finally {
                setIsUploading(false);
                setUploadProgress(null);
                // Reset the input so the same file can be selected again
                if (featuredInputRef.current) {
                    featuredInputRef.current.value = '';
                }
            }
        },
        [accommodationId, validateFile, onFeaturedImageChange, t]
    );

    const handleFeaturedRemove = useCallback(() => {
        const removed = data.featuredImage;
        onFeaturedImageChange(null);
        // Fix A: best-effort Cloudinary cleanup
        if (removed?.publicId) {
            protectedMediaApi
                .deleteMedia({ publicId: removed.publicId })
                .then((result) => {
                    if (!result.ok) {
                        webLogger.warn(
                            '[PhotoSection] featured image delete returned non-ok:',
                            result.error
                        );
                    }
                })
                .catch((err: unknown) => {
                    webLogger.warn('[PhotoSection] featured image delete failed:', err);
                });
        }
    }, [data.featuredImage, onFeaturedImageChange]);

    // --- Gallery upload ---

    const handleGallerySelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Fix B: client-side cap guard (do not hit the server when already at cap)
            if (isGalleryFull) {
                setUploadError(
                    t(
                        'host.properties.editor.photo.galleryCapReached',
                        `Límite de galería alcanzado (máx. ${ACCOMMODATION_GALLERY_CAP} fotos)`
                    ).replace('{{cap}}', String(ACCOMMODATION_GALLERY_CAP))
                );
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
                return;
            }

            const error = validateFile(file);
            if (error) {
                setUploadError(error);
                return;
            }

            setUploadError(null);
            setIsUploading(true);
            setUploadProgress(0);

            try {
                const result = await uploadEntityImage({
                    file,
                    accommodationId,
                    role: 'gallery',
                    onProgress: setUploadProgress
                });
                onGalleryChange([...data.gallery, result]);
            } catch (err) {
                setUploadError(
                    err instanceof Error
                        ? err.message
                        : t('host.properties.editor.photo.uploadFailed', 'Error al subir la imagen')
                );
            } finally {
                setIsUploading(false);
                setUploadProgress(null);
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
            }
        },
        [accommodationId, data.gallery, validateFile, onGalleryChange, t, isGalleryFull]
    );

    const handleGalleryRemove = useCallback(
        (index: number) => {
            const removed = data.gallery[index];
            const newGallery = data.gallery.filter((_, i) => i !== index);
            onGalleryChange(newGallery);
            // Fix A: best-effort Cloudinary cleanup
            if (removed?.publicId) {
                protectedMediaApi
                    .deleteMedia({ publicId: removed.publicId })
                    .then((result) => {
                        if (!result.ok) {
                            webLogger.warn(
                                '[PhotoSection] gallery image delete returned non-ok:',
                                result.error
                            );
                        }
                    })
                    .catch((err: unknown) => {
                        webLogger.warn('[PhotoSection] gallery image delete failed:', err);
                    });
            }
        },
        [data.gallery, onGalleryChange]
    );

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
                {t('host.properties.editor.section.photos', 'Fotos')}
            </h3>
            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.section.photosDescription',
                    'Subí fotos de tu propiedad para atraer más huéspedes'
                )}
            </p>

            {/* Featured Image */}
            <div>
                <label
                    htmlFor="featured-image-input"
                    className={styles.uploadTextStrong}
                >
                    {t('host.properties.editor.photo.featured', 'Imagen principal')}
                </label>

                {data.featuredImage ? (
                    <div className={styles.preview}>
                        <img
                            src={data.featuredImage.url}
                            alt={t('host.properties.editor.photo.featuredAlt', 'Imagen principal')}
                            className={styles.previewImage}
                        />
                        <div className={styles.previewActions}>
                            <button
                                type="button"
                                className={styles.previewButton}
                                onClick={handleFeaturedRemove}
                                aria-label={t('host.properties.editor.photo.remove', 'Eliminar')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={`${styles.uploadArea} ${isUploading ? styles.uploadAreaDisabled : ''}`}
                        onClick={() => !isUploading && featuredInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        <span className={styles.uploadIcon}>📷</span>
                        <span className={styles.uploadText}>
                            {t(
                                'host.properties.editor.photo.dropOrClick',
                                'Arrastrá una imagen o hacé clic para seleccionar'
                            )}
                        </span>
                        <span className={styles.uploadHint}>
                            {t(
                                'host.properties.editor.photo.formats',
                                'JPG, PNG o WebP — máx. 5MB'
                            )}
                        </span>
                    </button>
                )}

                <input
                    ref={featuredInputRef}
                    id="featured-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={styles.fileInput}
                    onChange={handleFeaturedSelect}
                />
            </div>

            {/* Upload Progress */}
            {isUploading && uploadProgress !== null && (
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressBarFill}
                        style={{ width: `${uploadProgress}%` }}
                    />
                </div>
            )}

            {/* Upload Error */}
            {uploadError && <div className={styles.error}>{uploadError}</div>}

            {/* Gallery */}
            <div style={{ marginTop: '1.5rem' }}>
                <label
                    htmlFor="gallery-image-input"
                    className={styles.uploadTextStrong}
                >
                    {t('host.properties.editor.photo.gallery', 'Galería de fotos')}
                </label>

                {/* Fix B: gallery cap message when full */}
                {isGalleryFull && (
                    <p className={styles.error}>
                        {t(
                            'host.properties.editor.photo.galleryCapReached',
                            `Límite de galería alcanzado (máx. ${ACCOMMODATION_GALLERY_CAP} fotos)`
                        ).replace('{{cap}}', String(ACCOMMODATION_GALLERY_CAP))}
                    </p>
                )}

                <div className={styles.gallery}>
                    {data.gallery.map((image, index) => (
                        <div
                            key={image.publicId}
                            className={styles.galleryItem}
                        >
                            <img
                                src={image.url}
                                alt={t(
                                    'host.properties.editor.photo.galleryAlt',
                                    `Foto ${index + 1}`
                                )}
                                className={styles.galleryItemImage}
                            />
                            <div className={styles.galleryItemActions}>
                                <button
                                    type="button"
                                    className={styles.previewButton}
                                    onClick={() => handleGalleryRemove(index)}
                                    aria-label={t(
                                        'host.properties.editor.photo.remove',
                                        'Eliminar'
                                    )}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Fix B: disable add button when at cap */}
                    {!isGalleryFull && (
                        <button
                            type="button"
                            className={styles.galleryAddButton}
                            onClick={() => !isUploading && galleryInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            +
                        </button>
                    )}
                </div>

                <input
                    ref={galleryInputRef}
                    id="gallery-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={styles.fileInput}
                    onChange={handleGallerySelect}
                />
            </div>
        </div>
    );
}
