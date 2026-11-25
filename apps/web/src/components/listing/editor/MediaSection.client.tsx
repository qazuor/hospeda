/**
 * @file MediaSection.client.tsx
 * @description Featured image + photo gallery section of the listing owner
 * editor (SPEC-249 T-015c, extracted in HOS-258), migrated to per-operation
 * persistence against the relational `venue_media` / `experience_media`
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
 * already accepts venue and experience listing types, T-015a/b) —
 * that part is UNCHANGED. What changed is what happens right after a successful
 * upload: instead of calling `onChange` with the full next
 * `{ featuredImage, gallery }` state for the orchestrator to buffer, this
 * section now calls `listingMediaApi.addMedia` (and, for the featured slot,
 * the atomic `listingMediaApi.addFeaturedMedia`) so the row is persisted
 * immediately without a gallery-cap check on a not-yet-created row.
 *
 * Cloudinary cleanup is now SERVER-SIDE and this component does not participate
 * in it. `listingMediaApi.removeMedia` deletes the binary before dropping the
 * row (HOS-372), so a successful response already means the asset is gone.
 *
 * This replaced a client-side best-effort call to
 * `protectedMediaApi.deleteMedia({ publicId })` that could never have worked:
 * `media/protected/delete-entity` only accepts accommodation / destination /
 * event / post, and rejected venue and experience listing types with HTTP 400 — even
 * though `media/upload-entity` accepts both. Uploads went in through a door that
 * existed; deletes went out through one that returned 400, so every listing
 * photo removal orphaned its asset regardless of this call.
 *
 * HOS-2489: this file is the render layer only, on the kit MediaManager skin
 * shared with the accommodation editor. State and handlers live in
 * `use-listing-media.ts` (+ `use-listing-media-upload.ts`), the pure upload
 * helpers in `listing-media-upload.ts`.
 */

import { DeleteIcon } from '@repo/icons';
import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB } from '@repo/media';
import type { Image } from '@repo/schemas';
import { type JSX, useCallback } from 'react';
import { PhotoEditor } from '@/components/account/editor/PhotoEditor';
import { Alert, Button, MediaDropzone, PhotoTile, useConfirm } from '@/components/account/ui';
import { PhotoAltBadge } from '@/components/host/editor/PhotoAltBadge';
import { PhotoMetadataEditor } from '@/components/host/editor/PhotoMetadataEditor.client';
import styles from '@/components/host/editor/PhotoSection.module.css';
import { PhotoUploadStatus } from '@/components/host/editor/PhotoUploadStatus';
import { photoRemovalConfirmRequest } from '@/lib/forms/confirm-photo-removal';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { useListingMedia } from './use-listing-media';

