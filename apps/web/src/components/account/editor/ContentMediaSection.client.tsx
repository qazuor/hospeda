/**
 * @file ContentMediaSection.client.tsx
 * @description Featured image + photo gallery section shared by the post and
 * event editors under `/mi-cuenta` (HOS-374 2D, unblocked by HOS-390).
 *
 * Ported from the venue/experience owner editor's `MediaSection` (HOS-372), which is
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
 * `protectedMediaApi.deleteMedia` — unlike the venue/experience caller, which has to,
 * that would be a second delete of an already-deleted asset.
 *
 * ## No SSR placeholders
 *
 * Unlike the listing editor, `PostEditDetail` / `EventEditDetail` do not carry
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

import { getGalleryCap } from '@repo/schemas';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import type { ImageUploadResult } from '@/components/account/ui/ImageUploader';
import type { PhotoMetadataUpdateBody } from '@/components/host/editor/photo-section-helpers';
import { type ContentMediaEntity, contentMediaApi } from '@/lib/api/endpoints-protected';
import { visibleApiMessage } from '@/lib/api-errors';
import { confirmPhotoRemoval } from '@/lib/forms/confirm-photo-removal';
import { useSingleFlight } from '@/lib/forms/use-single-flight';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { addToast } from '@/store/toast-store';
import { ContentMediaView } from './ContentMediaView';
import {
    type ContentMediaItem,
    describeUploadError,
    rowToItem,
    uploadAndAddContentMedia,
    validateContentMediaFile
} from './content-media-upload';

/** Props for {@link ContentMediaSection}. */
export interface ContentMediaSectionProps {
    readonly locale: SupportedLocale;
    /** Which editorial entity owns the gallery — picks the endpoint + cap. */
    readonly entity: ContentMediaEntity;
    /** UUID of the post or event being edited (also the upload `entityId`). */
    readonly entityId: string;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    /** Reports whether the editor has a persisted featured image. */
    readonly onFeaturedImageChange?: (present: boolean) => void;
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
    disabled = false,
    onFeaturedImageChange
}: ContentMediaSectionProps): JSX.Element {
    const { t, tPlural } = createTranslations(locale);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [featuredItem, setFeaturedItem] = useState<ContentMediaItem | null>(null);
    const [galleryItems, setGalleryItems] = useState<readonly ContentMediaItem[]>([]);

    const [isHydrated, setIsHydrated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [opLoading, setOpLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        onFeaturedImageChange?.(isHydrated && featuredItem !== null);
    }, [featuredItem, isHydrated, onFeaturedImageChange]);

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
    const validateFile = useCallback((file: File) => validateContentMediaFile({ file, t }), [t]);

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
    const uploadFeatured = useCallback(
        async (file: File): Promise<ImageUploadResult> => {
            // `canWrite` gates the handler, not just the control's `disabled`
            // attribute. The attribute alone is a rendering detail — anything
            // that dispatches a change programmatically (a test, a userscript,
            // a stale event queued before the lock resolved) would otherwise
            // upload and persist a photo the server is about to 403.
            if (!canWrite) {
                return { ok: false };
            }
            const validationError = validateFile(file);
            if (validationError) {
                reportError(validationError);
                return { ok: false, message: validationError };
            }
            setError(null);
            setIsUploading(true);
            try {
                const added = await uploadAndAddContentMedia({
                    file,
                    entity,
                    entityId,
                    role: 'featured',
                    t
                });
                if (!added.ok) {
                    reportError(added.message);
                    return { ok: false, message: added.message };
                }
                const newRow = added.row;

                const featuredResult = await contentMediaApi.setFeaturedMedia({
                    entity,
                    id: entityId,
                    mediaId: newRow.id
                });

                if (!featuredResult.ok) {
                    const message =
                        visibleApiMessage({ error: featuredResult.error }) ??
                        t(
                            'account.myContent.editor.media.featuredFailed',
                            'No se pudo marcar la imagen como principal'
                        );
                    reportError(message);
                    return { ok: false, message };
                }

                // The old featured becomes a gallery item; the new row is featured.
                setGalleryItems((prev) =>
                    featuredItem ? [...prev, { ...featuredItem, isFeatured: false }] : [...prev]
                );
                setFeaturedItem(rowToItem(featuredResult.data.media));
                return { ok: true, url: featuredResult.data.media.url };
            } catch (err) {
                const message = describeUploadError(err, t);
                reportError(message);
                return { ok: false, message };
            } finally {
                setIsUploading(false);
            }
        },
        [canWrite, validateFile, entity, entityId, featuredItem, t, reportError]
    );

    /**
     * Remove the current featured row. There is no "unfeature" endpoint —
     * removing is the clear action. `removeMedia` deletes the Cloudinary binary
     * server-side before dropping the row.
     */
    const runSingleFlight = useSingleFlight();
    const handleFeaturedRemove = useCallback(async () => {
        if (!featuredItem?.id || !canWrite) {
            return;
        }
        // HOS-2429: the delete is immediate and irreversible, so ask first.
        if (!(await runSingleFlight(() => confirmPhotoRemoval({ t })))) {
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
                visibleApiMessage({ error: result.error }) ??
                    t(
                        'account.myContent.editor.media.removeFailed',
                        'No se pudo eliminar la imagen'
                    )
            );
        }
        setOpLoading(false);
    }, [canWrite, featuredItem, entity, entityId, t, reportError, runSingleFlight]);

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
                reportError(
                    tPlural('account.myContent.editor.media.capReached', galleryCap, {
                        cap: galleryCap
                    })
                );
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
                const added = await uploadAndAddContentMedia({
                    file,
                    entity,
                    entityId,
                    role: 'gallery',
                    t
                });
                if (!added.ok) {
                    reportError(added.message);
                    return;
                }
                setGalleryItems((prev) => [...prev, rowToItem(added.row)]);
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
            // HOS-2429: the delete is immediate and irreversible, so ask first.
            if (!(await runSingleFlight(() => confirmPhotoRemoval({ t })))) {
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
                    visibleApiMessage({ error: result.error }) ??
                        t(
                            'account.myContent.editor.media.removeFailed',
                            'No se pudo eliminar la imagen'
                        )
                );
            }
            setOpLoading(false);
        },
        [canWrite, entity, entityId, t, reportError, runSingleFlight]
    );

    /**
     * Persist a photo's text metadata (alt / caption / description / credit).
     *
     * Immediate, per-photo and per-field-aware, exactly like every other op in
     * this section: `contentMediaApi.updateMedia` PATCHes only this row, the
     * editor's own Save button never carries photo data. A blank field arrives
     * here as `null` (clear) rather than `''` — see
     * `buildPhotoMetadataUpdateBody`, which is what the panel builds the body
     * with.
     *
     * On success the row is replaced in local state so the panel re-opens on
     * the CURRENT values rather than the stale ones it was mounted with, and
     * the thumbnail's own `alt` attribute updates with it.
     *
     * @returns `true` when the PATCH succeeded — the panel shows its saved
     *   badge only then.
     */
    const handleUpdateText = useCallback(
        async (item: ContentMediaItem, body: PhotoMetadataUpdateBody): Promise<boolean> => {
            if (!item.id || !canWrite) {
                return false;
            }
            setError(null);
            setOpLoading(true);

            const result = await contentMediaApi.updateMedia({
                entity,
                id: entityId,
                mediaId: item.id,
                body
            });

            setOpLoading(false);

            if (!result.ok) {
                reportError(
                    visibleApiMessage({ error: result.error }) ??
                        t(
                            'account.myContent.editor.media.metadataSaveFailed',
                            'No se pudieron guardar los datos de la foto'
                        )
                );
                return false;
            }

            const updated = rowToItem(result.data.media);
            if (updated.isFeatured) {
                setFeaturedItem(updated);
            } else {
                setGalleryItems((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            }
            return true;
        },
        [canWrite, entity, entityId, t, reportError]
    );

    return (
        <ContentMediaView
            locale={locale}
            t={t}
            tPlural={tPlural}
            featuredItem={featuredItem}
            galleryItems={galleryItems}
            galleryCap={galleryCap}
            isGalleryFull={isGalleryFull}
            anyOpInFlight={isUploading || opLoading}
            canWrite={canWrite}
            error={error}
            galleryInputRef={galleryInputRef}
            uploadFeatured={uploadFeatured}
            handleGallerySelect={handleGallerySelect}
            handleFeaturedRemove={handleFeaturedRemove}
            handleGalleryRemove={handleGalleryRemove}
            handleUpdateText={handleUpdateText}
        />
    );
}
