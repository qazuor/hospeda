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

export interface ReviewDimensionDefinition<V extends ListingVertical = ListingVertical> {
    readonly id: ReviewDimensionId<V>;
    readonly labelKey: string;
    readonly boundSection?: ListingSectionId<V>;
}

export interface ReviewRules<V extends ListingVertical = ListingVertical> {
    readonly vertical: V;
    readonly dimensions: readonly ReviewDimensionDefinition<V>[];
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

export const REVIEW_RULES = REVIEW_RULES_CONTENT satisfies Partial<{
    [V in ListingVertical]: ReviewRules<V>;
}>;

export type ReviewDimensionRating<V extends ListingVertical> = Partial<
    Record<ReviewDimensionId<V>, number>
>;

/** Builds the rating shape from the vertical's declared review dimensions. */
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

export type ReviewDimensionValidationResult =
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly reason: 'INVALID_RATING' | 'DIMENSION_NOT_APPLICABLE';
          readonly field: string;
      };

/** Validates rating shape, then rejects votes for unavailable listing sections. */
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
