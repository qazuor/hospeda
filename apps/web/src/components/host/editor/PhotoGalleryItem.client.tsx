/**
 * @file PhotoGalleryItem.client.tsx
 * @description One gallery thumbnail in the accommodation photo editor
 * (HOS-122), with its per-photo action row: remove, promote to portada, and
 * keyboard-operable move up / move down for manual reordering.
 *
 * Extracted from `PhotoSection.client.tsx` to keep that file under the
 * repo's 500-line ceiling once multi-select upload, drag & drop, and reorder
 * actions were added.
 *
 * Reordering here is BUTTON-driven, not drag-and-drop (owner decision,
 * HOS-122): the editor's audience is largely non-technical hosts, and a
 * pointer-only drag gesture excludes keyboard and screen-reader users. Plain
 * `<button>` elements get full keyboard operability (Tab + Enter/Space) for
 * free, which a custom drag implementation would have to build by hand.
 *
 * HOS-1023: the move-up/move-down/promote toolbar lives BELOW the thumbnail
 * (in `.galleryItemWrapper`'s normal flow), not overlaid on top of it. The
 * overlay covered ~39.5% of a 167x125px thumbnail and let the "Portada"
 * text button overflow its own frame by ~14px. Moving the toolbar out of
 * the photo removes the overlap problem at the source instead of shrinking
 * touch targets or lightening the background — HOS-790 fixed those for
 * contrast/tap-area reasons and both are preserved unchanged. Only the `✕`
 * remove button stays overlaid, in its own corner, since a single 44x44
 * control doesn't recreate the same issue.
 *
 * The promote button went a step further and dropped its text entirely,
 * replaced by a `StarIcon` (owner decision, once the text version turned
 * out to still overflow at the grid's 150px column floor even out of the
 * photo): with no text to measure, it's a fixed 44x44 icon button exactly
 * like `↑`/`↓`, so there is no width budget to get wrong. `flex-wrap` stays
 * on `.galleryItemToolbar` as a safety net regardless (see that class's
 * comment in PhotoSection.module.css).
 *
 * The star's weight follows `item.isFeatured` — filled ("this already IS
 * the portada") vs outline ("promote this to portada") — reusing the field
 * `AccommodationMediaItem` already carries for this exact distinction
 * elsewhere, not a new prop. In practice every item passed to this
 * component today has `isFeatured: false`: `PhotoSection.client.tsx` keeps
 * the featured row in its own separate `featuredItem` slot (with no
 * promote button of its own — it's already the cover) and only ever puts
 * `isFeatured: false` rows into the `galleryItems` array this component
 * renders (see that file's docblock, and both `isFeatured: false`
 * assignments in `use-photo-section.ts`). The filled branch is wired
 * correctly and stays for whichever of those two invariants changes first,
 * but it does not currently render in this grid.
 *
 * A `title` mirrors the button's own `aria-label` text, so a mouse user
 * gets the same information on hover that a screen reader announces —
 * necessary now that there's no visible label at all.
 *
 * HOS-2126 ADDED drag-and-drop on top of the buttons, it did not replace
 * them: the reasoning above still holds, so `↑`/`↓` remain the always-there
 * path and the drag handle is an extra, faster one. The sortable wiring lives
 * in `SortablePhotoGallery.client.tsx`; this component only renders the
 * handle (a fourth 44x44 toolbar button) when that wiring hands it
 * `dragHandle`, and applies the sortable ref/transform to its wrapper. Without
 * those props it renders exactly as before.
 */

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    DeleteIcon,
    GripVerticalIcon,
    StarIcon
} from '@repo/icons';
import { getMediaUrl } from '@repo/media';
import type { CSSProperties } from 'react';
import { Button, PhotoTile } from '@/components/account/ui';
import type { AccommodationMediaItem } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PhotoAltBadge } from './PhotoAltBadge';
import { PhotoMetadataEditor } from './PhotoMetadataEditor.client';
import styles from './PhotoSection.module.css';
import type { PhotoMetadataUpdateBody } from './photo-section-helpers';

