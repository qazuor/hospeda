/**
 * CommerceGalleryGridItem
 *
 * One photo tile in the commerce gallery grid, extracted from
 * `CommerceGalleryManager` (HOS-389 §1) for the same reason its accommodation
 * twin `GalleryGridItem` was: adding the make-cover action pushed that file
 * against the project's 500-line limit.
 *
 * Purely presentational — every mutation lives in the parent and arrives as a
 * handler, so this file holds no query state and duplicates no logic.
 *
 * It carries two actions where the accommodation tile carries three: commerce
 * listings have no per-photo text editor (that arrived with HOS-388 on the
 * accommodation side only), so there is no edit button to forward.
 *
 * Both actions are `opacity-0 group-hover:opacity-100 focus:opacity-100`,
 * matching the existing tile. The `focus:` half is what keeps them reachable by
 * keyboard: a hover-only control is invisible to anyone tabbing through.
 */

import { LoaderIcon, StarIcon, XCircleIcon } from '@repo/icons';
import type { CommerceMedia } from '@/features/commerce/hooks/useCommerceMedia';
import type { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for CommerceGalleryGridItem. */
export interface CommerceGalleryGridItemProps {
    /** Translation function, forwarded by the parent so every key stays identical. */
    readonly t: ReturnType<typeof useTranslations>['t'];
    /** The photo this tile renders. */
    readonly item: CommerceMedia;
    /** True while ANY gallery mutation is in flight — disables the actions. */
    readonly anyMutationPending: boolean;
    /** True while the active set-featured mutation targets THIS tile. */
    readonly isPromoting: boolean;
    /** True while the active remove mutation targets THIS tile. */
    readonly isRemoving: boolean;
    /** Promotes this photo to the portada slot. */
    readonly onMakeCover: () => void;
    /** Removes this photo from the gallery. */
    readonly onRemove: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single commerce gallery tile with its make-cover and remove actions.
 */
export function CommerceGalleryGridItem({
    t,
    item,
    anyMutationPending,
    isPromoting,
    isRemoving,
    onMakeCover,
    onRemove
}: CommerceGalleryGridItemProps) {
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
