/**
 * @file PhotoSection.client.tsx
 * @description Self-contained photo section for the accommodation editor.
 *
 * SPEC-204: Migrated from JSONB-controlled (parent-owned state) to per-operation
 * persistence against the relational `accommodation_media` endpoints. Every
 * add/remove/set-featured call hits the API immediately — no buffering in the
 * parent PATCH payload.
 *
 * HOS-1024: the gallery cap shown/enforced here is the host's EFFECTIVE plan
 * cap (`useMyEntitlements().limit(MAX_PHOTOS_LIMIT_KEY)`, plan + addons —
 * see `addon-limit-recalculation.service.ts`), not the flat entity ceiling
 * every host used to see regardless of plan. `ENTITY_GALLERY_CAPS.accommodation`
 * still exists and is still enforced server-side
 * (`routes/media/protected/upload-entity.ts`'s `GALLERY_LIMIT_EXCEEDED`
 * check) as a hard technical ceiling ABOVE the plan cap — this component just
 * no longer shows or gates on that number. See `photo-section-helpers.ts`'s
 * `resolveEffectiveGalleryCap` for the loading-window contract.
 *
 * HOS-122 added four owner-declared gaps on top of that persistence layer,
 * all UI-only (the backend already existed):
 *   1. Multi-select gallery upload — the gallery `<input>` now takes
 *      `multiple` and uploads are processed SEQUENTIALLY (one XHR at a time,
 *      not in parallel) so upload progress stays meaningful and the cap is
 *      checked once, up front, against the whole batch — see
 *      `use-photo-section.ts`'s `processGalleryFiles`.
 *   2. Manual reordering via `accommodationMediaApi.reorderMedia` — BUTTON
 *      driven (move up / move down per photo, in `PhotoGalleryItem`), not
 *      drag-and-drop: the editor's audience is largely non-technical hosts,
 *      and plain `<button>`s are keyboard/screen-reader operable for free.
 *   3. Promoting an existing gallery photo to portada via
 *      `setFeaturedMedia` alone — no re-upload, no second Cloudinary asset.
 *   4. Drag-and-drop FILE upload (dropping an image onto the featured slot
 *      or the gallery grid) — the copy already promised this before HOS-122
 *      built it.
 *
 * All state and handlers live in `usePhotoSection` (`use-photo-section.ts`) —
 * this file is render-only, kept that way to stay under the repo's 500-line
 * ceiling once the above landed on top of the original SPEC-204 shape.
 *
 * UX shape is preserved:
 *   - "Portada" slot (top): the `isFeatured` row from accommodation_media.
 *   - "Galería" grid (below): all visible, non-featured rows.
 *
 * On mount the component hydrates from `listMedia`. The `initial*` props are
 * used only for first-paint (SSR) display until the API response arrives —
 * they lack DB ids and are display-only.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, getMediaUrl } from '@repo/media';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import type { AccommodationMediaItem, MediaImage } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PhotoGalleryItem } from './PhotoGalleryItem.client';
import { PhotoMetadataEditor } from './PhotoMetadataEditor.client';
import styles from './PhotoSection.module.css';
import { MAX_PHOTOS_LIMIT_KEY, resolveEffectiveGalleryCap } from './photo-section-helpers';
import { usePhotoSection } from './use-photo-section';

// Re-export upload helper so existing callers of PhotoSection.client can still import it
export { uploadEntityImage } from '@/lib/media/upload-entity';
// Re-export types for consumers that import from this module
export type { AccommodationMediaItem, MediaImage };

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

/**
 * Self-contained photo section for the accommodation editor.
 *
 * Hydrates on mount from `listMedia`. Each user operation (add gallery photo,
 * set portada, remove, reorder, promote) is persisted immediately via a
 * granular API call. The parent PATCH no longer carries media data.
 *
 * Errors are shown inline AND surfaced via the global toast store (BETA-144):
 * the inline message can be scrolled out of view (e.g. user is looking at the
 * gallery while the featured-image upload fails), so a toast guarantees the
 * failure is visible regardless of scroll position. On any op failure the
 * local state is NOT mutated, keeping the UI consistent with the server.
 */
