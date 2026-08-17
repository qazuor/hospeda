/**
 * @file ContentMediaSection.client.tsx
 * @description Featured image + photo gallery section shared by the post and
 * event editors under `/mi-cuenta` (HOS-374 2D, unblocked by HOS-390).
 *
 * Ported from the commerce owner editor's `MediaSection` (HOS-372), which is
 * itself the accommodation editor's migration (SPEC-204). One component serves
 * both entities: `post_media` and `event_media` share a row shape, so the only
 * difference is the `entity` discriminator that picks the endpoint path and the
 * gallery cap.
 *
 * ## Per-operation persistence
 *
 * Every add / remove / set-featured call hits the API immediately — nothing is
 * buffered for the editor's PATCH to persist on Save. That ordering is the
 * whole point: before HOS-390 an upload landed in Cloudinary and the URL came
 * back with nowhere to go (the protected PATCH does not accept `media`), so an
 * author's photo was billed forever and appeared nowhere.
 *
 * ## Cloudinary cleanup is server-side
 *
 * `contentMediaApi.removeMedia` deletes the binary BEFORE dropping the row, so
 * a successful response already means the asset is gone. Do NOT pair it with
 * `protectedMediaApi.deleteMedia` — unlike the commerce caller, which has to,
 * that would be a second delete of an already-deleted asset.
 *
 * ## No SSR placeholders
 *
 * Unlike the commerce editor, `PostEditDetail` / `EventEditDetail` do not carry
 * a `media` field, so there is nothing to paint before the fetch resolves and
 * this section hydrates purely from `listMedia` on mount. That is acceptable
 * here and only here: `/mi-cuenta/*` is behind auth and `noindex`, so the
 * SSR-first rule for islands (which exists so crawlers read real values) does
 * not apply. On a public page it would.
 *
 * ## The moderation lock
 *
 * `disabled` mirrors what every other section of these editors receives: when
 * the platform has approved the content and the author holds neither
 * `*_PUBLISH_OWN` nor the broad update permission, the server rejects the write
 * (HOS-374 §7.6.3). Photos are content, so the lock covers them too — the
 * service gate delegates to `checkCanUpdatePost` / `checkCanUpdateEvent`
 * precisely so the two can never drift. Surfacing it here is what stops the
 * author from uploading a photo only to collect a 403.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { getGalleryCap, type Image } from '@repo/schemas';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import fieldStyles from '@/components/account/editor/content-editor-fields.module.css';
import {
    type ContentMediaEntity,
    type ContentMediaRow,
    contentMediaApi
} from '@/lib/api/endpoints-protected';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { resolveUploadTimeoutMs } from '@/lib/media/upload-entity';
import { addToast } from '@/store/toast-store';
import styles from './ContentMediaSection.module.css';

/** Translator function shape (matches the editor's `createTranslations().t`). */
type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

/**
 * Display item used by this component's local state — the DB row's essentials
 * plus the `id` needed to address it in remove / set-featured calls.
 */
interface ContentMediaItem {
    readonly id: string;
    readonly url: string;
    readonly publicId?: string;
    readonly caption?: string;
    readonly alt?: string;
    readonly isFeatured: boolean;
}

/** Props for {@link ContentMediaSection}. */
export interface ContentMediaSectionProps {
    readonly locale: SupportedLocale;
    /** Which editorial entity owns the gallery — picks the endpoint + cap. */
    readonly entity: ContentMediaEntity;
    /** UUID of the post or event being edited (also the upload `entityId`). */
    readonly entityId: string;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
}

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
 * Map a `ContentMediaRow` (from the API) to the local display shape.
 */
function rowToItem(row: ContentMediaRow): ContentMediaItem {
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
 * Upload a single image to the protected entity-upload endpoint.
 *
 * `entityType` accepts `post` and `event` natively — this is the same endpoint
 * the accommodation and destination editors use.
 *
 * @returns The uploaded `Image` (Cloudinary url + metadata, moderationState APPROVED).
 */
async function uploadEntityImage({
    file,
    entity,
    entityId,
    role
}: {
    readonly file: File;
    readonly entity: ContentMediaEntity;
    readonly entityId: string;
    readonly role: 'featured' | 'gallery';
}): Promise<Image> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entity);
    formData.append('entityId', entityId);
    formData.append('role', role);

    // Bounded like the accommodation and commerce editors (BETA-134). Without a
    // signal this `fetch` waits forever, so a stalled connection leaves the
    // author on a spinner with no error and no way out but a reload.
    //
    // `AbortController` + `setTimeout` rather than `AbortSignal.timeout`: the
    // latter needs Safari 16, and on an older iOS the property access throws
    // before `fetch` runs, breaking uploads outright rather than degrading.
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
        // `DOMException` satisfies `instanceof Error`. Re-throw a typed marker.
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
            'account.myContent.editor.media.uploadTimeout',
            'La subida tardó demasiado. Probá de nuevo.'
        );
    }
    return err instanceof Error
        ? err.message
        : t('account.myContent.editor.media.uploadFailed', 'Error al subir la imagen');
}