export interface MediaSectionProps {
    readonly locale: SupportedLocale;
    /** Vertical of the listing (drives the media endpoint path + gallery cap). */
    readonly vertical: VenueOrExperience;
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

/**
 * Featured-image + gallery section for a listing. Hydrates on mount
 * from `listingMediaApi.listMedia`; every user operation (add, remove,
 * set-featured) is persisted immediately via a granular API call and reported
 * to the shell auto-save chip. The parent PATCH no longer carries media data.
 *
 * Errors are shown inline AND via the global toast store (mirrors
 * PhotoSection's BETA-144 behavior). On any op failure the local state is NOT
 * mutated, keeping the UI consistent with the server.
 */
export function MediaSection({
    locale,
    vertical,
    listingId,
    initialFeaturedImage = null,
    initialGallery = []
}: MediaSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    // HOS-2429 + HOS-2489: deletes are immediate, so the kit dialog asks first.
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });
    const confirmRemoval = useCallback(
        () => askConfirm(photoRemovalConfirmRequest({ t })),
        [askConfirm, t]
    );

    const {
        featuredInputRef,
        galleryInputRef,
        featuredItem,
        galleryItems,
        isUploading,
        isCompressing,
        uploadBatch,
        error,
        galleryCap,
        isGalleryFull,
        remainingGallerySlots,
        anyOpInFlight,
        opsReady,
        handleFeaturedSelect,
        handleFeaturedRemove,
        handleGallerySelect,
        handleGalleryRemove,
        handleUpdateText
    } = useListingMedia({
        locale,
        vertical,
        listingId,
        initialFeaturedImage,
        initialGallery,
        confirmRemoval
    });

    const removeLabel = t('listing.owner.editor.media.remove', 'Eliminar');

    return (
        <PhotoEditor
            locale={locale}
            uploadHint={t(
                'listing.owner.editor.media.uploadHint',
                'JPG, PNG, WebP o HEIC — máx. {{maxSize}}MB',
                { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
            )}
            helpId={sectionHelpId({ vertical, slug: 'fotos' })}
            id="editor-media"
            featured={
                <div className={styles.slot}>
                    <span className={styles.slotLabel}>
                        {t('listing.owner.editor.media.featured', 'Imagen principal')}
                    </span>
                    {featuredItem ? (
                        <PhotoTile
                            featured
                            src={featuredItem.url}
                            alt={
                                featuredItem.alt ??
                                t('listing.owner.editor.media.featured', 'Imagen principal')
                            }
                            actions={
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    iconOnly
                                    aria-label={removeLabel}
                                    disabled={anyOpInFlight || !opsReady || !featuredItem.id}
                                    onClick={handleFeaturedRemove}
                                >
                                    <DeleteIcon
                                        size="sm"
                                        aria-hidden="true"
                                    />
                                </Button>
                            }
                            badge={
                                <PhotoAltBadge
                                    locale={locale}
                                    item={featuredItem}
                                />
                            }
                        >
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
                                onSave={handleUpdateText}
                            />
                        </PhotoTile>
                    ) : (
                        <MediaDropzone
                            title={t('listing.owner.editor.media.add', 'Agregar foto')}
                            disabled={isUploading || isCompressing}
                            onPick={() => featuredInputRef.current?.click()}
                        />
                    )}
                    <input
                        ref={featuredInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        aria-label={t('listing.owner.editor.media.featured', 'Imagen principal')}
                        className={styles.fileInput}
                        onChange={handleFeaturedSelect}
                    />
                </div>
            }
            galleryLabel={
                <>
                    {t('listing.owner.editor.media.gallery', 'Galería de fotos')} (
                    {galleryItems.length}/{galleryCap})
                </>
            }
            gallery={galleryItems.map((image, index) => (
                <PhotoTile
                    key={image.id || image.url}
                    src={image.url}
                    alt={image.alt ?? t('listing.owner.editor.media.gallery', 'Galería de fotos')}
                    actions={
                        <Button
                            variant="secondary"
                            size="lg"
                            iconOnly
                            aria-label={removeLabel}
                            disabled={anyOpInFlight || !opsReady || !image.id}
                            onClick={() => handleGalleryRemove(image)}
                        >
                            <DeleteIcon
                                size="sm"
                                aria-hidden="true"
                            />
                        </Button>
                    }
                    badge={
                        <PhotoAltBadge
                            locale={locale}
                            item={image}
                        />
                    }
                >
                    <PhotoMetadataEditor
                        locale={locale}
                        item={image}
                        disabled={anyOpInFlight || !opsReady}
                        compactLayout={true}
                        toggleAriaLabel={t(
                            'host.properties.editor.photo.editDetailsAria',
                            'Editar textos de la foto {{index}}',
                            { index: index + 1 }
                        )}
                        closeAriaLabel={t(
                            'host.properties.editor.photo.closeDetailsAria',
                            'Cerrar edición de textos de la foto {{index}}',
                            { index: index + 1 }
                        )}
                        onSave={handleUpdateText}
                    />
                </PhotoTile>
            ))}
            galleryPicker={
                isGalleryFull
                    ? undefined
                    : {
                          title: t('listing.owner.editor.media.add', 'Agregar foto'),
                          disabled: isUploading || isCompressing,
                          onPick: () => galleryInputRef.current?.click()
                      }
            }
            galleryInputId="listing-gallery-image-input"
            galleryInput={
                <input
                    id="listing-gallery-image-input"
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    multiple={remainingGallerySlots > 1}
                    disabled={isGalleryFull}
                    aria-label={t('listing.owner.editor.media.gallery', 'Galería de fotos')}
                    className={styles.fileInput}
                    onChange={handleGallerySelect}
                />
            }
            status={
                <>
                    <PhotoUploadStatus
                        locale={locale}
                        isCompressing={isCompressing}
                        isUploading={isUploading}
                        batch={uploadBatch}
                    />

                    {error && (
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {error}
                        </Alert>
                    )}
                </>
            }
        >
            {confirmDialog}
        </PhotoEditor>
    );
}
