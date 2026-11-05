/**
 * @file review-dimensions-view.ts
 * @description Pure projections for venue review dimensions (HOS-1866 / 6.6,
 * AC:6:10). Every decision is read from `REVIEW_RULES[vertical]`; nothing
 * compares a dimension/section id, listing type or vertical to a literal
 * (G-FAC-05) and nothing reads business lines (G-FAC-03). The server remains
 * the authority: it removes dimensions bound to an `absent` section from the
 * aggregate (DEC-FAC-072) and rejects votes for them.
 */

import {
    type ListingVertical,
    REVIEW_RULES,
    type ReviewDimensionId,
    type ReviewRules
} from '@repo/schemas';

/** A bound section's public state: `locked` is published as `available`. */
export type PublicReviewSectionState = 'absent' | 'available';

/** Public state of only the sections a review dimension is bound to. */
export type PublicReviewSectionStates = Readonly<
    Record<string, { readonly state: PublicReviewSectionState }>
>;

/** One dimension's public aggregate. A missing key means zero votes. */
export interface PublicDimensionRating {
    readonly average: number;
    readonly count: number;
}
/** Public per-dimension aggregates keyed by dimension id. */
export type PublicDimensionRatings = Readonly<Record<string, PublicDimensionRating>>;

/** A dimension the review form may offer, as declared by the catalog. */
export interface OfferedReviewDimension {
    readonly id: ReviewDimensionId<ListingVertical>;
    readonly labelKey: string;
}
/** A dimension with at least one vote, ready to render. */
export interface ResolvedDimensionAverage extends OfferedReviewDimension {
    readonly average: number;
    readonly count: number;
}

/** Reads the vertical's rules without assuming every vertical declares any. */
function reviewRulesFor(vertical: ListingVertical): ReviewRules | undefined {
    return (REVIEW_RULES as Partial<Record<ListingVertical, ReviewRules>>)[vertical];
}

/**
 * Dimensions the form may offer, in catalog order.
 *
 * Unbound dimensions are always offered. A bound one is offered unless its
 * section is `absent`; with no map (an older cached payload, an API failure)
 * every dimension is offered and the server rejects an inapplicable vote.
 *
 * @param args.vertical - The listing vertical.
 * @param args.sectionStates - The public bound-section map, or `undefined`.
 * @returns The offered dimensions in catalog order.
 */
export function resolveOfferedReviewDimensions({
    vertical,
    sectionStates
}: {
    readonly vertical: ListingVertical;
    readonly sectionStates?: PublicReviewSectionStates;
}): readonly OfferedReviewDimension[] {
    const rules = reviewRulesFor(vertical);
    if (!rules) return [];
    return rules.dimensions
        .filter((dimension) => {
            if (sectionStates === undefined) return true;
            if (!('boundSection' in dimension)) return true;
            return sectionStates[dimension.boundSection]?.state !== 'absent';
        })
        .map((dimension) => ({ id: dimension.id, labelKey: dimension.labelKey }));
}

/**
 * Dimensions with at least one vote, in catalog order. The aggregate already
 * excludes dimensions bound to an `absent` section (DEC-FAC-072), so this does
 * not re-filter by section; a missing key means zero votes and is skipped.
 *
 * @param args.vertical - The listing vertical.
 * @param args.rating - The public aggregate, of unknown shape.
 * @returns The voted dimensions in catalog order.
 */
export function resolveDimensionAverages({
    vertical,
    rating
}: {
    readonly vertical: ListingVertical;
    readonly rating?: unknown;
}): readonly ResolvedDimensionAverage[] {
    const rules = reviewRulesFor(vertical);
    if (!rules) return [];
    const parsed = parsePublicDimensionRatings(rating);
    if (!parsed) return [];
    const resolved: ResolvedDimensionAverage[] = [];
    for (const dimension of rules.dimensions) {
        const entry = parsed[dimension.id];
        if (!entry || entry.count < 1) continue;
        resolved.push({
            id: dimension.id,
            labelKey: dimension.labelKey,
            average: entry.average,
            count: entry.count
        });
    }
    return resolved;
}

/**
 * Defensively parses `reviewSectionStates`, dropping invalid states.
 *
 * @param raw - Raw payload value, of unknown shape.
 * @returns The valid entries, or `undefined` when none survive.
 */
export function parsePublicReviewSectionStates(
    raw: unknown
): PublicReviewSectionStates | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const parsed: Record<string, { readonly state: PublicReviewSectionState }> = {};
    for (const [sectionId, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const state = (value as Record<string, unknown>).state;
        if (state !== 'absent' && state !== 'available') continue;
        parsed[sectionId] = { state };
    }
    return Object.keys(parsed).length > 0 ? parsed : undefined;
}

/**
 * Defensively parses `rating`, keeping only finite averages and valid counts.
 *
 * @param raw - Raw payload value, of unknown shape.
 * @returns The valid entries, or `undefined` when none survive.
 */
export function parsePublicDimensionRatings(raw: unknown): PublicDimensionRatings | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const parsed: Record<string, PublicDimensionRating> = {};
    for (const [dimensionId, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const { average, count } = value as Record<string, unknown>;
        if (typeof average !== 'number' || !Number.isFinite(average)) continue;
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) continue;
        parsed[dimensionId] = { average, count };
    }
    return Object.keys(parsed).length > 0 ? parsed : undefined;
}
