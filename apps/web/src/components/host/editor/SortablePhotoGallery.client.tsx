/**
 * @file SortablePhotoGallery.client.tsx
 * @description Drag-and-drop reordering for the accommodation photo gallery
 * (HOS-2126), built on `@dnd-kit`.
 *
 * Drag-and-drop is ADDED on top of the move-up / move-down buttons, never a
 * replacement for them (owner decision, HOS-2126 — see the docblock in
 * `PhotoGalleryItem.client.tsx` for why the buttons exist). The buttons stay
 * the plain, always-available path; the drag handle is the fast path for
 * hosts who want to move a photo across many positions at once.
 *
 * Three input modes, chosen so none of them hijacks an ordinary gesture:
 *   - Mouse: a drag starts only after the pointer moves 6px, so a click on
 *     the handle is still a click.
 *   - Touch: a drag starts only after a 250ms press held within 8px, so a
 *     finger scrolling the page across the handle scrolls the page.
 *   - Keyboard: focus the handle, Space/Enter to pick up, arrows to move,
 *     Space/Enter to drop, Escape to cancel. Every step is announced to
 *     screen readers in the host's locale.
 *
 * Only the dedicated handle starts a drag: the thumbnail itself, the remove
 * button and the toolbar keep their own behaviour. The cover ("Portada") is
 * NOT part of this list — it lives in its own slot in `PhotoSection` and is
 * changed only through the promote action.
 *
 * Rendering stays with `PhotoGalleryItem`; this component only wires the
 * sortable state and forwards the handle props.
 */

import {
    type Announcements,
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    MouseSensor,
    type ScreenReaderInstructions,
    TouchSensor,
    type UniqueIdentifier,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    rectSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { AccommodationMediaItem } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type PhotoDragHandleProps, PhotoGalleryItem } from './PhotoGalleryItem.client';
import type { PhotoMetadataUpdateBody } from './photo-section-helpers';

/** Pointer travel (px) before a mouse drag starts — keeps clicks as clicks. */
const MOUSE_ACTIVATION_DISTANCE_PX = 6;
/** Press-and-hold (ms) before a touch drag starts — keeps scrolling as scrolling. */
const TOUCH_ACTIVATION_DELAY_MS = 250;
/** Finger movement (px) tolerated during the touch hold before it is treated as a scroll. */
const TOUCH_ACTIVATION_TOLERANCE_PX = 8;

