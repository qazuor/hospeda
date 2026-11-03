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
export const ExperienceListingSectionStatesSchema = createSectionStatesSchema('experience');
