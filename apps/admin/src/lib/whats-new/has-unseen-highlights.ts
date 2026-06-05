/**
 * hasUnseenHighlights — pure predicate for unseen highlight entries.
 *
 * Determines whether a list of What's New items contains at least one entry
 * that is both `highlight: true` and `seen: false`. Used by
 * `WhatsNewAutoTrigger` to decide whether the auto-modal should open, and by
 * tests to verify the predicate independently of any React context.
 *
 * Pure function — no React, no DOM, no side effects.
 *
 * @module has-unseen-highlights
 * @see apps/admin/src/hooks/use-whats-new.ts — consumes this helper
 * @see SPEC-175 §7.7
 */

import type { WhatsNewItem } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/** Input shape for {@link hasUnseenHighlights}. */
export interface HasUnseenHighlightsInput {
    /** Role-filtered list of items returned by `GET /api/v1/protected/whats-new`. */
    readonly items: readonly WhatsNewItem[];
}

// ---------------------------------------------------------------------------
// Exported function
// ---------------------------------------------------------------------------

/**
 * Returns `true` if any item in the list is both `highlight: true` and
 * `seen: false`.
 *
 * Returns `false` for an empty list, a list with no highlight entries, or a
 * list where all highlight entries have already been seen.
 *
 * @param input - Object containing the `items` array to check.
 * @returns `true` when at least one unseen highlight entry exists.
 *
 * @example
 * ```ts
 * hasUnseenHighlights({ items: [] });
 * // false
 *
 * hasUnseenHighlights({
 *   items: [{ id: '1', highlight: true, seen: false, ... }]
 * });
 * // true
 *
 * hasUnseenHighlights({
 *   items: [{ id: '1', highlight: true, seen: true, ... }]
 * });
 * // false
 * ```
 */
export function hasUnseenHighlights({ items }: HasUnseenHighlightsInput): boolean {
    return items.some((item) => item.highlight && !item.seen);
}
