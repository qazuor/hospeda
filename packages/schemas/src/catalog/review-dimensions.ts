import { z } from 'zod';
import { ExperienceRatingSchema } from '../common/experience-rating.schema.js';
import type { ListingVertical } from './listing-catalog.base-types.js';
import type { ListingSectionId } from './listing-catalog.ids.js';

/** Listing-section availability states shared with review validation. */
export type ListingSectionState = 'absent' | 'locked' | 'available';

/** Review-dimension ids derived from the vertical's declared rules. */
export type ReviewDimensionId<V extends ListingVertical> =
    V extends keyof typeof REVIEW_RULES_CONTENT
        ? (typeof REVIEW_RULES_CONTENT)[V] extends { readonly dimensions: readonly (infer D)[] }
            ? D extends { readonly id: infer I }
                ? I
                : never
            : never
        : never;

/** One review dimension a vertical lets reviewers score (DEC-FAC-065). */
export interface ReviewDimensionDefinition<V extends ListingVertical = ListingVertical> {
    /** Dimension id, unique within the vertical. */
    readonly id: ReviewDimensionId<V>;
    /** i18n key of the visible label (must exist in es/en/pt, G-FAC-02 rule 12). */
    readonly labelKey: string;
    /**
     * Non-common section the dimension depends on: it is offered only while that
     * section is not `absent` on the listing. Unbound dimensions are always offered.
     */
    readonly boundSection?: ListingSectionId<V>;
}

/**
 * Review rules of a vertical whose reviews the shared listing base recalculates
 * (today venue and experience, DEC-FAC-073).
 */
export interface ReviewRules<V extends ListingVertical = ListingVertical> {
    /** Owning vertical. */
    readonly vertical: V;
    /** Dimensions offered to reviewers, in display order. */
    readonly dimensions: readonly ReviewDimensionDefinition<V>[];
    /**
     * `votedOnly`: each dimension is optional and averaged over the reviews that
     * voted it. `legacyNullAsZero`: today's experience calculation, unchanged
     * (null counted as 0 across the four dimensions).
     */
    readonly dimensionAveraging: 'votedOnly' | 'legacyNullAsZero';
}

/** Review dimensions and averaging policy declared by listing vertical. */
const REVIEW_RULES_CONTENT = {
    venue: {
        vertical: 'venue',
        dimensions: [
            { id: 'food', labelKey: 'review.dimensions.food', boundSection: 'menu' },
            { id: 'service', labelKey: 'review.dimensions.service' },
            { id: 'ambiance', labelKey: 'review.dimensions.ambiance' },
            { id: 'value', labelKey: 'review.dimensions.value' }
        ],
        dimensionAveraging: 'votedOnly'
    },
    experience: {
        vertical: 'experience',
        dimensions: [
            { id: 'food', labelKey: 'review.dimensions.food' },
            { id: 'service', labelKey: 'review.dimensions.service' },
            { id: 'ambiance', labelKey: 'review.dimensions.ambiance' },
            { id: 'value', labelKey: 'review.dimensions.value' }
        ],
        dimensionAveraging: 'legacyNullAsZero'
    }
} as const;

/** Review rules by vertical; accommodation declares none (it has its own review pipeline). */
export const REVIEW_RULES = REVIEW_RULES_CONTENT satisfies Partial<{
    [V in ListingVertical]: ReviewRules<V>;
}>;

/** A review's dimension breakdown: a missing key means the reviewer did not vote it. */
export type ReviewDimensionRating<V extends ListingVertical> = Partial<
    Record<ReviewDimensionId<V>, number>
>;

/**
 * Builds the rating-breakdown schema from the vertical's declared dimensions.
 * `votedOnly` verticals get a strict object of optional integers 1-5 (absent key
 * = not voted; `0`/`null` rejected); `legacyNullAsZero` keeps today's schema.
 *
 * @param args.vertical - The listing vertical.
 * @returns The Zod schema for that vertical's rating breakdown.
 */
export function reviewRatingSchemaFor<V extends ListingVertical>(args: { readonly vertical: V }) {
    const rules =
        args.vertical in REVIEW_RULES
            ? REVIEW_RULES[args.vertical as keyof typeof REVIEW_RULES]
            : undefined;
    if (!rules) return z.object({}).strict();
    if (rules.dimensionAveraging === 'legacyNullAsZero') return ExperienceRatingSchema;

    const shape = Object.fromEntries(
        rules.dimensions.map(({ id }) => [
            id,
            z
                .number({ error: 'zodError.review.dimension.type' })
                .int({ error: 'zodError.review.dimension.integer' })
                .min(1, { error: 'zodError.review.dimension.min' })
                .max(5, { error: 'zodError.review.dimension.max' })
                .optional()
        ])
    );
    return z
        .object(shape, {
            error: (issue) =>
                issue.code === 'unrecognized_keys'
                    ? 'zodError.review.dimension.unknown'
                    : 'zodError.review.dimension.type'
        })
        .strict();
}

type SectionStateEntry = { readonly state: ListingSectionState };
type SectionStates<V extends ListingVertical> =
    | ReadonlyMap<ListingSectionId<V>, SectionStateEntry>
    | Partial<Record<ListingSectionId<V>, SectionStateEntry>>;

function readSectionState<V extends ListingVertical>(
    sectionStates: SectionStates<V>,
    sectionId: ListingSectionId<V>
): ListingSectionState | undefined {
    if ('get' in sectionStates && typeof sectionStates.get === 'function') {
        return (sectionStates as ReadonlyMap<ListingSectionId<V>, SectionStateEntry>).get(sectionId)
            ?.state;
    }
    return (sectionStates as Partial<Record<ListingSectionId<V>, SectionStateEntry>>)[sectionId]
        ?.state;
}

/**
 * Outcome of {@link validateReviewDimensions}: `INVALID_RATING` is a shape
 * failure; `DIMENSION_NOT_APPLICABLE` is a vote for a dimension bound to an
 * `absent` section, reported on `rating.<id>`.
 */
export type ReviewDimensionValidationResult =
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly reason: 'INVALID_RATING' | 'DIMENSION_NOT_APPLICABLE';
          readonly field: string;
      };

/**
 * Validates a review's rating breakdown: shape first, then rejects a vote for a
 * dimension whose bound section is `absent` on the listing.
 *
 * @param args.vertical - The listing vertical.
 * @param args.sectionStates - The listing's section states (resolver output).
 * @param args.rating - The unvalidated rating breakdown.
 * @returns `{ ok: true }` or the typed rejection.
 */
export function validateReviewDimensions<V extends ListingVertical>(args: {
    readonly vertical: V;
    readonly sectionStates: SectionStates<V>;
    readonly rating: unknown;
}): ReviewDimensionValidationResult {
    const parsed = reviewRatingSchemaFor({ vertical: args.vertical }).safeParse(args.rating);
    if (!parsed.success) return { ok: false, reason: 'INVALID_RATING', field: 'rating' };

    const rules =
        args.vertical in REVIEW_RULES
            ? REVIEW_RULES[args.vertical as keyof typeof REVIEW_RULES]
            : undefined;
    if (!rules) return { ok: true };
    for (const dimension of rules.dimensions as unknown as readonly ReviewDimensionDefinition<V>[]) {
        if (
            dimension.boundSection &&
            dimension.id in (args.rating as Record<string, unknown>) &&
            readSectionState(args.sectionStates, dimension.boundSection) === 'absent'
        ) {
            return {
                ok: false,
                reason: 'DIMENSION_NOT_APPLICABLE',
                field: `rating.${dimension.id}`
            };
        }
    }
    return { ok: true };
}
