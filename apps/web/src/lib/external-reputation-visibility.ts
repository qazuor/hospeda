/**
 * Visibility rules for the public "Reputación en otras plataformas" section.
 *
 * Extracted from `ExternalReputation.astro` so the decision *whether to publish
 * the block at all* is a pure function with its own tests. Astro components
 * cannot be rendered under Vitest, and a test that merely greps the component's
 * source cannot tell a declared branch from a taken one — so the branch that
 * matters lives here instead.
 *
 * **Why these rules exist (H-133).** The section used to render whenever the
 * owner had configured at least one platform, regardless of whether any data
 * had ever been fetched. A visitor to a real listing saw a heading promising
 * "opiniones de viajeros verificados", a chip reading "Sin datos disponibles",
 * and — two lines below that — a note stating the review text was "temporarily"
 * unavailable and only the score was being shown, next to zero stars. Three
 * claims, all false, on a public page.
 *
 * `showReviews` means the owner is *willing* to show data. It never meant data
 * exists.
 *
 * @module lib/external-reputation-visibility
 */

import type { ExternalReputationPlatformItem } from '@repo/schemas';

/**
 * Whether a platform item carries valid Google review snippets.
 *
 * The public payload only includes snippets when their TTL is still valid
 * (`buildExternalReputationBlock` strips them otherwise), so a null/empty array
 * means "not Google", "never fetched", or "expired".
 *
 * @param input.item - The platform item to inspect.
 * @returns `true` when the item has at least one snippet to render.
 */
export function hasValidSnippets(input: { item: ExternalReputationPlatformItem }): boolean {
    const { item } = input;
    return item.platform === 'GOOGLE' && Array.isArray(item.snippets) && item.snippets.length > 0;
}

/**
 * Whether a platform item has an aggregate score to display.
 *
 * Gates the "…mostrando solo el puntaje" note: that sentence may only be shown
 * when there actually is a puntaje.
 *
 * @param input.item - The platform item to inspect.
 * @returns `true` when the item has a rating or a review count.
 */
export function hasAggregate(input: { item: ExternalReputationPlatformItem }): boolean {
    return input.item.rating != null || input.item.reviewsCount != null;
}

/**
 * Whether a platform item has anything a visitor can actually read: a score, a
 * review count, a link out to the platform, or review text.
 *
 * A link alone is enough — "Ver en Google →" is real, useful content even with
 * no score behind it. Nothing at all is not.
 *
 * @param input.item - The platform item to inspect.
 * @returns `true` when the item is worth rendering.
 */
export function hasAnythingToShow(input: { item: ExternalReputationPlatformItem }): boolean {
    const { item } = input;
    return (
        item.rating != null ||
        item.reviewsCount != null ||
        item.deepLink != null ||
        hasValidSnippets({ item })
    );
}

/**
 * Narrows the configured platform items down to the ones worth publishing.
 *
 * An empty result means the whole section must be omitted — every configured
 * platform came back empty, and a section that announces reviews it does not
 * have is worse than no section.
 *
 * @param input.items - Every platform the owner has enabled.
 * @returns Only the items that have something to show, in their original order.
 */
export function selectVisibleReputationItems(input: {
    items: readonly ExternalReputationPlatformItem[];
}): readonly ExternalReputationPlatformItem[] {
    return input.items.filter((item) => hasAnythingToShow({ item }));
}