/** Props the sortable wrapper hands to the drag handle button (HOS-2126). */
export interface PhotoDragHandleProps {
    /** Activator ref: dnd-kit returns focus here after a keyboard drag. */
    readonly ref: (element: HTMLElement | null) => void;
    readonly attributes: DraggableAttributes;
    readonly listeners: DraggableSyntheticListeners;
    readonly disabled: boolean;
}

export interface PhotoGalleryItemProps {
    readonly locale: SupportedLocale;
    readonly item: AccommodationMediaItem;
    /** 1-based position in the gallery — used for alt text and aria-labels. */
    readonly position: number;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    /** True while any op is in flight, hydration is pending, or the item lacks a DB id yet. */
    readonly disabled: boolean;
    readonly onRemove: (item: AccommodationMediaItem) => void;
    readonly onPromote: (item: AccommodationMediaItem) => void;
    readonly onMoveUp: (item: AccommodationMediaItem) => void;
    readonly onMoveDown: (item: AccommodationMediaItem) => void;
    /** Corrects this photo's alt/caption/description (HOS-125). */
    readonly onUpdateMetadata: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
    /** Sortable node ref for the wrapper (HOS-2126). Omitted outside a sortable list. */
    readonly sortableRef?: (element: HTMLElement | null) => void;
    /** Sortable id, exposed as `data-sortable-id` on the wrapper. */
    readonly sortableId?: string;
    /** Transform/transition applied while the item is being dragged or displaced. */
    readonly sortableStyle?: CSSProperties;
    /** True while this item is the one being dragged. */
    readonly isDragging?: boolean;
    /** Drag handle wiring; when omitted no handle is rendered. */
    readonly dragHandle?: PhotoDragHandleProps;
    /**
     * The photo is beyond the owner's cap, so the public gallery does not show
     * it (HOS-2495). It is marked and dimmed, never hidden, and every control
     * stays enabled: reorder, metadata, cover and delete are never refused by
     * the cap.
     */
    readonly isOverCap?: boolean;
}

/**
 * Renders one gallery photo: the thumbnail, a remove button, and a toolbar
 * with move-up / move-down / promote-to-portada actions.
 */