export function PhotoSection({
    locale,
    accommodationId,
    initialFeaturedImage = null,
    initialGallery = []
}: PhotoSectionProps) {
    const { t, tPlural } = createTranslations(locale);

    // HOS-1024: the effective cap is the host's PLAN limit (+ addons), not
    // the flat entity ceiling. See `resolveEffectiveGalleryCap`'s JSDoc for
    // the pending-window contract this drives below.
    const { limit: getEntitlementLimit, isLoading: isEntitlementsLoading } = useMyEntitlements();
    const { cap: galleryCap, isResolved: isGalleryCapResolved } = resolveEffectiveGalleryCap({
        planLimit: getEntitlementLimit(MAX_PHOTOS_LIMIT_KEY),
        isEntitlementsLoading
    });

    const {
        featuredItem,
        galleryItems,
        isUploading,
        isCompressing,
        uploadProgress,
        uploadBatch,
        error,
        isDragOverFeatured,
        isDragOverGallery,
        isGalleryFull,
        capUpsell,
        opsReady,
        anyOpInFlight,
        featuredInputRef,
        galleryInputRef,
        handleFeaturedSelect,
        handleFeaturedDrop,
        handleFeaturedDragOver,
        handleFeaturedDragLeave,
        handleFeaturedRemove,
        handleGallerySelect,
        handleGalleryDrop,
        handleGalleryDragOver,
        handleGalleryDragLeave,
        handleGalleryRemove,
        handlePromoteToFeatured,
        handleMoveUp,
        handleMoveDown,
        handleUpdateMediaText
    } = usePhotoSection({
        locale,
        accommodationId,
        galleryCap,
        initialFeaturedImage,
        initialGallery
    });

    const remainingGallerySlots = isGalleryCapResolved
        ? Math.max(galleryCap - galleryItems.length, 0)
        : 0;

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
                {t('host.properties.editor.section.photos', 'Fotos')}
            </h3>
            <p
                className={styles.sectionDescription}
                aria-busy={!isGalleryCapResolved}
            >
                {isGalleryCapResolved
                    ? tPlural('host.properties.editor.section.photosDescription', galleryCap, {
                          cap: galleryCap
                      })
                    : t(
                          'host.properties.editor.section.photosDescriptionLoading',
                          'Cargando tu límite de fotos…'
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
                        {/* HOS-637: `.previewImage` box is capped at
                            max-width:400px / max-height:300px (see
                            PhotoSection.module.css) — this matched the
                            `card` preset (w_400,h_300) exactly, so it is
                            reused verbatim instead of a bespoke `raw`
                            transform. */}
                        <img
                            src={getMediaUrl(featuredItem.url, { preset: 'card' })}
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
                        <PhotoMetadataEditor
                            locale={locale}
                            item={featuredItem}
                            disabled={anyOpInFlight || !opsReady}
                            toggleAriaLabel={t(
                                'host.properties.editor.photo.editFeaturedDetailsAria',
                                'Editar textos de la portada'
                            )}
                            closeAriaLabel={t(
                                'host.properties.editor.photo.closeFeaturedDetailsAria',
                                'Cerrar edición de textos de la portada'
                            )}
                            onSave={handleUpdateMediaText}
                        />
                    </div>
                ) : (
                    <button
                        type="button"
                        className={`${styles.uploadArea} ${anyOpInFlight ? styles.uploadAreaDisabled : ''} ${isDragOverFeatured ? styles.uploadAreaDragOver : ''}`}
                        onClick={() => !anyOpInFlight && featuredInputRef.current?.click()}
                        onDrop={handleFeaturedDrop}
                        onDragOver={handleFeaturedDragOver}
                        onDragLeave={handleFeaturedDragLeave}
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
                                'JPG, PNG o WebP — máx. {{maxSize}}MB',
                                { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
                            )}
                        </span>
                    </button>
                )}

                <input
                    ref={featuredInputRef}
                    id="featured-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className={styles.fileInput}
                    onChange={handleFeaturedSelect}
                />
            </div>

            {/* Compressing (HOS-332) — shown while a large file is being
                resized/recompressed client-side, BEFORE anything is sent, so
                the picker does not look stuck at 0% for a multi-second decode. */}
            {isCompressing && (
                <p className={styles.uploadBatchStatus}>
                    {t('host.properties.editor.photo.processingImage', 'Optimizando imagen…')}
                </p>
            )}

            {/* Upload Progress */}
            {isUploading && uploadProgress !== null && (
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressBarFill}
                        style={{ width: `${uploadProgress}%` }}
                    />
                </div>
            )}
            {isUploading && uploadBatch && uploadBatch.total > 1 && (
                <p className={styles.uploadBatchStatus}>
                    {t(
                        'host.properties.editor.photo.uploadingBatch',
                        'Subiendo foto {{current}} de {{total}}…',
                        { current: uploadBatch.current, total: uploadBatch.total }
                    )}
                </p>
            )}

            {/* Inline Error */}
            {error && <div className={styles.error}>{error}</div>}

            {/* Gallery */}
            <div style={{ marginTop: '1.5rem' }}>
                <label
                    htmlFor="gallery-image-input"
                    className={styles.uploadTextStrong}
                    aria-busy={!isGalleryCapResolved}
                >
                    {isGalleryCapResolved
                        ? t(
                              'host.properties.editor.photo.gallery',
                              'Galería de fotos (máx. {{cap}})',
                              { cap: galleryCap }
                          )
                        : t('host.properties.editor.photo.galleryLoading', 'Galería de fotos')}
                </label>

                {isGalleryFull && (
                    <p className={styles.error}>
                        {tPlural('host.properties.editor.photo.galleryCapReached', galleryCap, {
                            cap: galleryCap
                        })}
                        {/* HOS-1024: sober, single-line upsell — the same copy/CTA
                            the failed-upload toast already uses, reused here rather
                            than re-derived. */}
                        {capUpsell && (
                            <>
                                {' '}
                                <a
                                    href={capUpsell.action.href}
                                    className={styles.upsellLink}
                                >
                                    {capUpsell.action.label}
                                </a>
                            </>
                        )}
                    </p>
                )}

                <div className={styles.gallery}>
                    {galleryItems.map((item, index) => (
                        <PhotoGalleryItem
                            key={item.id || item.url}
                            locale={locale}
                            item={item}
                            position={index + 1}
                            isFirst={index === 0}
                            isLast={index === galleryItems.length - 1}
                            disabled={anyOpInFlight || !opsReady}
                            onRemove={handleGalleryRemove}
                            onPromote={handlePromoteToFeatured}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                            onUpdateMetadata={handleUpdateMediaText}
                        />
                    ))}

                    {!isGalleryFull && (
                        <button
                            type="button"
                            className={`${styles.galleryAddButton} ${isDragOverGallery ? styles.galleryDragOver : ''}`}
                            onClick={() =>
                                !anyOpInFlight &&
                                isGalleryCapResolved &&
                                galleryInputRef.current?.click()
                            }
                            onDrop={handleGalleryDrop}
                            onDragOver={handleGalleryDragOver}
                            onDragLeave={handleGalleryDragLeave}
                            disabled={anyOpInFlight || !isGalleryCapResolved}
                            aria-label={t(
                                'host.properties.editor.photo.addToGallery',
                                'Agregar fotos a la galería'
                            )}
                        >
                            +
                        </button>
                    )}
                </div>

                <input
                    ref={galleryInputRef}
                    id="gallery-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    multiple={remainingGallerySlots > 1}
                    className={styles.fileInput}
                    disabled={!isGalleryCapResolved}
                    onChange={handleGallerySelect}
                />
            </div>
        </div>
    );
}
