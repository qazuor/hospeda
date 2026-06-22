/**
 * @file MediaField.tsx
 * @description Controlled media editor for a commerce listing's featured image
 * and photo gallery (SPEC-249 T-015c). Uploads go to the protected
 * `media/upload-entity` endpoint (which already accepts the `gastronomy` and
 * `experience` entity types, T-015a/b); removals call the protected
 * `delete-entity` endpoint best-effort for Cloudinary cleanup.
 *
 * Fully controlled: every edit produces a complete `{ featuredImage, gallery }`
 * value passed to `onChange` (the parent owns dirty tracking and persists the
 * full `media` object — gastronomy/experience do NOT merge the media JSONB, so
 * the parent always sends the complete media state on save).
 */
import { protectedMediaApi } from '@/lib/api/endpoints-protected';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { getApiUrl } from '@/lib/env';
import { webLogger } from '@/lib/logger';
import { type Image, getGalleryCap } from '@repo/schemas';
import { type JSX, useCallback, useRef, useState } from 'react';

/** Translator function shape (matches the editor's `createTranslations().t`). */
type Translate = (key: string, fallback?: string) => string;

interface MediaFieldProps {
    /** Vertical of the listing (drives the upload entityType + gallery cap). */
    readonly vertical: CommerceVertical;
    /** UUID of the listing being edited (upload entityId). */
    readonly listingId: string;
    /** Current featured image, or null when none. */
    readonly featuredImage: Image | null;
    /** Current gallery images (possibly empty). */
    readonly gallery: readonly Image[];
    /** Emits the full next media state whenever featured/gallery changes. */
    readonly onChange: (next: {
        readonly featuredImage: Image | null;
        readonly gallery: readonly Image[];
    }) => void;
    /** Active editor translator. */
    readonly t: Translate;
    /** Shared CSS-module classes from the hosting editor. */
    readonly classes: Readonly<Record<string, string>>;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Upload a single image to the protected entity-upload endpoint.
 *
 * @returns The uploaded `Image` (Cloudinary url + metadata, moderationState APPROVED).
 */
async function uploadEntityImage({
    file,
    vertical,
    listingId,
    role
}: {
    readonly file: File;
    readonly vertical: CommerceVertical;
    readonly listingId: string;
    readonly role: 'featured' | 'gallery';
}): Promise<Image> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', vertical);
    formData.append('entityId', listingId);
    formData.append('role', role);

    const response = await fetch(`${getApiUrl()}/api/v1/protected/media/upload-entity`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    });

    const json = (await response.json().catch(() => null)) as {
        readonly success?: boolean;
        readonly data?: Image;
        readonly error?: { readonly message?: string };
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message ?? 'Upload failed');
    }
    return json.data;
}

/**
 * Featured-image + gallery editor. Self-contained upload/validation/error UI;
 * delegates state ownership to the parent through `onChange`.
 */
