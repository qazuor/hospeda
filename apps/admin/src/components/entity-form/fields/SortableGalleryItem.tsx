import { Input, Label } from '@/components/ui-wrapped';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CloseIcon, GripVerticalIcon, LoaderIcon } from '@repo/icons';
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
    /** Localized label rendered above the caption input. */
    captionLabel: string;
    /** Placeholder for the caption input. */
    captionPlaceholder: string;
    /** Localized label rendered above the alt-text input (asterisk added inline). */
    altLabel: string;
    /** Placeholder for the alt-text input. */
    altPlaceholder: string;
    /** Localized label rendered above the description input. */
    descriptionLabel: string;
    /** Placeholder for the description input. */
    descriptionPlaceholder: string;
    /** Inline hint shown under the alt-text input when empty (a11y nudge). */
    altRequiredHint: string;
    /** Accessible label for the drag handle button. */
    dragHandleLabel: string;
    /** Accessible label for the delete button. */
    deleteLabel: string;
    /** Accessible label for the lightbox trigger (open image in full size). */
    lightboxLabel: string;
    /** Remove handler. */
    onRemove: (imageId: string, imageUrl: string) => void;
    /** Update handler for caption/alt/description fields. */
    onUpdate: (imageId: string, updates: Partial<GalleryImage>) => void;
}

/**
 * Single sortable gallery item rendered inside a DndContext/SortableContext.
 *
 * Uses `useSortable` to provide pointer and keyboard drag-and-drop with built-in
 * a11y. The drag handle is the only element wired with dnd-kit attributes so the
 * delete button, lightbox trigger, and metadata inputs remain independently
 * focusable/usable. Clicking the image opens a lightbox dialog with the
 * full-resolution asset.
 */
export const SortableGalleryItem = ({
    image,
    index,
    sortable,
    disabled,
    isBusy,
    reducedMotion,
    imageAltFallback,
    captionLabel,
    captionPlaceholder,
    altLabel,
    altPlaceholder,
    descriptionLabel,
    descriptionPlaceholder,
    altRequiredHint,
    dragHandleLabel,
    deleteLabel,
    lightboxLabel,
    onRemove,
    onUpdate
}: SortableGalleryItemProps) => {
    const altMissing = !image.alt || image.alt.trim() === '';
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
        useSortable({ id: image.id, disabled: !sortable || disabled || isBusy });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        // Respect prefers-reduced-motion — disable transition entirely when opted out.
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.8 : undefined
    };

    const altText = image.alt || imageAltFallback;
    const thumbnailUrl = getMediaUrl(image.url, { preset: 'thumbnail' });

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'overflow-hidden rounded-lg border',
                isBusy && 'opacity-70',
                isDragging && 'ring-2 ring-primary ring-offset-2',
                isSorting && !isDragging && 'pointer-events-auto'
            )}
        >
            {/* Preview + action overlay. The image acts as the lightbox trigger;
                drag handle (top-left) and delete (top-right) sit on a hover overlay
                styled to match the featured-image controls — backdrop blur + shadow,
                visible only on hover/focus. */}
            <div className="group relative bg-muted">
                <Dialog>
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            aria-label={`${lightboxLabel} ${index + 1}`}
                            className="block w-full cursor-zoom-in"
                        >
                            <img
                                src={thumbnailUrl}
                                alt={altText}
                                loading="lazy"
                                decoding="async"
                                className="block aspect-[4/3] w-full object-cover"
                            />
                        </button>
                    </DialogTrigger>
                    <DialogContent
                        className="max-w-[min(96vw,1400px)] border-0 bg-transparent p-0 shadow-none"
                        showCloseButton={false}
                    >
                        <DialogTitle className="sr-only">{altText}</DialogTitle>
                        <img
                            src={image.url}
                            alt={altText}
                            className="block max-h-[90vh] w-full rounded-md object-contain"
                        />
                    </DialogContent>
                </Dialog>

                {isBusy && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                        <LoaderIcon className="h-6 w-6 animate-spin text-white" />
                    </div>
                )}

                {!isBusy && (
                    <>
                        {sortable && (
                            <button
                                type="button"
                                {...attributes}
                                {...listeners}
                                data-testid={`gallery-drag-handle-${index}`}
                                aria-label={`${dragHandleLabel} ${index + 1}`}
                                title={`${dragHandleLabel} ${index + 1}`}
                                className={cn(
                                    'absolute top-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-md',
                                    'bg-card/90 text-foreground shadow-sm backdrop-blur',
                                    'opacity-0 transition-opacity duration-150',
                                    'group-focus-within:opacity-100 group-hover:opacity-100',
                                    'hover:bg-card focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    'cursor-grab active:cursor-grabbing',
                                    (disabled || isBusy) && 'cursor-not-allowed opacity-50'
                                )}
                                disabled={disabled || isBusy}
                            >
                                <GripVerticalIcon className="h-4 w-4" />
                            </button>
                        )}

                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => onRemove(image.id, image.url)}
                                aria-label={`${deleteLabel} ${index + 1}`}
                                title={`${deleteLabel} ${index + 1}`}
                                className={cn(
                                    'absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md',
                                    'bg-card/90 text-destructive shadow-sm backdrop-blur',
                                    'opacity-0 transition-opacity duration-150',
                                    'group-focus-within:opacity-100 group-hover:opacity-100',
                                    'hover:bg-destructive hover:text-destructive-foreground',
                                    'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive'
                                )}
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="space-y-2 p-2.5">
                <div>
                    <Label
                        htmlFor={`gallery-${image.id}-caption`}
                        className="text-[10px] text-muted-foreground uppercase tracking-wide"
                    >
                        {captionLabel}
                    </Label>
                    <Input
                        id={`gallery-${image.id}-caption`}
                        value={image.caption || ''}
                        onChange={(e) => onUpdate(image.id, { caption: e.target.value })}
                        placeholder={captionPlaceholder}
                        disabled={disabled || isBusy}
                        className="h-7 text-xs"
                    />
                </div>

                <div>
                    <Label
                        htmlFor={`gallery-${image.id}-alt`}
                        className="text-[10px] text-muted-foreground uppercase tracking-wide"
                    >
                        {altLabel}{' '}
                        <span
                            aria-hidden="true"
                            className="text-destructive"
                        >
                            *
                        </span>
                    </Label>
                    <Input
                        id={`gallery-${image.id}-alt`}
                        value={image.alt || ''}
                        onChange={(e) => onUpdate(image.id, { alt: e.target.value })}
                        placeholder={altPlaceholder}
                        aria-required="true"
                        aria-invalid={altMissing}
                        disabled={disabled || isBusy}
                        className={cn(
                            'h-7 text-xs',
                            altMissing && 'border-warning focus-visible:ring-warning'
                        )}
                    />
                    {altMissing && !disabled && (
                        <p className="mt-0.5 text-warning text-xs">{altRequiredHint}</p>
                    )}
                </div>

                <div>
                    <Label
                        htmlFor={`gallery-${image.id}-description`}
                        className="text-[10px] text-muted-foreground uppercase tracking-wide"
                    >
                        {descriptionLabel}
                    </Label>
                    <Input
                        id={`gallery-${image.id}-description`}
                        value={image.description || ''}
                        onChange={(e) => onUpdate(image.id, { description: e.target.value })}
                        placeholder={descriptionPlaceholder}
                        disabled={disabled || isBusy}
                        className="h-7 text-xs"
                    />
                </div>
            </div>
        </div>
    );
};
