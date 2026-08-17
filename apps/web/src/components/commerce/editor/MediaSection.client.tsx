/**
 * @file MediaSection.client.tsx
 * @description Featured image + photo gallery section of the commerce owner
 * editor (SPEC-249 T-015c, extracted in HOS-258), migrated to per-operation
 * persistence against the relational `gastronomy_media` / `experience_media`
 * endpoints (HOS-372).
 *
 * Self-contained, NOT controlled by the orchestrator. Mirrors the accommodation
 * editor's migration (`apps/web/src/components/host/editor/PhotoSection.client.tsx`,
 * SPEC-204): every add / remove / set-featured call hits the API immediately —
 * nothing is buffered for the parent's PATCH to persist on Save. Before this
 * change, uploads landed in Cloudinary right away but the DB association waited
 * for the form submit, so an owner who uploaded photos and navigated away
 * without pressing "Guardar" lost the association (the file stayed billed in
 * Cloudinary and never appeared anywhere).
 *
 * Uploads still go to the protected `media/upload-entity` endpoint (which
 * already accepts the `gastronomy` and `experience` entity types, T-015a/b) —
 * that part is UNCHANGED. What changed is what happens right after a successful
 * upload: instead of calling `onChange` with the full next
 * `{ featuredImage, gallery }` state for the orchestrator to buffer, this
 * section now calls `commerceMediaApi.addMedia` (and, for the featured slot,
 * `commerceMediaApi.setFeaturedMedia`) so the row is persisted immediately.
 *
 * Cloudinary cleanup is now SERVER-SIDE and this component does not participate
 * in it. `commerceMediaApi.removeMedia` deletes the binary before dropping the
 * row (HOS-372), so a successful response already means the asset is gone.
 *
 * This replaced a client-side best-effort call to
 * `protectedMediaApi.deleteMedia({ publicId })` that could never have worked:
 * `media/protected/delete-entity` only accepts accommodation / destination /
 * event / post, and rejected `gastronomy` and `experience` with HTTP 400 — even
 * though `media/upload-entity` accepts both. Uploads went in through a door that
 * existed; deletes went out through one that returned 400, so every commerce
 * photo removal orphaned its asset regardless of this call.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { getGalleryCap, type Image } from '@repo/schemas';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { type CommerceMediaRow, commerceMediaApi } from '@/lib/api/endpoints-protected';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { resolveUploadTimeoutMs } from '@/lib/media/upload-entity';
import { addToast } from '@/store/toast-store';
import fieldStyles from './editor-fields.module.css';
import styles from './MediaSection.module.css';

/** Translator function shape (matches the editor's `createTranslations().t`). */
type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

/**
 * Display item used by this component's local state. Extends the DB row's
 * essentials with an `id` — empty (`''`) for SSR-only placeholders that have
 * not been hydrated from the API yet, which is what gates ops availability.
 */
interface CommerceMediaItem {
    readonly id: string;
    readonly url: string;
    readonly publicId?: string;
    readonly caption?: string;
    readonly alt?: string;
    readonly isFeatured: boolean;
}

