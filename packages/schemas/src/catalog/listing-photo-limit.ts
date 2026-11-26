import { LimitKeyEnum } from './key-enums.js';
import type { ListingVertical } from './listing-catalog.base-types.js';
import { isUnlimitedLimit } from './unlimited-limit.js';

/** The effective-set photo limit key for each listing vertical. */
export const LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL = {
    accommodation: LimitKeyEnum.MAX_PHOTOS_PER_ACCOMMODATION,
    venue: LimitKeyEnum.MAX_PHOTOS_PER_VENUE,
    experience: LimitKeyEnum.MAX_PHOTOS_PER_EXPERIENCE
} as const satisfies Record<ListingVertical, LimitKeyEnum>;

/**
 * Splits a gallery at its effective cap without changing the input or its order.
 *
 * @param input.items - Already ordered, approved, visible gallery photos; excludes the cover.
 * @param input.cap - Nonnegative effective cap, or `null` for unlimited. Raw catalog unlimited values are also accepted.
 * @returns The photos within the cap and the photos beyond it, both in input order.
 */
export function partitionGalleryByCap<T>({
    items,
    cap
}: {
    readonly items: readonly T[];
    readonly cap: number | null;
}): { shown: T[]; hidden: T[] } {
    if (cap === null || isUnlimitedLimit({ value: cap })) {
        return { shown: items.slice(), hidden: [] };
    }

    return { shown: items.slice(0, cap), hidden: items.slice(cap) };
}
