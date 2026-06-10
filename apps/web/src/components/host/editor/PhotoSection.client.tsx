/**
 * @file PhotoSection.client.tsx
 * @description Photo section for the accommodation editor.
 *
 * Handles featured image and gallery image uploads via the protected
 * media upload endpoint. Provides file selection, preview, upload progress,
 * and delete functionality.
 */

import type { MediaImage } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useRef, useState } from 'react';
import styles from './PhotoSection.module.css';

// Re-export for consumers that import MediaImage from this module
export type { MediaImage };

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
        onFeaturedImageChange(null);
    }, [onFeaturedImageChange]);

    // --- Gallery upload ---

    const handleGallerySelect = useCallback(
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
        [accommodationId, data.gallery, validateFile, onGalleryChange, t]
    );

    const handleGalleryRemove = useCallback(
        (index: number) => {
            const newGallery = data.gallery.filter((_, i) => i !== index);
            onGalleryChange(newGallery);
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

                    <button
                        type="button"
                        className={styles.galleryAddButton}
                        onClick={() => !isUploading && galleryInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        +
                    </button>
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
