/**
 * @file owner-edit-listing-access.ts
 * @description The body-dependent parts of the listing-access declarations of
 * the venue and experience owner edit routes
 * (`PATCH /api/v1/protected/{venues,experiences}/:id`): which sections a body
 * writes (step 4b) and, for experiences, their traits.
 *
 * The routes keep `vertical` / `operation` inline (guards G2 and G-R3-C read
 * them from the route source) and point `listingSection` / `sectionTraits` at
 * these functions. The owner's assistant tool `update_listing_basic`
 * (HOS-2184) builds its declaration from the same functions, so a body is
 * checked against the same sections whichever door it comes through.
 */

import { sectionsTouchedByBody, sectionTraitsTouchedByBody } from '@repo/schemas';

/** A body-dependent declaration's argument. */
interface BodyArgs {
    /** The validated request body. */
    readonly body: Record<string, unknown> | undefined;
}

/** One section a body writes. */
interface WrittenSection {
    readonly id: string;
    readonly intent: 'write';
}

/**
 * Sections a venue owner PATCH body writes.
 *
 * @param args - The validated body
 * @returns One `write` declaration per touched section
 */
export function venueOwnerEditSections({ body }: BodyArgs): readonly WrittenSection[] {
    return sectionsTouchedByBody({ vertical: 'venue', body }).map((id) => ({
        id,
        intent: 'write' as const
    }));
}

/**
 * Section traits a venue owner PATCH body touches (HOS-2258: `videos`, gated by
 * `can_embed_video`). A `videos: []` counts as touched, `videos: null` does not.
 *
 * @param args - The validated body
 * @returns The touched trait ids
 */
export function venueOwnerEditSectionTraits({ body }: BodyArgs): readonly string[] {
    return sectionTraitsTouchedByBody({ vertical: 'venue', body });
}

/**
 * Sections an experience owner PATCH body writes.
 *
 * @param args - The validated body
 * @returns One `write` declaration per touched section
 */
export function experienceOwnerEditSections({ body }: BodyArgs): readonly WrittenSection[] {
    return sectionsTouchedByBody({ vertical: 'experience', body }).map((id) => ({
        id,
        intent: 'write' as const
    }));
}

/**
 * Section traits an experience owner PATCH body touches.
 *
 * @param args - The validated body
 * @returns The touched trait ids
 */
export function experienceOwnerEditSectionTraits({ body }: BodyArgs): readonly string[] {
    return sectionTraitsTouchedByBody({ vertical: 'experience', body });
}
