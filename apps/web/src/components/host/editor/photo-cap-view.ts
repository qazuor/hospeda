/**
 * @file photo-cap-view.ts
 * @description Pure rules of the shared photo editor's cap (HOS-2495): what the
 * description says, whether uploads are open, and which gallery tiles the
 * public does not show.
 *
 * Every number comes from the listing's `photo-allowance` read, which reports
 * exactly the cap step 7 enforces. Nothing here recomputes a plan limit, and
 * there is no "non-positive means not loaded yet" heuristic any more: a cap of
 * 0 is a real answer (`NONE`), and unlimited is its own state.
 */

import { type ListingPhotoAllowance, partitionGalleryByCap } from '@repo/schemas';
import type { AccommodationMediaItem } from '@/lib/api/types';

/**
 * Placeholder gallery cap for every state without a finite cap (loading,
 * failed, unlimited). Large enough that `galleryItems.length >= cap` is never
 * true, so the gallery is never reported "full" without a real number. The
 * upload controls are gated by {@link isGalleryUploadOpen}, not by this value.
 */
export const GALLERY_CAP_PENDING_PLACEHOLDER = Number.MAX_SAFE_INTEGER;

/** The five states of the editor's cap line. */
export type GalleryCapView =
    | { readonly kind: 'loading'; readonly cap: null }
    | { readonly kind: 'failed'; readonly cap: null }
    | { readonly kind: 'unlimited'; readonly cap: null }
    | { readonly kind: 'none'; readonly cap: 0 }
    | { readonly kind: 'limited'; readonly cap: number };

/**
 * Resolve the cap view from the allowance read.
 *
 * @param input.allowance - The last allowance answer, or `null` before the first one.
 * @param input.isLoading - Whether the first read is still in flight.
 * @param input.failed - Whether the last read failed.
 * @returns The state the description, the label and the upload controls follow.
 */
export function resolveGalleryCapView({
    allowance,
    isLoading,
    failed
}: {
    readonly allowance: ListingPhotoAllowance | null;
    readonly isLoading: boolean;
    readonly failed: boolean;
}): GalleryCapView {
    if (failed) return { kind: 'failed', cap: null };
    if (isLoading || allowance === null) return { kind: 'loading', cap: null };
    if (allowance.status === 'UNLIMITED') return { kind: 'unlimited', cap: null };
    if (allowance.status === 'NONE') return { kind: 'none', cap: 0 };
    return { kind: 'limited', cap: allowance.cap };
}

/**
 * The cap `usePhotoSection` counts gallery slots against.
 *
 * @param view - The resolved cap view.
 * @returns The finite cap, or {@link GALLERY_CAP_PENDING_PLACEHOLDER} when there is none.
 */
export function galleryCapOf(view: GalleryCapView): number {
    return view.kind === 'limited' ? view.cap : GALLERY_CAP_PENDING_PLACEHOLDER;
}

/**
 * Whether a gallery upload may start: the cap is known and grants photos.
 *
 * @param view - The resolved cap view.
 * @returns `true` for `limited` and `unlimited`.
 */
export function isGalleryUploadOpen(view: GalleryCapView): boolean {
    return view.kind === 'limited' || view.kind === 'unlimited';
}

/**
 * Whether a photo takes a public gallery slot. Only approved photos are public;
 * a PENDING or REJECTED row keeps its moderation badge and is never marked over
 * cap. An SSR placeholder carries no state and is treated as approved.
 *
 * @param item - A gallery item.
 * @returns Whether the public gallery would list it.
 */
function isPubliclyListed(item: AccommodationMediaItem): boolean {
    return item.moderationState === undefined || item.moderationState === 'APPROVED';
}

/**
 * The gallery tiles the public does not show, with the same rule the public
 * projector applies (`partitionGalleryByCap` over the approved gallery in
 * display order). Unknown and unlimited caps hide nothing.
 *
 * @param input.items - Gallery items in display order (the cover excluded).
 * @param input.view - The resolved cap view.
 * @returns The ids of the over-cap tiles.
 */
export function resolveOverCapIds({
    items,
    view
}: {
    readonly items: readonly AccommodationMediaItem[];
    readonly view: GalleryCapView;
}): ReadonlySet<string> {
    if (view.kind !== 'limited' && view.kind !== 'none') return new Set();
    const { hidden } = partitionGalleryByCap({
        items: items.filter(isPubliclyListed),
        cap: view.cap
    });
    return new Set(hidden.map((item) => item.id || item.url));
}
