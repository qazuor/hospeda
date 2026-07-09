/**
 * @file thin-destination.ts
 * @description Single source of truth for the "thin / empty destination"
 * predicate. A destination with no accommodations, events, or attractions is
 * thin content: indexing it (and listing it in the sitemap) hurts site quality,
 * so both the destination detail page and the dynamic sitemap must exclude it
 * using THIS predicate — never an ad-hoc inline check that could drift apart.
 *
 * HOS-117 T-006 (US-3).
 */

/**
 * The minimal count shape needed to decide emptiness. Each field is tolerated as
 * `undefined`/`null` (treated as 0) so the same predicate works from both the
 * destination detail page (`stats.*Count`, always numbers) and the sitemap
 * (the public destination object, where `eventsCount` is nullable).
 */
export interface DestinationCounts {
    readonly accommodationsCount?: number | null;
    readonly attractionsCount?: number | null;
    readonly eventsCount?: number | null;
}

/**
 * Decide whether a destination is thin/empty (no accommodations, events, or
 * attractions) and therefore must be `noindex`ed and excluded from the sitemap.
 *
 * @param counts - {@link DestinationCounts} from whichever source the caller has.
 * @returns `true` when every count is 0/absent, `false` if any is > 0.
 *
 * @example
 * isThinDestination({ accommodationsCount: 0, attractionsCount: 0, eventsCount: 0 }); // true
 * isThinDestination({ accommodationsCount: 3 }); // false
 * isThinDestination({ eventsCount: null, attractionsCount: 1 }); // false
 */
export function isThinDestination(counts: DestinationCounts): boolean {
    const accommodations = counts.accommodationsCount ?? 0;
    const attractions = counts.attractionsCount ?? 0;
    const events = counts.eventsCount ?? 0;
    return accommodations === 0 && attractions === 0 && events === 0;
}