export interface MediaSectionProps {
    readonly locale: SupportedLocale;
    /** Vertical of the listing (drives the media endpoint path + gallery cap). */
    readonly vertical: CommerceVertical;
    /** UUID of the listing being edited (upload entityId). */
    readonly listingId: string;
    /**
     * Optional first-paint featured image (from the SSR-fetched `media`
     * response field). Shown until `listMedia` resolves. Lacks a DB id —
     * cannot trigger API ops until the real row loads.
     */
    readonly initialFeaturedImage?: Image | null;
    /**
     * Optional first-paint gallery (from the SSR-fetched `media` response
     * field). Lacks DB ids — cannot trigger API ops until the real rows load.
     */
    readonly initialGallery?: readonly Image[];
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
 * Map a `CommerceMediaRow` (from the API) to the local display shape.
 */
function rowToItem(row: CommerceMediaRow): CommerceMediaItem {
    return {
        id: row.id,
        url: row.url,
        publicId: row.publicId ?? undefined,
        caption: row.caption ?? undefined,
        alt: row.alt ?? undefined,
        isFeatured: row.isFeatured
    };
}

/**
 * Map a legacy `Image` (no DB id, SSR-only) to a partial display object.
 * Used only for the first-paint placeholder; once `listMedia` resolves,
 * these are replaced by real `CommerceMediaItem` values that carry DB ids.
 * The empty id prevents any API call until the real rows load.
 */
function legacyToDisplay(img: Image, isFeatured: boolean): CommerceMediaItem {
    return {
        id: '',
        url: img.url,
        publicId: img.publicId ?? undefined,
        caption: img.caption ?? undefined,
        alt: img.alt ?? undefined,
        isFeatured
    };
}

/**
 * Upload a single image to the protected entity-upload endpoint. Unchanged
 * by HOS-372 — only what happens AFTER a successful upload changed (see the
 * file header).
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

/**
 * Featured-image + gallery section for a commerce listing. Hydrates on mount
 * from `commerceMediaApi.listMedia`; every user operation (add, remove,
 * set-featured) is persisted immediately via a granular API call. The parent
 * PATCH no longer carries media data.
 *
 * Errors are shown inline AND via the global toast store (mirrors
 * PhotoSection's BETA-144 behavior): the inline message can be scrolled out
 * of view, so the toast guarantees the failure is visible regardless of
 * scroll position. On any op failure the local state is NOT mutated, keeping
 * the UI consistent with the server.
 */
export function MediaSection({
    locale,
    vertical,
    listingId,
    initialFeaturedImage = null,
    initialGallery = []
}: MediaSectionProps): JSX.Element {
    const { t, tPlural } = createTranslations(locale);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [featuredItem, setFeaturedItem] = useState<CommerceMediaItem | null>(() =>
        initialFeaturedImage ? legacyToDisplay(initialFeaturedImage, true) : null
    );
    const [galleryItems, setGalleryItems] = useState<readonly CommerceMediaItem[]>(() =>
        initialGallery.map((img) => legacyToDisplay(img, false))
    );

    const [isHydrated, setIsHydrated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const galleryCap = getGalleryCap(vertical);
    const isGalleryFull = galleryItems.length >= galleryCap;

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;

        commerceMediaApi
            .listMedia({ vertical, id: listingId })
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[MediaSection] listMedia failed:', result.error);
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
                webLogger.warn('[MediaSection] listMedia error:', err);
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [vertical, listingId]);

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

    /**
     * Report a failure both inline (existing behavior) and via the global
     * toast store, mirroring PhotoSection's BETA-144 behavior.
     */
    const reportError = useCallback((message: string) => {
        setError(message);
        addToast({ type: 'error', message });
    }, []);

    // --- Featured image handlers ---

    /**
     * Upload a new photo and mark it as the featured image.
     *
     * Flow: upload → addMedia (create row) → setFeaturedMedia (mark featured).
     * The backend's single-featured invariant unmarks the previous featured
     * row; we move it to the gallery locally.
     */
    const handleFeaturedSelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            const validationError = validateFile(file);
            if (validationError) {
                reportError(validationError);
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

                const addResult = await commerceMediaApi.addMedia({
                    vertical,
                    id: listingId,
                    body: {
                        url: uploaded.url,
                        publicId: uploaded.publicId,
                        moderationState: 'APPROVED'
                    }
                });

                if (!addResult.ok) {
                    reportError(
                        addResult.error.message ??
                            t(
                                'commerce.owner.editor.media.persistFailed',
                                'No se pudo guardar la imagen en la base de datos'
                            )
                    );
                    return;
                }

                const newRow = addResult.data.media;

                const featuredResult = await commerceMediaApi.setFeaturedMedia({
                    vertical,
                    id: listingId,
                    mediaId: newRow.id
                });

                if (!featuredResult.ok) {
                    reportError(
                        featuredResult.error.message ??
                            t(
                                'commerce.owner.editor.media.featuredFailed',
                                'No se pudo marcar la imagen como principal'
                            )
                    );
                    return;
                }

                // The old featured becomes a gallery item; new row is featured.
                setGalleryItems((prev) => {
                    const base = featuredItem
                        ? [...prev, { ...featuredItem, isFeatured: false }]
                        : [...prev];
                    return base;
                });
                setFeaturedItem(rowToItem(featuredResult.data.media));
            } catch (err) {
                reportError(describeUploadError(err, t));
            } finally {
                setIsUploading(false);
                if (featuredInputRef.current) {
                    featuredInputRef.current.value = '';
                }
            }
        },
        [validateFile, vertical, listingId, featuredItem, t, reportError]
    );

    /**
     * Remove the current featured row. There is no "unfeature" endpoint —
     * removing is the clear action. `removeMedia` deletes the Cloudinary
     * binary server-side before dropping the row.
     */
    const handleFeaturedRemove = useCallback(async () => {
        if (!featuredItem?.id) {
            return;
        }
        setError(null);
        setOpLoading(true);

        const result = await commerceMediaApi.removeMedia({
            vertical,
            id: listingId,
            mediaId: featuredItem.id
        });

        if (result.ok) {
            setFeaturedItem(null);
        } else {
            reportError(
                result.error.message ??
                    t('commerce.owner.editor.media.removeFailed', 'No se pudo eliminar la imagen')
            );
        }
        setOpLoading(false);
    }, [featuredItem, vertical, listingId, t, reportError]);

    // --- Gallery handlers ---

    /**
     * Upload a new gallery photo and persist it immediately.
     *
     * Flow: upload → addMedia (creates a visible, non-featured row) → append
     * to state.
     */
    const handleGallerySelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            if (isGalleryFull) {
                reportError(tPlural('commerce.owner.editor.media.capReached', galleryCap));
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
                return;
            }
            const validationError = validateFile(file);
            if (validationError) {
                reportError(validationError);
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

                const addResult = await commerceMediaApi.addMedia({
                    vertical,
                    id: listingId,
                    body: {
                        url: uploaded.url,
                        publicId: uploaded.publicId,
                        moderationState: 'APPROVED'
                    }
                });

                if (!addResult.ok) {
                    reportError(
                        addResult.error.message ??
                            t(
                                'commerce.owner.editor.media.persistFailed',
                                'No se pudo guardar la imagen en la base de datos'
                            )
                    );
                    return;
                }

                setGalleryItems((prev) => [...prev, rowToItem(addResult.data.media)]);
            } catch (err) {
                reportError(describeUploadError(err, t));
            } finally {
                setIsUploading(false);
                if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                }
            }
        },
        [isGalleryFull, validateFile, vertical, listingId, t, reportError, galleryCap, tPlural]
    );

    /**
     * Remove a gallery photo by its DB UUID. On failure, keeps the item in
     * state (consistent with the server).
     */
    const handleGalleryRemove = useCallback(
        async (item: CommerceMediaItem) => {
            if (!item.id) {
                return;
            }
            setError(null);
            setOpLoading(true);

            const result = await commerceMediaApi.removeMedia({
                vertical,
                id: listingId,
                mediaId: item.id
            });

            if (result.ok) {
                setGalleryItems((prev) => prev.filter((g) => g.id !== item.id));
            } else {
                reportError(
                    result.error.message ??
                        t(
                            'commerce.owner.editor.media.removeFailed',
                            'No se pudo eliminar la imagen'
                        )
                );
            }
            setOpLoading(false);
        },
        [vertical, listingId, t, reportError]
    );

    const anyOpInFlight = isUploading || opLoading;
    // Ops require hydrated DB ids; SSR placeholders (id='') cannot be operated on
    const opsReady = isHydrated;

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
                    {featuredItem ? (
                        <div className={styles.mediaThumb}>
                            <img
                                src={featuredItem.url}
                                alt={t('commerce.owner.editor.media.featured', 'Imagen principal')}
                                className={styles.mediaImage}
                            />
                            <button
                                type="button"
                                className={styles.mediaRemove}
                                aria-label={t('commerce.owner.editor.media.remove', 'Eliminar')}
                                disabled={anyOpInFlight || !opsReady || !featuredItem.id}
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
                        {galleryItems.map((image) => (
                            <div
                                key={image.id || image.url}
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
                                    disabled={anyOpInFlight || !opsReady || !image.id}
                                    onClick={() => handleGalleryRemove(image)}
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