/** Props for {@link SortablePhotoGallery}. */
export interface SortablePhotoGalleryProps {
    readonly locale: SupportedLocale;
    /** Gallery rows in display order. Never includes the cover. */
    readonly items: readonly AccommodationMediaItem[];
    /** True while any op is in flight or hydration is pending. */
    readonly disabled: boolean;
    readonly onRemove: (item: AccommodationMediaItem) => void;
    readonly onPromote: (item: AccommodationMediaItem) => void;
    readonly onMoveUp: (item: AccommodationMediaItem) => void;
    readonly onMoveDown: (item: AccommodationMediaItem) => void;
    /** Called once per completed drop that changed the position. */
    readonly onReorder: (fromIndex: number, toIndex: number) => void;
    readonly onUpdateMetadata: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

/** Stable sortable id: the DB UUID, or the URL for an SSR placeholder without one. */
function getSortableId(item: AccommodationMediaItem): string {
    return item.id || item.url;
}

/**
 * Gallery grid whose photos can be reordered by dragging their handle, by
 * mouse, touch or keyboard. Renders only the photo cells; the caller owns the
 * surrounding grid element and anything appended after the photos.
 */
export function SortablePhotoGallery({
    locale,
    items,
    disabled,
    onRemove,
    onPromote,
    onMoveUp,
    onMoveDown,
    onReorder,
    onUpdateMetadata
}: SortablePhotoGalleryProps) {
    const { t } = createTranslations(locale);
    // Read once here, not per cell: one media-query listener for the grid.
    const prefersReducedMotion = useReducedMotion();

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: MOUSE_ACTIVATION_DISTANCE_PX }
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: TOUCH_ACTIVATION_DELAY_MS,
                tolerance: TOUCH_ACTIVATION_TOLERANCE_PX
            }
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const ids = useMemo(() => items.map(getSortableId), [items]);
    const total = ids.length;

    /** 1-based position of a sortable id in the current order. */
    const positionOf = (id: UniqueIdentifier | undefined): number =>
        id === undefined ? 0 : ids.indexOf(String(id)) + 1;

    const screenReaderInstructions: ScreenReaderInstructions = {
        draggable: t(
            'host.properties.editor.photo.dragInstructions',
            'Para cambiar el orden, presioná espacio o enter para tomar la foto, usá las flechas para moverla y presioná espacio o enter otra vez para soltarla. Presioná escape para cancelar.'
        )
    };

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            t(
                'host.properties.editor.photo.dragStart',
                'Tomaste la foto {{index}}. Está en la posición {{position}} de {{total}}.',
                { index: positionOf(active.id), position: positionOf(active.id), total }
            ),
        onDragOver: ({ active, over }) =>
            over
                ? t(
                      'host.properties.editor.photo.dragOver',
                      'La foto {{index}} está en la posición {{position}} de {{total}}.',
                      { index: positionOf(active.id), position: positionOf(over.id), total }
                  )
                : undefined,
        onDragEnd: ({ active, over }) =>
            t(
                'host.properties.editor.photo.dragEnd',
                'Soltaste la foto {{index}} en la posición {{position}} de {{total}}.',
                {
                    index: positionOf(active.id),
                    position: positionOf(over?.id ?? active.id),
                    total
                }
            ),
        onDragCancel: ({ active }) =>
            t(
                'host.properties.editor.photo.dragCancel',
                'Reordenamiento cancelado. La foto {{index}} volvió a su lugar.',
                { index: positionOf(active.id) }
            )
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const fromIndex = ids.indexOf(String(active.id));
        const toIndex = ids.indexOf(String(over.id));
        if (fromIndex === -1 || toIndex === -1) return;
        onReorder(fromIndex, toIndex);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements, screenReaderInstructions }}
        >
            <SortableContext
                items={ids}
                strategy={rectSortingStrategy}
                disabled={disabled}
            >
                {items.map((item, index) => (
                    <SortablePhotoCell
                        key={getSortableId(item)}
                        sortableId={getSortableId(item)}
                        prefersReducedMotion={prefersReducedMotion}
                        locale={locale}
                        item={item}
                        position={index + 1}
                        isFirst={index === 0}
                        isLast={index === items.length - 1}
                        disabled={disabled}
                        onRemove={onRemove}
                        onPromote={onPromote}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                        onUpdateMetadata={onUpdateMetadata}
                    />
                ))}
            </SortableContext>
        </DndContext>
    );
}

interface SortablePhotoCellProps {
    readonly sortableId: string;
    /** Neighbours still move out of the way, but instantly instead of sliding. */
    readonly prefersReducedMotion: boolean;
    readonly locale: SupportedLocale;
    readonly item: AccommodationMediaItem;
    readonly position: number;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    readonly disabled: boolean;
    readonly onRemove: (item: AccommodationMediaItem) => void;
    readonly onPromote: (item: AccommodationMediaItem) => void;
    readonly onMoveUp: (item: AccommodationMediaItem) => void;
    readonly onMoveDown: (item: AccommodationMediaItem) => void;
    readonly onUpdateMetadata: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

/** One sortable gallery cell: binds `useSortable` and forwards the handle props. */
function SortablePhotoCell({
    sortableId,
    item,
    disabled,
    prefersReducedMotion,
    ...rest
}: SortablePhotoCellProps) {
    // An SSR placeholder has no DB id yet and cannot be persisted, so it
    // cannot be dragged either — same rule the buttons follow.
    const isDragDisabled = disabled || !item.id;
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: sortableId, disabled: isDragDisabled });

    const dragHandle: PhotoDragHandleProps = {
        ref: setActivatorNodeRef,
        attributes,
        listeners,
        disabled: isDragDisabled
    };

    return (
        <PhotoGalleryItem
            {...rest}
            item={item}
            disabled={disabled}
            sortableRef={setNodeRef}
            sortableId={sortableId}
            sortableStyle={{
                transform: CSS.Translate.toString(transform),
                transition: prefersReducedMotion ? undefined : transition
            }}
            isDragging={isDragging}
            dragHandle={dragHandle}
        />
    );
}
