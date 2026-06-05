/**
 * compare-version — pure tour version comparison utility.
 *
 * Determines whether a tour should be offered to the user based on the
 * stored seen version versus the current config version. This is the single
 * source of truth for the "should auto-trigger this tour?" version check
 * (SPEC-174 §7.3, §10, D9).
 *
 * Versioning semantics:
 * - `seenVersion === null | undefined` → never seen → offer.
 * - `configVersion > seenVersion` → config was bumped → re-offer.
 * - `configVersion <= seenVersion` → already seen at this version → skip.
 *
 * This function is intentionally pure (no React, no DOM, no side effects)
 * so it can be unit-tested exhaustively without mounting any component.
 *
 * @module lib/tour/compare-version
 * @see apps/admin/src/lib/tour/decide-auto-trigger.ts — consumer
 * @see SPEC-174 §7.3, §10, D9
 */

// ============================================================================
// Input / output types
// ============================================================================

/**
 * Input for {@link shouldOfferTour}.
 */
export interface ShouldOfferTourInput {
    /**
     * The current version declared in the tour config entry.
     * Must be a positive integer (≥ 1).
     */
    readonly configVersion: number;
    /**
     * The version the user last acknowledged, stored in
     * `UserSettings.onboarding.adminTours[tourId]`.
     *
     * `null` or `undefined` means the user has never seen this tour.
     * `0` is treated the same as null (never seen — the default for a
     * brand-new user whose settings have no `adminTours` entry).
     */
    readonly seenVersion: number | null | undefined;
}

// ============================================================================
// Exported function
// ============================================================================

/**
 * Returns `true` when the auto-trigger should offer this tour to the user.
 *
 * Decision table:
 *
 * | seenVersion          | configVersion | Result  |
 * |----------------------|---------------|---------|
 * | null / undefined / 0 | any           | `true`  |
 * | 1                    | 1             | `false` |
 * | 1                    | 2             | `true`  |
 * | 2                    | 1             | `false` |
 * | 3                    | 3             | `false` |
 *
 * @param input - `{ configVersion, seenVersion }`.
 * @returns `true` iff the tour should be offered.
 *
 * @example
 * ```ts
 * shouldOfferTour({ configVersion: 1, seenVersion: null });   // true
 * shouldOfferTour({ configVersion: 1, seenVersion: 1 });      // false
 * shouldOfferTour({ configVersion: 2, seenVersion: 1 });      // true
 * shouldOfferTour({ configVersion: 1, seenVersion: 2 });      // false
 * ```
 */
export function shouldOfferTour({ configVersion, seenVersion }: ShouldOfferTourInput): boolean {
    if (seenVersion === null || seenVersion === undefined || seenVersion === 0) {
        return true;
    }
    return configVersion > seenVersion;
}
