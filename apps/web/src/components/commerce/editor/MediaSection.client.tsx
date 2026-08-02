/**
 * @file MediaSection.client.tsx
 * @description Featured image + photo gallery section of the commerce owner
 * editor (SPEC-249 T-015c, extracted in HOS-258).
 *
 * Uploads go to the protected `media/upload-entity` endpoint (which already
 * accepts the `gastronomy` and `experience` entity types, T-015a/b); removals
 * call the protected `delete-entity` endpoint best-effort for Cloudinary
 * cleanup.
 *
 * Fully controlled: every edit produces a complete `{ featuredImage, gallery }`
 * value passed to `onChange`. The orchestrator owns the state and persists the
 * full `media` object — gastronomy/experience do NOT merge the media JSONB, so
 * the complete media state (including the owner-invisible `videos` /
 * `archivedGallery` passthrough) always travels on save.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { getGalleryCap, type Image } from '@repo/schemas';
import { type JSX, useCallback, useRef, useState } from 'react';
import { protectedMediaApi } from '@/lib/api/endpoints-protected';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { resolveUploadTimeoutMs } from '@/lib/media/upload-entity';
import fieldStyles from './editor-fields.module.css';
import styles from './MediaSection.module.css';

/** Translator function shape (matches the editor's `createTranslations().t`). */
type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

export interface MediaSectionProps {
    readonly locale: SupportedLocale;
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
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

/**
 * Thrown when the upload exceeds its client-side budget.
 *
 * A distinct type because the browser's own abort error carries a
 * vendor-specific English message, and the catch path renders `err.message`
 * directly.
 */
class UploadTimeoutError extends Error {
    constructor() {
        super('upload-timeout');
        this.name = 'UploadTimeoutError';
    }
}

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

    // Bounded like the accommodation editor's XHR helper (BETA-134). Without a
    // signal this `fetch` waits forever, so a stalled connection leaves the
    // owner on a spinner with no error and no way out but a reload — a risk
    // that grew with the raised size cap, since a bigger photo spends longer on
    // the wire. Uses the same size-scaled budget so both editors behave alike.
    //
    // `AbortController` + `setTimeout` rather than `AbortSignal.timeout`: the
    // latter needs Safari 16, and nothing else this app ships to a browser
    // requires anything that recent. On an older iOS it would not degrade — the
    // property access throws before `fetch` runs, breaking commerce uploads
    // outright. This pairing also matches how the rest of the codebase cancels
    // requests.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), resolveUploadTimeoutMs(file.size));

    let response: Response;
    try {
        response = await fetch(`${getApiUrl()}/api/v1/protected/media/upload-entity`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            signal: controller.signal
        });
    } catch (error) {
        // An abort surfaces as a vendor-specific English DOMException whose
        // `message` would otherwise be rendered verbatim in a Spanish UI, since
        // `DOMException` satisfies `instanceof Error`. Re-throw a typed marker
        // the caller can translate.
        if (controller.signal.aborted) {
            throw new UploadTimeoutError();
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }

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
 * Turn an upload failure into a message worth showing.
 *
 * A timeout gets its own localized sentence: the browser's abort error carries
 * vendor-specific English text ("signal timed out"), and because `DOMException`
 * satisfies `instanceof Error`, a naive `err.message` would render it verbatim
 * in a Spanish UI.
 *
 * @param err - The thrown value
 * @param t - Active translator
 * @returns A user-facing message
 */
function describeUploadError(err: unknown, t: Translate): string {
    if (err instanceof UploadTimeoutError) {
        return t(
            'commerce.owner.editor.media.uploadTimeout',
            'La subida tardó demasiado. Probá de nuevo.'
        );
    }
    return err instanceof Error
        ? err.message
        : t('commerce.owner.editor.media.uploadFailed', 'Error al subir la imagen');
}

export function MediaSection({
    locale,
    vertical,
    listingId,
    featuredImage,
    gallery,
    onChange
}: MediaSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
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
                return t(
                    'commerce.owner.editor.media.tooLarge',
                    'El archivo no puede superar {{maxSize}}MB',
                    { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
                );
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
                setError(describeUploadError(err, t));
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
                webLogger.warn('[MediaSection] featured image delete failed:', err);
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
                setError(describeUploadError(err, t));
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
                        webLogger.warn('[MediaSection] gallery image delete failed:', err);
                    });
            }
        },
        [featuredImage, gallery, onChange]
    );

    return (
        <section
            className={fieldStyles.section}
            id="editor-media"
        >
            <span className={fieldStyles.label}>
                {t('commerce.owner.editor.sections.media', 'Galería de fotos')}
            </span>
            <div className={styles.media}>
                <div className={styles.mediaGroup}>
                    <span className={fieldStyles.label}>
                        {t('commerce.owner.editor.media.featured', 'Imagen principal')}
                    </span>
                    {featuredImage ? (
                        <div className={styles.mediaThumb}>
                            <img
                                src={featuredImage.url}
                                alt={t('commerce.owner.editor.media.featured', 'Imagen principal')}
                                className={styles.mediaImage}
                            />
                            <button
                                type="button"
                                className={styles.mediaRemove}
                                aria-label={t('commerce.owner.editor.media.remove', 'Eliminar')}
                                onClick={handleFeaturedRemove}
                            >
                                ×
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={styles.mediaAdd}
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
                        className={styles.mediaFileInput}
                        onChange={handleFeaturedSelect}
                    />
                </div>

                <div className={styles.mediaGroup}>
                    <span className={fieldStyles.label}>
                        {t('commerce.owner.editor.media.gallery', 'Galería de fotos')}
                    </span>
                    <div className={styles.mediaGallery}>
                        {gallery.map((image, index) => (
                            <div
                                key={image.publicId ?? image.url}
                                className={styles.mediaThumb}
                            >
                                <img
                                    src={image.url}
                                    alt={t(
                                        'commerce.owner.editor.media.gallery',
                                        'Galería de fotos'
                                    )}
                                    className={styles.mediaImage}
                                />
                                <button
                                    type="button"
                                    className={styles.mediaRemove}
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
                                className={styles.mediaAdd}
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
                        className={styles.mediaFileInput}
                        onChange={handleGallerySelect}
                    />
                    <span className={styles.mediaHint}>
                        {t(
                            'commerce.owner.editor.media.uploadHint',
                            'JPG, PNG o WebP — máx. {{maxSize}}MB',
                            { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
                        )}
                    </span>
                </div>

                {error && (
                    <p
                        className={fieldStyles.error}
                        role="alert"
                    >
                        {error}
                    </p>
                )}
            </div>
        </section>
    );
}
