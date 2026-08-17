/**
 * GalleryGridItem
 *
 * One photo tile in the admin gallery grid, extracted from `GalleryManager`
 * (HOS-389 §1) for the same reason `GalleryPortadaSection` was: adding the
 * make-cover action pushed that file past the project's 500-line limit.
 *
 * Purely presentational — every mutation lives in the parent and arrives as a
 * handler, so this file holds no query state and duplicates no logic.
 *
 * The three actions are `opacity-0 group-hover:opacity-100 focus:opacity-100`,
 * matching the existing tile. The `focus:` half is what keeps them reachable by
 * keyboard: a hover-only control is invisible to anyone tabbing through.
 */

import { EditIcon, LoaderIcon, StarIcon, XCircleIcon } from '@repo/icons';
import type { AccommodationMedia } from '@repo/schemas';
import type { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for GalleryGridItem. */
export interface GalleryGridItemProps {
    /** Translation function, forwarded by the parent so every key stays identical. */
    readonly t: ReturnType<typeof useTranslations>['t'];
    /** The photo this tile renders. */
    readonly item: AccommodationMedia;
    /** True while ANY gallery mutation is in flight — disables the actions. */
    readonly anyMutationPending: boolean;
    /** True while the active set-featured mutation targets THIS tile. */
    readonly isPromoting: boolean;
    /** True while the active remove mutation targets THIS tile. */
    readonly isRemoving: boolean;
    /** Promotes this photo to the portada slot. */
    readonly onMakeCover: () => void;
    /** Opens the text editor for this photo. */
    readonly onEditText: () => void;
    /** Removes this photo from the gallery. */
    readonly onRemove: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single gallery tile with its make-cover, edit-text and remove actions.
 */
export function GalleryGridItem({
    t,
    item,
    anyMutationPending,
    isPromoting,
    isRemoving,
    onMakeCover,
    onEditText,
    onRemove
}: GalleryGridItemProps) {
    return (
        <div className="group relative aspect-square">
            <img
                src={item.url}
                // Falls back to `''` rather than a literal, unlike the portada:
                // an empty alt marks the image decorative, which is the honest
                // answer when the row carries no text at all.
                alt={item.alt ?? item.caption ?? ''}
                className="h-full w-full rounded-lg border object-cover"
            />

            <button
                type="button"
                onClick={onMakeCover}
                disabled={anyMutationPending}
                aria-label={t('admin-pages.gallery.grid.actions.makeCover')}
                className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground opacity-0 shadow transition-opacity focus:opacity-100 disabled:opacity-50 group-hover:opacity-100"
            >
                {isPromoting ? (
                    <LoaderIcon className="h-3 w-3 animate-spin" />
                ) : (
                    <StarIcon className="h-3 w-3" />
                )}
            </button>

            <button
                type="button"
                onClick={onEditText}
                aria-label={t('admin-pages.gallery.photoText.actions.edit')}
                className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground opacity-0 shadow transition-opacity focus:opacity-100 group-hover:opacity-100"
            >
                <EditIcon className="h-3 w-3" />
            </button>

            <button
                type="button"
                onClick={onRemove}
                disabled={anyMutationPending}
                aria-label={t('admin-pages.gallery.grid.actions.remove')}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity focus:opacity-100 disabled:opacity-50 group-hover:opacity-100"
            >
                {isRemoving ? (
                    <LoaderIcon className="h-3 w-3 animate-spin" />
                ) : (
                    <XCircleIcon className="h-3 w-3" />
                )}
            </button>
        </div>
    );
}
