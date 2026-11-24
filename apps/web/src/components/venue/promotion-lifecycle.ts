/**
 * @file promotion-lifecycle.ts
 * @description Pure helpers of the venue promotions manager (HOS-2504): the
 * client-clock lifecycle label state and the API date conversions.
 */

import type { VenuePromotionListOutput } from '@repo/schemas';

/** One promotion as the owner list returns it. */
export type PromotionRow = VenuePromotionListOutput['items'][number];

/** Display state of a promotion, once the client clock is known. */
export type PromotionLifecycleState = 'expired' | 'active' | 'draft' | 'paused';

/** Returns a timestamp for a serialized or parsed API date. */
export function toTimestamp(value: Date | string): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Converts a serialized or parsed API date to the native date input format. */
export function toDateInputValue(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/**
 * Lifecycle status waits for a client clock so SSR cannot guess active/expired.
 *
 * @param item - The promotion.
 * @param now - Client timestamp, or `null` before the first client render.
 * @returns The display state, or `null` while the clock is unknown.
 */
export function resolvePromotionLifecycleState(
    item: PromotionRow,
    now: number | null
): PromotionLifecycleState | null {
    if (now === null) return null;
    const isExpired =
        item.lifecycleState === 'ACTIVE' &&
        item.validUntil != null &&
        toTimestamp(item.validUntil) < now;
    return isExpired
        ? 'expired'
        : item.lifecycleState === 'ACTIVE'
          ? 'active'
          : item.lifecycleState === 'DRAFT'
            ? 'draft'
            : 'paused';
}

/** Promotion-domain status (`status-tone.ts`) of a display state. */
export const PROMOTION_STATUS_BY_STATE: Readonly<Record<PromotionLifecycleState, string>> = {
    active: 'ACTIVE',
    draft: 'DRAFT',
    paused: 'PAUSED',
    expired: 'EXPIRED'
};
