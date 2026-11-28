/**
 * @file PhotoSection.client.tsx
 * @description The ONE photo editor of the three listing verticals
 * (accommodation, venue, experience — HOS-2495). Both `fotos.astro` pages
 * render it with `{ vertical, listingId }`; every call goes through that
 * vertical's `ListingPhotoApi` (`createListingPhotoApi`).
 *
 * HOS-2495: the cap is the listing's photo allowance
 * (`GET …/{id}/photo-allowance`), the same number step 7 enforces on the
 * server: plan + add-ons + grants, with the pre-trial DRAFT fallback. The
 * description renders its five states (`PhotoSectionDescription`), and the
 * tiles beyond the cap are marked "No se muestra: superás tu tope" — the public
 * gallery hides them, reversibly, and they stay fully editable here.
 *
 * SPEC-204: Migrated from JSONB-controlled (parent-owned state) to per-operation
 * persistence against the relational `accommodation_media` endpoints. Every
 * add/remove/set-featured call hits the API immediately — no buffering in the
 * parent PATCH payload.
 *
 * HOS-1024: the gallery cap shown/enforced here is the owner's EFFECTIVE cap,
 * never a flat entity ceiling. Since HOS-2495 there is no literal listing
 * ceiling left at all (`ENTITY_GALLERY_CAPS` covers content entities only); see
 * `photo-cap-view.ts` for the loading / none / unlimited / failed contract.
 *
 * HOS-122 added four owner-declared gaps on top of that persistence layer,
 * all UI-only (the backend already existed):
 *   1. Multi-select gallery upload — the gallery `<input>` now takes
 *      `multiple` and uploads are processed SEQUENTIALLY (one XHR at a time,
 *      not in parallel) so upload progress stays meaningful and the cap is
 *      checked once, up front, against the whole batch — see
 *      `use-photo-section.ts`'s `processGalleryFiles`.
 *   2. Manual reordering via `accommodationMediaApi.reorderMedia` — BUTTON
 *      driven (move up / move down per photo, in `PhotoGalleryItem`): the
 *      editor's audience is largely non-technical hosts, and plain
 *      `<button>`s are keyboard/screen-reader operable for free. HOS-2126
 *      added drag-and-drop (`SortablePhotoGallery`) ON TOP of those buttons,
 *      with mouse, touch and keyboard sensors; both gestures persist through
 *      the same optimistic path with rollback.
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

import { DeleteIcon } from '@repo/icons';
import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, getMediaUrl } from '@repo/media';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PhotoEditor } from '@/components/account/editor/PhotoEditor';
import {
    Alert,
    Button,
    MediaDropzone,
    PhotoTile,
    TextLink,
    useConfirm
} from '@/components/account/ui';
import { createListingPhotoApi, type ListingPhotoVertical } from '@/lib/api/listing-photo-api';
import type { AccommodationMediaItem, MediaImage } from '@/lib/api/types';
import { photoRemovalConfirmRequest } from '@/lib/forms/confirm-photo-removal';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PhotoAltBadge } from './PhotoAltBadge';
import { PhotoMetadataEditor } from './PhotoMetadataEditor.client';
import styles from './PhotoSection.module.css';
import { PhotoSectionDescription } from './PhotoSectionDescription.client';
import { PhotoUploadStatus } from './PhotoUploadStatus';
import { PublishReadyDialog } from './PublishReadyDialog.client';
import type { PhotoSectionInitialImage } from './photo-section-model';
import { SortablePhotoGallery } from './SortablePhotoGallery.client';
import { usePhotoAltWarningGuard } from './use-photo-alt-warning-guard';
import { usePhotoSection } from './use-photo-section';
import { usePublishReadyPrompt } from './use-publish-ready-prompt';

// Re-export upload helper so existing callers of PhotoSection.client can still import it
export { uploadEntityImage } from '@/lib/media/upload-entity';
// Re-export types for consumers that import from this module
export type { AccommodationMediaItem, MediaImage };

/** Props for the self-contained PhotoSection (SPEC-204, HOS-2495). */
export interface PhotoSectionProps {
    readonly locale: SupportedLocale;
    /** Which listing vertical the photos belong to (HOS-2495). */
    readonly vertical: ListingPhotoVertical;
    /** UUID of the listing being edited. */
    readonly listingId: string;
    /**
     * Optional first-paint featured image (from SSR).
     * Shown until `listMedia` resolves. Lacks a DB id — cannot trigger API ops.
     */
    readonly initialFeaturedImage?: PhotoSectionInitialImage | null;
    /**
     * Optional first-paint gallery (from SSR).
     * Shown until `listMedia` resolves. Lack DB ids — cannot trigger API ops.
     */
    readonly initialGallery?: readonly PhotoSectionInitialImage[];
    /**
     * The half of publish readiness this section does NOT own, so the post-save
     * publish prompt can fire when the main photo was the last thing missing
     * (HOS-1183).
     *
     * Optional: without it the prompt is simply never evaluated here, which is
     * the correct degradation for any consumer that is not the accommodation
     * editor's photo page.
     */
    readonly publishContext?: {
        readonly description: string | null | undefined;
        readonly capacity: number | null;
        readonly minNights: number | null;
        readonly bedrooms: number | null;
        readonly bathrooms: number | null;
        /** Only a draft has anything to offer; a live listing is already live. */
        readonly isDraft: boolean;
        /** Trial length in days, for the prompt's copy. */
        readonly trialDays: number;
    };
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
    vertical,
    listingId,
    initialFeaturedImage = null,
    initialGallery = [],
    publishContext
}: PhotoSectionProps) {
    const { t, tPlural } = createTranslations(locale);
    const api = useMemo(() => createListingPhotoApi({ vertical }), [vertical]);

    // HOS-2429 + HOS-2489: deletes are immediate, so the kit dialog asks first.
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });
    const confirmRemoval = useCallback(
        () => askConfirm(photoRemovalConfirmRequest({ t })),
        [askConfirm, t]
    );

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
        allowance,
        capView,
        overCapIds,
        isGalleryUploadOpen,
        isCoverUploadOpen,
        capUpsell,
        opsReady,
        mediaLoadSucceeded,
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
        handleReorderGallery,
        handleUpdateMediaText
    } = usePhotoSection({
        locale,
        api,
        listingId,
        initialFeaturedImage,
        initialGallery,
        confirmRemoval
    });

    // HOS-1018: ask before leaving or saving while required photo alt text is
    // incomplete. The host can continue, or stay and focus the first photo.
    usePhotoAltWarningGuard({
        locale,
        accommodationId: listingId,
        featuredItem,
        galleryItems,
        mediaReady: mediaLoadSucceeded
    });

    // HOS-1183: the main photo is a blocking publish requirement, and this is
    // the realistic last one — hosts fill text first and upload photos last. So
    // this section is one of the two that can make a listing publishable.
    //
    // It watches the RESULT rather than hooking each mutation. Four different
    // paths set the cover (upload into the slot, drop a file on it, promote a
    // gallery photo, and the hydrating refresh), and wiring the prompt into
    // each is four places for one of them to be forgotten.
    const publishPrompt = usePublishReadyPrompt();
    const previousFeaturedRef = useRef<AccommodationMediaItem | null>(featuredItem);
    const hasHydratedRef = useRef(false);

    useEffect(() => {
        // `opsReady` is the hook's hydration flag. Before it flips, a null →
        // non-null change is the API answering, not the host uploading — firing
        // there would open the dialog on page load for a listing that already
        // had its cover.
        if (!opsReady) {
            return;
        }
        if (!hasHydratedRef.current) {
            hasHydratedRef.current = true;
            previousFeaturedRef.current = featuredItem;
            return;
        }

        const hadFeatured = previousFeaturedRef.current !== null;
        previousFeaturedRef.current = featuredItem;

        if (!publishContext || hadFeatured || featuredItem === null) {
            return;
        }

        const { description, capacity, minNights, bedrooms, bathrooms, isDraft } = publishContext;
        void publishPrompt.evaluate({
            before: { description, capacity, minNights, bedrooms, bathrooms, hasMainImage: false },
            after: { description, capacity, minNights, bedrooms, bathrooms, hasMainImage: true },
            isDraft
        });
    }, [featuredItem, opsReady, publishContext, publishPrompt]);

    const galleryCap = capView.kind === 'limited' ? capView.cap : null;
    const remainingGallerySlots =
        capView.kind === 'unlimited'
            ? Number.POSITIVE_INFINITY
            : Math.max((galleryCap ?? 0) - galleryItems.length, 0);
    const hiddenCount = overCapIds.size;

    return (
        <PhotoEditor
            locale={locale}
            uploadHint={t(
                'host.properties.editor.photo.formats',
                'JPG, PNG o WebP — máx. {{maxSize}}MB',
                { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
            )}
            helpId={sectionHelpId({ vertical, slug: 'fotos' })}
            description={
                <PhotoSectionDescription
                    locale={locale}
                    vertical={vertical}
                    capView={capView}
                    breakdown={allowance?.breakdown ?? null}
                />
            }
            featured={
                <div className={styles.slot}>
                    <label
                        htmlFor="featured-image-input"
                        className={styles.slotLabel}
                    >
                        {t('host.properties.editor.photo.featured', 'Imagen principal')}
                    </label>

                    {featuredItem ? (
                        // HOS-637: the `card` preset (w_400,h_300) matches the
                        // featured tile's 4:3 frame.
                        <PhotoTile
                            featured
                            src={getMediaUrl(featuredItem.url, { preset: 'card' })}
                            alt={
                                featuredItem.alt ??
                                t('host.properties.editor.photo.featuredAlt', 'Imagen principal')
                            }
                            actions={
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    iconOnly
                                    onClick={handleFeaturedRemove}
                                    disabled={anyOpInFlight || !opsReady || !featuredItem.id}
                                    aria-label={t(
                                        'host.properties.editor.photo.remove',
                                        'Eliminar'
                                    )}
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
                                closeOnSuccessfulSave
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
                        </PhotoTile>
                    ) : (
                        <MediaDropzone
                            title={t(
                                'host.properties.editor.photo.dropOrClick',
                                'Arrastrá una imagen o hacé clic para seleccionar'
                            )}
                            hint={t(
                                'host.properties.editor.photo.formats',
                                'JPG, PNG o WebP — máx. {{maxSize}}MB',
                                { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
                            )}
                            isDragOver={isDragOverFeatured}
                            disabled={anyOpInFlight || !isCoverUploadOpen}
                            onPick={() => featuredInputRef.current?.click()}
                            onDrop={handleFeaturedDrop}
                            onDragOver={handleFeaturedDragOver}
                            onDragLeave={handleFeaturedDragLeave}
                        />
                    )}

                    <input
                        ref={featuredInputRef}
                        id="featured-image-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        className={styles.fileInput}
                        disabled={!isCoverUploadOpen}
                        onChange={handleFeaturedSelect}
                    />
                </div>
            }
            status={
                <>
                    <PhotoUploadStatus
                        locale={locale}
                        isCompressing={isCompressing}
                        isUploading={isUploading}
                        progress={uploadProgress}
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
            galleryInputId="gallery-image-input"
            galleryLabel={
                <span aria-busy={capView.kind === 'loading'}>
                    {galleryCap === null
                        ? t('host.properties.editor.photo.galleryLoading', 'Galería de fotos')
                        : t(
                              'host.properties.editor.photo.gallery',
                              'Galería de fotos (máx. {{cap}})',
                              { cap: galleryCap }
                          )}
                </span>
            }
            galleryNotice={
                <>
                    {hiddenCount > 0 && (
                        // HOS-2495: name the cause and the two ways out (a pack,
                        // or reordering which photos fall inside the cap).
                        <Alert
                            tone="warning"
                            locale={locale}
                        >
                            <span data-testid="photo-over-cap-summary">
                                {tPlural('account.listingPhotos.overCapSummary', hiddenCount, {
                                    count: hiddenCount
                                })}
                            </span>
                        </Alert>
                    )}
                    {isGalleryFull && galleryCap !== null && (
                        // HOS-1024: sober, single-line upsell — the same copy/CTA
                        // the failed-upload toast already uses.
                        <Alert
                            tone="warning"
                            locale={locale}
                            action={
                                capUpsell ? (
                                    <span className={styles.capUpsellActions}>
                                        <TextLink href={capUpsell.action.href}>
                                            {capUpsell.action.label}
                                        </TextLink>
                                        {capUpsell.secondaryAction && (
                                            <TextLink href={capUpsell.secondaryAction.href}>
                                                {capUpsell.secondaryAction.label}
                                            </TextLink>
                                        )}
                                    </span>
                                ) : undefined
                            }
                        >
                            {tPlural('host.properties.editor.photo.galleryCapReached', galleryCap, {
                                cap: galleryCap
                            })}
                        </Alert>
                    )}
                </>
            }
            gallery={
                <SortablePhotoGallery
                    locale={locale}
                    items={galleryItems}
                    disabled={anyOpInFlight || !opsReady}
                    onRemove={handleGalleryRemove}
                    onPromote={handlePromoteToFeatured}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onReorder={handleReorderGallery}
                    onUpdateMetadata={handleUpdateMediaText}
                    overCapIds={overCapIds}
                />
            }
            galleryPicker={
                isGalleryFull
                    ? undefined
                    : {
                          title: t(
                              'host.properties.editor.photo.addToGallery',
                              'Agregar fotos a la galería'
                          ),
                          isDragOver: isDragOverGallery,
                          disabled: anyOpInFlight || !isGalleryUploadOpen,
                          onPick: () => galleryInputRef.current?.click(),
                          onDrop: handleGalleryDrop,
                          onDragOver: handleGalleryDragOver,
                          onDragLeave: handleGalleryDragLeave
                      }
            }
            galleryInput={
                <input
                    ref={galleryInputRef}
                    id="gallery-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    multiple={remainingGallerySlots > 1}
                    className={styles.fileInput}
                    disabled={!isGalleryUploadOpen || isGalleryFull}
                    onChange={handleGallerySelect}
                />
            }
        >
            {confirmDialog}
            <PublishReadyDialog
                isOpen={publishPrompt.isOpen}
                onClose={publishPrompt.close}
                locale={locale}
                accommodationId={listingId}
                startsTrial={publishPrompt.startsTrial}
                trialDays={publishContext?.trialDays ?? 0}
            />
        </PhotoEditor>
    );
}
