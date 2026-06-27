/**
 * @file PhotoSection.client.tsx
 * @description Self-contained photo section for the accommodation editor.
 *
 * SPEC-204: Migrated from JSONB-controlled (parent-owned state) to per-operation
 * persistence against the relational `accommodation_media` endpoints. Every
 * add/remove/set-featured call hits the API immediately — no buffering in the
 * parent PATCH payload.
 *
 * UX shape is preserved:
 *   - "Portada" slot (top): the `isFeatured` row from accommodation_media.
 *   - "Galería" grid (below): all visible, non-featured rows.
 *
 * On mount the component hydrates from `listMedia`. The `initial*` props are
 * used only for first-paint (SSR) display until the API response arrives —
 * they lack DB ids and are display-only.
 *
 * Featured-replace invariant: setting a new portada uploads → addMedia →
 * setFeaturedMedia. The backend unmarked the old row; we update local state
 * to reflect that. The old featured row moves to the gallery; it is NOT deleted.
 *
 * publicId collision avoidance: featured uploads use `role: 'gallery'` (not
 * 'featured') since the old fixed publicId path (`/featured`) would collide in
 * Cloudinary once multiple rows exist in the relational table.
 */

import { type AccommodationMediaRow, accommodationMediaApi } from '@/lib/api/endpoints-protected';
import type { AccommodationMediaItem, MediaImage } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { uploadEntityImage } from '@/lib/media/upload-entity';
import { ENTITY_GALLERY_CAPS } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PhotoSection.module.css';

// Re-export types for consumers that import from this module
export type { AccommodationMediaItem, MediaImage };

/** Gallery cap for accommodation entities (mirrors server-side enforcement). */
const ACCOMMODATION_GALLERY_CAP = ENTITY_GALLERY_CAPS.accommodation;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map an `AccommodationMediaRow` (from the API) to the richer `AccommodationMediaItem`
 * shape used by the photo editor's local state.
 */
function rowToItem(row: AccommodationMediaRow): AccommodationMediaItem {
    return {
        id: row.id,
        url: row.url,
        publicId: row.publicId ?? '',
        caption: row.caption,
        alt: row.alt,
        isFeatured: row.isFeatured
    };
}

/**
 * Map a legacy `MediaImage` (no DB id, SSR-only) to a partial display object.
 * Used only for the first-paint placeholder; once listMedia resolves, these
 * are replaced by real `AccommodationMediaItem` values that carry DB ids.
 *
 * We model it as `AccommodationMediaItem` with an empty id to keep the local
 * state type uniform — the empty id prevents any API call until the real rows load.
 */
function legacyToDisplay(img: MediaImage, isFeatured: boolean): AccommodationMediaItem {
    return {
        id: '',
        url: img.url,
        publicId: img.publicId,
        isFeatured
    };
}

// Re-export upload helper so existing callers of PhotoSection.client can still import it
export { uploadEntityImage } from '@/lib/media/upload-entity';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * @deprecated Legacy shape kept for backwards compat; no longer emitted by the
 * parent. Photo changes are persisted per-operation — the parent PATCH no longer
 * includes media.
 */
export interface PhotoSectionData {
    readonly featuredImage: MediaImage | null;
    readonly gallery: readonly MediaImage[];
}