/**
 * Featured-image + gallery section for a post or event.
 *
 * Errors are shown inline AND via the global toast store (mirrors the
 * accommodation editor's BETA-144 behavior): the inline message can be scrolled
 * out of view, so the toast guarantees the failure is visible regardless of
 * scroll position. On any op failure the local state is NOT mutated, keeping
 * the UI consistent with the server.
 *
 * @param props - See {@link ContentMediaSectionProps}.
 */
export function ContentMediaSection({
    locale,
    entity,
    entityId,
    disabled = false
}: ContentMediaSectionProps): JSX.Element {
    const { t, tPlural } = createTranslations(locale);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [featuredItem, setFeaturedItem] = useState<ContentMediaItem | null>(null);
    const [galleryItems, setGalleryItems] = useState<readonly ContentMediaItem[]>([]);

    const [isHydrated, setIsHydrated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const galleryCap = getGalleryCap(entity);
    const isGalleryFull = galleryItems.length >= galleryCap;

    // --- Hydrate from API on mount ---

    useEffect(() => {
        let cancelled = false;

        contentMediaApi
            .listMedia({ entity, id: entityId })
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[ContentMediaSection] listMedia failed:', result.error);
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
                webLogger.warn('[ContentMediaSection] listMedia error:', err);
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [entity, entityId]);

    /**
     * Writes need BOTH a resolved gallery (so the DB ids exist) and an unlocked
     * post/event. `disabled` alone is not enough: without `isHydrated` the
     * remove button would address an id that has not loaded yet.
     */
    const canWrite = isHydrated && !disabled;

    /** Validate a selected file; returns a localized error message or null. */
    const validateFile = useCallback(
        (file: File): string | null => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                return t(
                    'account.myContent.editor.media.invalidType',
                    'Solo se permiten archivos JPG, PNG o WebP'
                );
            }
            if (file.size > MAX_SIZE_BYTES) {
                return t(
                    'account.myContent.editor.media.tooLarge',
                    'El archivo no puede superar {{maxSize}}MB',
                    { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
                );
            }
            return null;
        },
        [t]
    );

    /**
     * Report a failure both inline and via the global toast store.
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
            // `canWrite` gates the handler, not just the control's `disabled`
            // attribute. The attribute alone is a rendering detail — anything
            // that dispatches a change programmatically (a test, a userscript,
            // a stale event queued before the lock resolved) would otherwise
            // upload and persist a photo the server is about to 403.
            if (!file || !canWrite) {
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
                    entity,
                    entityId,
                    role: 'featured'
                });

                const addResult = await contentMediaApi.addMedia({
                    entity,
                    id: entityId,
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
                                'account.myContent.editor.media.persistFailed',
                                'No se pudo guardar la imagen en la base de datos'
                            )
                    );
                    return;
                }

                const newRow = addResult.data.media;

                const featuredResult = await contentMediaApi.setFeaturedMedia({
                    entity,
                    id: entityId,
                    mediaId: newRow.id
                });

                if (!featuredResult.ok) {
                    reportError(
                        featuredResult.error.message ??
                            t(
                                'account.myContent.editor.media.featuredFailed',
                                'No se pudo marcar la imagen como principal'
                            )
                    );
                    return;
                }

                // The old featured becomes a gallery item; the new row is featured.
                setGalleryItems((prev) =>
                    featuredItem ? [...prev, { ...featuredItem, isFeatured: false }] : [...prev]
                );
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
        [canWrite, validateFile, entity, entityId, featuredItem, t, reportError]
    );

    /**
     * Remove the current featured row. There is no "unfeature" endpoint —
     * removing is the clear action. `removeMedia` deletes the Cloudinary binary
     * server-side before dropping the row.
     */
    const handleFeaturedRemove = useCallback(async () => {
        if (!featuredItem?.id || !canWrite) {
            return;
        }
        setError(null);
        setOpLoading(true);

        const result = await contentMediaApi.removeMedia({
            entity,
            id: entityId,
            mediaId: featuredItem.id
        });

        if (result.ok) {
            setFeaturedItem(null);
        } else {
            reportError(
                result.error.message ??
                    t(
                        'account.myContent.editor.media.removeFailed',
                        'No se pudo eliminar la imagen'
                    )
            );
        }
        setOpLoading(false);
    }, [canWrite, featuredItem, entity, entityId, t, reportError]);

    // --- Gallery handlers ---

    /**
     * Upload a new gallery photo and persist it immediately.
     *
     * Flow: upload → addMedia (creates a visible, non-featured row) → append.
     */
    const handleGallerySelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            // See the featured handler: the guard lives here, not only on the
            // control's `disabled` attribute.
            if (!file || !canWrite) {
                return;
            }
            if (isGalleryFull) {
                reportError(tPlural('account.myContent.editor.media.capReached', galleryCap));
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
                    entity,
                    entityId,
                    role: 'gallery'
                });

                const addResult = await contentMediaApi.addMedia({
                    entity,
                    id: entityId,
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
                                'account.myContent.editor.media.persistFailed',
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
        [
            canWrite,
            isGalleryFull,
            validateFile,
            entity,
            entityId,
            t,
            reportError,
            galleryCap,
            tPlural
        ]
    );

    /**
     * Remove a gallery photo by its DB UUID. On failure, keeps the item in
     * state (consistent with the server).
     */
    const handleGalleryRemove = useCallback(
        async (item: ContentMediaItem) => {
            if (!item.id || !canWrite) {
                return;
            }
            setError(null);
            setOpLoading(true);

            const result = await contentMediaApi.removeMedia({
                entity,
                id: entityId,
                mediaId: item.id
            });

            if (result.ok) {
                setGalleryItems((prev) => prev.filter((g) => g.id !== item.id));
            } else {
                reportError(
                    result.error.message ??
                        t(
                            'account.myContent.editor.media.removeFailed',
                            'No se pudo eliminar la imagen'
                        )
                );
            }
            setOpLoading(false);
        },
        [canWrite, entity, entityId, t, reportError]
    );

    const anyOpInFlight = isUploading || opLoading;

    const featuredLabel = t('account.myContent.editor.media.featured', 'Imagen principal');
    const galleryLabel = t('account.myContent.editor.media.gallery', 'Galería de fotos');
    const removeLabel = t('account.myContent.editor.media.remove', 'Eliminar');
    const addLabel = t('account.myContent.editor.media.add', 'Agregar foto');

    return (
        <div className={styles.media}>
            <div className={styles.mediaGroup}>
                <span className={fieldStyles.label}>{featuredLabel}</span>
                {featuredItem ? (
                    <div className={styles.mediaThumb}>
                        <img
                            src={featuredItem.url}
                            alt={featuredItem.alt ?? featuredLabel}
                            className={styles.mediaImage}
                        />
                        <button
                            type="button"
                            className={styles.mediaRemove}
                            aria-label={removeLabel}
                            disabled={anyOpInFlight || !canWrite || !featuredItem.id}
                            onClick={handleFeaturedRemove}
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={styles.mediaAdd}
                        disabled={anyOpInFlight || !canWrite}
                        onClick={() => featuredInputRef.current?.click()}
                    >
                        {addLabel}
                    </button>
                )}
                <input
                    ref={featuredInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={featuredLabel}
                    className={styles.mediaFileInput}
                    disabled={!canWrite}
                    onChange={handleFeaturedSelect}
                />
            </div>

            <div className={styles.mediaGroup}>
                <span className={fieldStyles.label}>{galleryLabel}</span>
                <div className={styles.mediaGallery}>
                    {galleryItems.map((image) => (
                        <div
                            key={image.id || image.url}
                            className={styles.mediaThumb}
                        >
                            <img
                                src={image.url}
                                alt={image.alt ?? galleryLabel}
                                className={styles.mediaImage}
                            />
                            <button
                                type="button"
                                className={styles.mediaRemove}
                                aria-label={removeLabel}
                                disabled={anyOpInFlight || !canWrite || !image.id}
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
                            disabled={anyOpInFlight || !canWrite}
                            aria-label={addLabel}
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
                    aria-label={galleryLabel}
                    className={styles.mediaFileInput}
                    disabled={!canWrite}
                    onChange={handleGallerySelect}
                />
                <span className={styles.mediaHint}>
                    {tPlural('account.myContent.editor.media.uploadHint', galleryCap, {
                        maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB
                    })}
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
    );
}
