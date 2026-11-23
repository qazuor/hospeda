/**
 * @file review-strip.ts
 * @description Maps the public reviews payload to the cards of the detail page's
 * featured-reviews strip (HOS-2530). Pure and session-blind: it only reshapes rows the
 * public `/reviews` endpoint already returned. Nothing is ever invented — a row without
 * an author-written text or a rating is skipped rather than filled in.
 */

/** Maximum number of cards the strip renders. */
export const REVIEW_STRIP_LIMIT = 6;

/** One card of the featured-reviews strip. */
export interface ReviewStripItem {
    readonly id: string;
    readonly name: string | null;
    readonly image: string | null;
    readonly rating: number | null;
    readonly content: string;
    readonly createdAt: string | null;
}

/**
 * Picks up to {@link REVIEW_STRIP_LIMIT} reviews that have text, preserving the API order.
 *
 * @param params.items - Raw review rows from the public reviews endpoint.
 * @param params.limit - Maximum cards to return (defaults to {@link REVIEW_STRIP_LIMIT}).
 * @returns The strip cards; empty when no review carries text.
 */
export function toReviewStripItems({
    items,
    limit = REVIEW_STRIP_LIMIT
}: {
    readonly items: readonly Record<string, unknown>[];
    readonly limit?: number;
}): readonly ReviewStripItem[] {
    const cards: ReviewStripItem[] = [];
    for (const item of items) {
        if (cards.length >= limit) break;
        const content = typeof item.content === 'string' ? item.content.trim() : '';
        const id = typeof item.id === 'string' ? item.id : '';
        if (!content || !id) continue;
        const user = (item.user ?? null) as { name?: unknown; image?: unknown } | null;
        cards.push({
            id,
            name: typeof user?.name === 'string' && user.name ? user.name : null,
            image: typeof user?.image === 'string' && user.image ? user.image : null,
            rating:
                typeof item.averageRating === 'number' && Number.isFinite(item.averageRating)
                    ? item.averageRating
                    : null,
            content,
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : null
        });
    }
    return cards;
}
