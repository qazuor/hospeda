import { Button, Input } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DeleteIcon, GripVerticalIcon, LoaderIcon } from '@repo/icons';
import { getMediaUrl } from '@repo/media';
import type * as React from 'react';
import type { GalleryImage } from './gallery-types';

/**
 * Props for SortableGalleryItem — internal sub-component for GalleryField.
 */
export interface SortableGalleryItemProps {
    /** The gallery image being rendered. */
    image: GalleryImage;
    /** Zero-based index within the sorted gallery. */
    index: number;
    /** Whether the gallery allows reordering. */
    sortable: boolean;
    /** Whether the field is globally disabled. */
    disabled: boolean;
    /** Whether this specific item is uploading or deleting. */
    isBusy: boolean;
    /** When true, disable CSS transitions for drag (prefers-reduced-motion). */
    reducedMotion: boolean;
    /** Optional max width in px, forwarded to the image element. */
    maxWidth?: number;
    /** Optional max height in px, forwarded to the image element. */
    maxHeight?: number;
    /** Fallback alt text when the image has none. */
    imageAltFallback: string;
    /** Placeholder for the caption input. */
    captionPlaceholder: string;
    /** Placeholder for the alt-text input. */
    altPlaceholder: string;
    /** Accessible label for the drag handle button. */
    dragHandleLabel: string;
    /** Accessible label for the delete button. */
    deleteLabel: string;
    /** Remove handler. */
    onRemove: (imageId: string, imageUrl: string) => void;
    /** Update handler for caption/alt fields. */
    onUpdate: (imageId: string, updates: Partial<GalleryImage>) => void;
}

/**
 * Single sortable gallery item rendered inside a DndContext/SortableContext.
 *
 * Uses `useSortable` to provide pointer and keyboard drag-and-drop with built-in
 * a11y. The drag handle is the only element wired with dnd-kit attributes so the
 * delete button and metadata inputs remain independently focusable/usable.
 */
export const SortableGalleryItem = ({
    image,
    index,
    sortable,
    disabled,
    isBusy,
    reducedMotion,
    maxWidth,
    maxHeight,
    imageAltFallback,
    captionPlaceholder,
    altPlaceholder,
    dragHandleLabel,
    deleteLabel,
    onRemove,
    onUpdate
}: SortableGalleryItemProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
        useSortable({ id: image.id, disabled: !sortable || disabled || isBusy });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        // Respect prefers-reduced-motion — disable transition entirely when opted out.
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.8 : undefined
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group relative overflow-hidden rounded-lg border',
                isBusy && 'opacity-70',
                isDragging && 'ring-2 ring-primary ring-offset-2',
                isSorting && !isDragging && 'pointer-events-auto'
            )}
        >
            <img
                src={getMediaUrl(image.url, { preset: 'thumbnail' })}
                alt={image.alt || imageAltFallback}
                loading="lazy"
                decoding="async"
                className={cn(
                    'h-32 w-full object-cover',
                    maxWidth && `max-w-[${maxWidth}px]`,
                    maxHeight && `max-h-[${maxHeight}px]`
                )}
            />

            {isBusy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <LoaderIcon className="h-6 w-6 animate-spin text-white" />
                </div>
            )}

            {!isBusy && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    {sortable && (
                        <button
                            type="button"
                            {...attributes}
                            {...listeners}
                            data-testid={`gallery-drag-handle-${index}`}
                            aria-label={`${dragHandleLabel} ${index + 1}`}
                            className={cn(
                                'absolute top-2 left-2 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing',
                                (disabled || isBusy) && 'cursor-not-allowed opacity-50'
                            )}
                            disabled={disabled || isBusy}
                        >
                            <GripVerticalIcon className="h-4 w-4" />
                        </button>
                    )}

                    {!disabled && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => onRemove(image.id, image.url)}
                            className="absolute top-2 right-2"
                            aria-label={`${deleteLabel} ${index + 1}`}
                        >
                            <DeleteIcon className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}

            <div className="space-y-1 p-2">
                <Input
                    value={image.caption || ''}
                    onChange={(e) => onUpdate(image.id, { caption: e.target.value })}
                    placeholder={captionPlaceholder}
                    disabled={disabled || isBusy}
                    className="h-7 text-xs"
                />
                <Input
                    value={image.alt || ''}
                    onChange={(e) => onUpdate(image.id, { alt: e.target.value })}
                    placeholder={altPlaceholder}
                    disabled={disabled || isBusy}
                    className="h-7 text-xs"
                />
            </div>
        </div>
    );
};
