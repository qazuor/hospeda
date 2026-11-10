import { z } from 'zod';
import { LISTING_SECTIONS } from './listing-sections.js';
import type { ListingSectionState } from './review-dimensions.js';

/** Availability state resolved for an editor section or one of its traits. */
export const ListingSectionStateSchema: z.ZodType<ListingSectionState> = z.enum([
    'absent',
    'locked',
    'available'
]);

function createSectionStatesSchema(vertical: 'venue' | 'experience') {
    const definitions: readonly {
        readonly id: string;
        readonly traits?: readonly { readonly id: string }[];
    }[] = LISTING_SECTIONS[vertical];
    const shape = Object.fromEntries(
        definitions.map((section) => {
            const traits = Object.fromEntries(
                (section.traits ?? []).map(({ id }) => [id, ListingSectionStateSchema])
            );
            return [
                section.id,
                z
                    .object({ state: ListingSectionStateSchema, traits: z.object(traits).strict() })
                    .strict()
            ];
        })
    );
    return z
        .object({
            sections: z.object(shape).strict(),
            multiLine: z.boolean()
        })
        .strict();
}

/** Response schemas derive valid section and trait ids from the listing catalog. */
export const VenueListingSectionStatesSchema = createSectionStatesSchema('venue');
/** Response schema for experience listing section and trait availability. */
export const ExperienceListingSectionStatesSchema = createSectionStatesSchema('experience');

/**
 * Optional `businessLines` query parameter of the section-state read
 * (HOS-1787 leaf 5.7).
 *
 * The owner editor needs to know which sections a HYPOTHETICAL selection would
 * hide BEFORE saving a removal, and only the section resolver may decide that
 * (G-FAC-03). The parameter is a comma-separated list of catalog values; the
 * route splits it and validates the resulting selection with
 * `validateBusinessLines` (G-FAC-09). Omitting it returns the stored selection.
 */
export const ListingSectionStatesBusinessLinesQuerySchema = z
    .string()
    .optional()
    .describe(
        'Comma-separated business-line values to resolve section states for, instead of the stored selection.'
    );