export function PhotoGalleryItem({
    locale,
    item,
    position,
    isFirst,
    isLast,
    disabled,
    onRemove,
    onPromote,
    onMoveUp,
    onMoveDown,
    onUpdateMetadata,
    sortableRef,
    sortableId,
    sortableStyle,
    isDragging = false,
    dragHandle,
    isOverCap = false
}: PhotoGalleryItemProps) {
    const { t } = createTranslations(locale);
    const canOperate = !disabled && Boolean(item.id);
    // HOS-637: `.galleryItem` is a `minmax(150px, 1fr)` grid cell at a 4:3
    // aspect ratio (see PhotoSection.module.css) — the original upload
    // (frequently several MB, per the F-38 smoke finding) was rendered here
    // unconditionally. `galleryHalf` is the closest existing 4:3 preset;
    // `width: 300` matches this grid's realistic cell size instead of the
    // preset's own 640px default meant for a half-width gallery cell.
    const thumbnailUrl = getMediaUrl(item.url, { preset: 'galleryHalf', width: 300 });
    // Shared verbatim between `aria-label` and `title` on the promote button
    // below — the icon carries no text of its own, so both the accessible
    // name and the mouse-hover tooltip must say the exact same thing.
    const promoteAriaLabel = t(
        'host.properties.editor.photo.promoteToFeaturedAria',
        'Usar foto {{index}} como portada',
        { index: position }
    );

    const dragHandleAriaLabel = t(
        'host.properties.editor.photo.dragHandleAria',
        'Arrastrar foto {{index}} para cambiar su orden',
        { index: position }
    );

    const overCapNoteId = isOverCap ? `photo-over-cap-${sortableId ?? position}` : undefined;

    return (
        <PhotoTile
            className={isOverCap ? styles.overCapTile : undefined}
            describedBy={overCapNoteId}
            ref={sortableRef}
            sortableId={sortableId}
            dragStyle={sortableStyle}
            isDragging={isDragging}
            src={thumbnailUrl}
            alt={
                item.alt ??
                t('host.properties.editor.photo.galleryAlt', undefined, {
                    index: position
                })
            }
            actions={
                <Button
                    variant="secondary"
                    size="lg"
                    iconOnly
                    onClick={() => onRemove(item)}
                    disabled={!canOperate}
                    aria-label={t('host.properties.editor.photo.remove', 'Eliminar')}
                >
                    <DeleteIcon
                        size="sm"
                        aria-hidden="true"
                    />
                </Button>
            }
            badge={
                <>
                    {isOverCap && (
                        <span
                            id={overCapNoteId}
                            className={styles.overCapBadge}
                            data-testid="photo-over-cap-badge"
                        >
                            {t(
                                'account.listingPhotos.overCapBadge',
                                'No se muestra: superás tu tope'
                            )}
                        </span>
                    )}
                    <PhotoAltBadge
                        locale={locale}
                        item={item}
                    />
                </>
            }
            toolbar={
                <div
                    role="toolbar"
                    aria-label={t(
                        'account.myContent.editor.media.photoActions',
                        'Photo actions {{index}}',
                        { index: position }
                    )}
                    className={styles.galleryToolbar}
                >
                    {dragHandle && (
                        <Button
                            variant="secondary"
                            size="lg"
                            iconOnly
                            ref={dragHandle.ref}
                            className={styles.dragHandle}
                            {...dragHandle.attributes}
                            {...dragHandle.listeners}
                            // After the dnd-kit spreads on purpose: their
                            // `aria-roledescription` stays, but the accessible
                            // name must say WHICH photo this handle moves.
                            disabled={dragHandle.disabled}
                            aria-label={dragHandleAriaLabel}
                            title={dragHandleAriaLabel}
                        >
                            <GripVerticalIcon
                                size="sm"
                                aria-hidden="true"
                            />
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="lg"
                        iconOnly
                        onClick={() => onMoveUp(item)}
                        disabled={!canOperate || isFirst}
                        aria-label={t(
                            'host.properties.editor.photo.moveUpAria',
                            'Mover foto {{index}} hacia arriba',
                            { index: position }
                        )}
                    >
                        <ChevronUpIcon
                            size="sm"
                            aria-hidden="true"
                        />
                    </Button>
                    <Button
                        variant="secondary"
                        size="lg"
                        iconOnly
                        onClick={() => onMoveDown(item)}
                        disabled={!canOperate || isLast}
                        aria-label={t(
                            'host.properties.editor.photo.moveDownAria',
                            'Mover foto {{index}} hacia abajo',
                            { index: position }
                        )}
                    >
                        <ChevronDownIcon
                            size="sm"
                            aria-hidden="true"
                        />
                    </Button>
                    <Button
                        variant="secondary"
                        size="lg"
                        iconOnly
                        onClick={() => onPromote(item)}
                        disabled={!canOperate}
                        aria-label={promoteAriaLabel}
                        title={promoteAriaLabel}
                    >
                        <StarIcon
                            size="sm"
                            weight={item.isFeatured ? 'fill' : 'regular'}
                            aria-hidden="true"
                        />
                    </Button>
                </div>
            }
        >
            <PhotoMetadataEditor
                locale={locale}
                item={item}
                closeOnSuccessfulSave
                disabled={disabled}
                compactLayout
                toggleAriaLabel={t(
                    'host.properties.editor.photo.editDetailsAria',
                    'Editar textos de la foto {{index}}',
                    { index: position }
                )}
                closeAriaLabel={t(
                    'host.properties.editor.photo.closeDetailsAria',
                    'Cerrar edición de textos de la foto {{index}}',
                    { index: position }
                )}
                onSave={onUpdateMetadata}
            />
        </PhotoTile>
    );
}