export function MediaField({
    vertical,
    listingId,
    featuredImage,
    gallery,
    onChange,
    t,
    classes
}: MediaFieldProps): JSX.Element {
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const galleryCap = getGalleryCap(vertical);
    const isGalleryFull = gallery.length >= galleryCap;

    /** Validate a selected file; returns a localized error message or null. */
    const validateFile = useCallback(
        (file: File): string | null => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                return t(
                    'commerce.owner.editor.media.invalidType',
                    'Solo se permiten archivos JPG, PNG o WebP'
                );
            }
            if (file.size > MAX_SIZE_BYTES) {
                return t('commerce.owner.editor.media.tooLarge', 'El archivo no puede superar 5MB');
            }
            return null;
        },
        [t]
    );

    const handleFeaturedSelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                return;
            }
            setError(null);
            setIsUploading(true);
            try {
                const uploaded = await uploadEntityImage({
                    file,
                    vertical,
                    listingId,
                    role: 'featured'
                });
                onChange({ featuredImage: uploaded, gallery });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : t('commerce.owner.editor.media.uploadFailed', 'Error al subir la imagen')
                );
            } finally {
                setIsUploading(false);
                if (featuredInputRef.current) {
                    featuredInputRef.current.value = '';
                }
            }
        },
        [validateFile, vertical, listingId, gallery, onChange, t]
    );

    const handleFeaturedRemove = useCallback(() => {
        const removed = featuredImage;
        onChange({ featuredImage: null, gallery });
        if (removed?.publicId) {
            protectedMediaApi.deleteMedia({ publicId: removed.publicId }).catch((err: unknown) => {
                webLogger.warn('[MediaField] featured image delete failed:', err);
            });
        }
    }, [featuredImage, gallery, onChange]);

    const handleGallerySelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            if (isGalleryFull) {
                setError(
                    t(
                        'commerce.owner.editor.media.capReached',
                        'Límite de galería alcanzado (máx. {{cap}} fotos)'
                    ).replace('{{cap}}', String(galleryCap))
                );
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
                return;
            }
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                return;
            }
            setError(null);
            setIsUploading(true);
            try {
                const uploaded = await uploadEntityImage({
                    file,
                    vertical,
                    listingId,
                    role: 'gallery'
                });
                onChange({ featuredImage, gallery: [...gallery, uploaded] });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : t('commerce.owner.editor.media.uploadFailed', 'Error al subir la imagen')
                );
            } finally {
                setIsUploading(false);
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
            }
        },
        [
            isGalleryFull,
            validateFile,
            vertical,
            listingId,
            featuredImage,
            gallery,
            onChange,
            t,
            galleryCap
        ]
    );

    const handleGalleryRemove = useCallback(
        (index: number) => {
            const removed = gallery[index];
            onChange({ featuredImage, gallery: gallery.filter((_, i) => i !== index) });
            if (removed?.publicId) {
                protectedMediaApi
                    .deleteMedia({ publicId: removed.publicId })
                    .catch((err: unknown) => {
                        webLogger.warn('[MediaField] gallery image delete failed:', err);
                    });
            }
        },
        [featuredImage, gallery, onChange]
    );

    return (
        <div className={classes.media}>
            <div className={classes.mediaGroup}>
                <span className={classes.label}>
                    {t('commerce.owner.editor.media.featured', 'Imagen principal')}
                </span>
                {featuredImage ? (
                    <div className={classes.mediaThumb}>
                        <img
                            src={featuredImage.url}
                            alt={t('commerce.owner.editor.media.featured', 'Imagen principal')}
                            className={classes.mediaImage}
                        />
                        <button
                            type="button"
                            className={classes.mediaRemove}
                            aria-label={t('commerce.owner.editor.media.remove', 'Eliminar')}
                            onClick={handleFeaturedRemove}
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={classes.mediaAdd}
                        disabled={isUploading}
                        onClick={() => featuredInputRef.current?.click()}
                    >
                        {t('commerce.owner.editor.media.add', 'Agregar foto')}
                    </button>
                )}
                <input
                    ref={featuredInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={t('commerce.owner.editor.media.featured', 'Imagen principal')}
                    className={classes.mediaFileInput}
                    onChange={handleFeaturedSelect}
                />
            </div>

            <div className={classes.mediaGroup}>
                <span className={classes.label}>
                    {t('commerce.owner.editor.media.gallery', 'Galería de fotos')}
                </span>
                <div className={classes.mediaGallery}>
                    {gallery.map((image, index) => (
                        <div
                            key={image.publicId ?? image.url}
                            className={classes.mediaThumb}
                        >
                            <img
                                src={image.url}
                                alt={t('commerce.owner.editor.media.gallery', 'Galería de fotos')}
                                className={classes.mediaImage}
                            />
                            <button
                                type="button"
                                className={classes.mediaRemove}
                                aria-label={t('commerce.owner.editor.media.remove', 'Eliminar')}
                                onClick={() => handleGalleryRemove(index)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {!isGalleryFull && (
                        <button
                            type="button"
                            className={classes.mediaAdd}
                            disabled={isUploading}
                            aria-label={t('commerce.owner.editor.media.add', 'Agregar foto')}
                            onClick={() => galleryInputRef.current?.click()}
                        >
                            +
                        </button>
                    )}
                </div>
                <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={t('commerce.owner.editor.media.gallery', 'Galería de fotos')}
                    className={classes.mediaFileInput}
                    onChange={handleGallerySelect}
                />
                <span className={classes.mediaHint}>
                    {t('commerce.owner.editor.media.uploadHint', 'JPG, PNG o WebP — máx. 5MB')}
                </span>
            </div>

            {error && (
                <p
                    className={classes.error}
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