/** Props for the self-contained PhotoSection (SPEC-204). */
export interface PhotoSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /**
     * Optional first-paint featured image (from SSR).
     * Shown until `listMedia` resolves. Lacks a DB id — cannot trigger API ops.
     */
    readonly initialFeaturedImage?: MediaImage | null;
    /**
     * Optional first-paint gallery (from SSR).
     * Shown until `listMedia` resolves. Lack DB ids — cannot trigger API ops.
     */
    readonly initialGallery?: readonly MediaImage[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Self-contained photo section for the accommodation editor.
 *
 * Hydrates on mount from `listMedia`. Each user operation (add gallery photo,
 * set portada, remove) is persisted immediately via a granular API call.
 * The parent PATCH no longer carries media data.
 *
 * Errors are shown inline (no toasts). On any op failure the local state is
 * NOT mutated, keeping the UI consistent with the server.
 */
export function PhotoSection({
    locale,
    accommodationId,
    initialFeaturedImage = null,
    initialGallery = []
}: PhotoSectionProps) {
    const { t } = createTranslations(locale);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // --- Local state ---

    // null = not yet hydrated from API; AccommodationMediaItem | null = loaded
    const [featuredItem, setFeaturedItem] = useState<AccommodationMediaItem | null>(() =>
        initialFeaturedImage ? legacyToDisplay(initialFeaturedImage, true) : null
    );
    const [galleryItems, setGalleryItems] = useState<readonly AccommodationMediaItem[]>(() =>
        initialGallery.map((img) => legacyToDisplay(img, false))
    );

    const [isHydrated, setIsHydrated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Derived ---

    const isGalleryFull = galleryItems.length >= ACCOMMODATION_GALLERY_CAP;

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;

        accommodationMediaApi
            .listMedia({ id: accommodationId })
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[PhotoSection] listMedia failed:', result.error);
                    // Keep SSR placeholders; flag as hydrated so ops become available
                    setIsHydrated(true);
                    return;
                }
                const rows = result.data.media;
                const featured = rows.find((r) => r.isFeatured) ?? null;
                const gallery = rows.filter((r) => !r.isFeatured);
                setFeaturedItem(featured ? rowToItem(featured) : null);
                setGalleryItems(gallery.map(rowToItem));
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

    // --- File validation ---

    const validateFile = useCallback(
        (file: File): string | null => {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                return t(
                    'host.properties.editor.photo.invalidType',
                    'Solo se permiten archivos JPG, PNG o WebP'
                );
            }
            const maxSize = 5 * 1024 * 1024; // 5 MB
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

    // --- Featured image handlers ---

    /**
     * Upload a new photo and mark it as the portada.
     *
     * Flow: XHR upload → addMedia (create row) → setFeaturedMedia (mark featured).
     * The backend's single-featured invariant unmarks the previous featured row.
     * We move the old featured item to the gallery locally.
     */
    const handleFeaturedSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                return;
            }

            setError(null);
            setIsUploading(true);
            setUploadProgress(0);

            try {
                // Step 1: upload to Cloudinary
                const uploaded = await uploadEntityImage({
                    file,
                    accommodationId,
                    onProgress: setUploadProgress
                });

                // Step 2: create the DB row
                const addResult = await accommodationMediaApi.addMedia({
                    id: accommodationId,
                    body: {
                        url: uploaded.url,
                        publicId: uploaded.publicId,
                        moderationState: 'APPROVED'
                    }
                });

                if (!addResult.ok) {
                    setError(
                        addResult.error.message ??
                            t(
                                'host.properties.editor.photo.persistFailed',
                                'No se pudo guardar la imagen en la base de datos'
                            )
                    );
                    return;
                }

                const newRow = addResult.data.media;

                // Step 3: mark as featured
                const featuredResult = await accommodationMediaApi.setFeaturedMedia({
                    id: accommodationId,
                    mediaId: newRow.id
                });

                if (!featuredResult.ok) {
                    setError(
                        featuredResult.error.message ??
                            t(
                                'host.properties.editor.photo.featuredFailed',
                                'No se pudo marcar la imagen como portada'
                            )
                    );
                    return;
                }

                // Step 4: update local state
                // The old featured becomes a gallery item; new row is the featured.
                setGalleryItems((prev) => {
                    const base = featuredItem
                        ? [...prev, { ...featuredItem, isFeatured: false }]
                        : [...prev];
                    return base;
                });
                setFeaturedItem(rowToItem(featuredResult.data.media));
            } catch (err) {
                setError(
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
        [accommodationId, validateFile, featuredItem, t]
    );

    /**
     * Delete the current featured (portada) row.
     * There is no "unfeature" endpoint — removing is the clear action.
     */
    const handleFeaturedRemove = useCallback(async () => {
        if (!featuredItem?.id) return;
        setError(null);
        setOpLoading(true);

        const result = await accommodationMediaApi.removeMedia({
            id: accommodationId,
            mediaId: featuredItem.id
        });

        if (result.ok) {
            setFeaturedItem(null);
        } else {
            setError(
                result.error.message ??
                    t('host.properties.editor.photo.removeFailed', 'No se pudo eliminar la imagen')
            );
        }
        setOpLoading(false);
    }, [featuredItem, accommodationId, t]);

    // --- Gallery handlers ---

    /**
     * Upload a new gallery photo and persist it immediately.
     *
     * Flow: XHR upload → addMedia (creates visible, non-featured row) → append to state.
     */
    const handleGallerySelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (isGalleryFull) {
                setError(
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

            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
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
                    setError(
                        addResult.error.message ??
                            t(
                                'host.properties.editor.photo.persistFailed',
                                'No se pudo guardar la imagen en la base de datos'
                            )
                    );
                    return;
                }

                setGalleryItems((prev) => [...prev, rowToItem(addResult.data.media)]);
            } catch (err) {
                setError(
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
        [accommodationId, isGalleryFull, validateFile, t]
    );

    /**
     * Delete a gallery photo by its DB UUID.
     * On failure: keeps the item in state (consistent with server).
     */
    const handleGalleryRemove = useCallback(
        async (item: AccommodationMediaItem) => {
            if (!item.id) return;
            setError(null);
            setOpLoading(true);

            const result = await accommodationMediaApi.removeMedia({
                id: accommodationId,
                mediaId: item.id
            });

            if (result.ok) {
                setGalleryItems((prev) => prev.filter((g) => g.id !== item.id));
            } else {
                setError(
                    result.error.message ??
                        t(
                            'host.properties.editor.photo.removeFailed',
                            'No se pudo eliminar la imagen'
                        )
                );
            }
            setOpLoading(false);
        },
        [accommodationId, t]
    );

    // --- Computed disabled states ---

    const anyOpInFlight = isUploading || opLoading;
    // Ops require hydrated DB ids; SSR placeholders (id='') cannot be operated on
    const opsReady = isHydrated;

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

            {/* Featured Image (Portada) */}
            <div>
                <label
                    htmlFor="featured-image-input"
                    className={styles.uploadTextStrong}
                >
                    {t('host.properties.editor.photo.featured', 'Imagen principal')}
                </label>

                {featuredItem ? (
                    <div className={styles.preview}>
                        <img
                            src={featuredItem.url}
                            alt={
                                featuredItem.alt ??
                                t('host.properties.editor.photo.featuredAlt', 'Imagen principal')
                            }
                            className={styles.previewImage}
                        />
                        <div className={styles.previewActions}>
                            <button
                                type="button"
                                className={styles.previewButton}
                                onClick={handleFeaturedRemove}
                                disabled={anyOpInFlight || !opsReady || !featuredItem.id}
                                aria-label={t('host.properties.editor.photo.remove', 'Eliminar')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={`${styles.uploadArea} ${anyOpInFlight ? styles.uploadAreaDisabled : ''}`}
                        onClick={() => !anyOpInFlight && featuredInputRef.current?.click()}
                        disabled={anyOpInFlight}
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

            {/* Inline Error */}
            {error && <div className={styles.error}>{error}</div>}

            {/* Gallery */}
            <div style={{ marginTop: '1.5rem' }}>
                <label
                    htmlFor="gallery-image-input"
                    className={styles.uploadTextStrong}
                >
                    {t('host.properties.editor.photo.gallery', 'Galería de fotos')}
                </label>

                {isGalleryFull && (
                    <p className={styles.error}>
                        {t(
                            'host.properties.editor.photo.galleryCapReached',
                            `Límite de galería alcanzado (máx. ${ACCOMMODATION_GALLERY_CAP} fotos)`
                        ).replace('{{cap}}', String(ACCOMMODATION_GALLERY_CAP))}
                    </p>
                )}

                <div className={styles.gallery}>
                    {galleryItems.map((item, index) => (
                        <div
                            key={item.id || item.url}
                            className={styles.galleryItem}
                        >
                            <img
                                src={item.url}
                                alt={
                                    item.alt ??
                                    t(
                                        'host.properties.editor.photo.galleryAlt',
                                        `Foto ${index + 1}`
                                    )
                                }
                                className={styles.galleryItemImage}
                            />
                            <div className={styles.galleryItemActions}>
                                <button
                                    type="button"
                                    className={styles.previewButton}
                                    onClick={() => handleGalleryRemove(item)}
                                    disabled={anyOpInFlight || !opsReady || !item.id}
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

                    {!isGalleryFull && (
                        <button
                            type="button"
                            className={styles.galleryAddButton}
                            onClick={() => !anyOpInFlight && galleryInputRef.current?.click()}
                            disabled={anyOpInFlight}
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
