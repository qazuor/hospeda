/**
 * @file venue-menu-glyph.ts
 * @description Which glyph the venue «Ver carta» button of the listing action
 * bar draws (HOS-2607). A fork and knife reads as "the food menu" and is wrong
 * for a bar, a pub or a boliche, whose «carta» is a drinks list. The decision is
 * made per `VenueTypeEnum` value, which is the one field every venue has exactly
 * once: business lines are multi-valued (a BAR carries both `food` and
 * `nightlife`), so they cannot pick a single glyph on their own.
 *
 * The split mirrors `BUSINESS_LINE_RULES` in `@repo/schemas`: a type is
 * `nightlife` here exactly when its rule PRESELECTS the `nightlife` line, and
 * `test/lib/listing-contact/venue-menu-glyph.test.ts` fails if the two drift.
 */
import { VenueTypeEnum } from '@repo/schemas';
import { z } from 'zod';

/** The two glyph families of the venue menu button. */
export const VENUE_MENU_GLYPHS = ['food', 'nightlife'] as const;

/** Zod schema of a venue menu glyph (island props are validated at the boundary). */
export const venueMenuGlyphSchema = z.enum(VENUE_MENU_GLYPHS);

/** A venue menu glyph: `food` draws a fork and knife, `nightlife` a drink. */
export type VenueMenuGlyph = z.infer<typeof venueMenuGlyphSchema>;

/**
 * Exhaustive venue type → glyph map. The `Record` type makes a new
 * `VenueTypeEnum` value a compile error until it is placed here.
 */
export const VENUE_MENU_GLYPH_BY_TYPE: Readonly<Record<VenueTypeEnum, VenueMenuGlyph>> = {
    [VenueTypeEnum.RESTAURANT]: 'food',
    [VenueTypeEnum.CAFE]: 'food',
    [VenueTypeEnum.PARRILLA]: 'food',
    [VenueTypeEnum.HELADERIA]: 'food',
    [VenueTypeEnum.PANADERIA]: 'food',
    [VenueTypeEnum.ROTISERIA]: 'food',
    [VenueTypeEnum.FOOD_TRUCK]: 'food',
    [VenueTypeEnum.BAR]: 'nightlife',
    [VenueTypeEnum.CERVECERIA]: 'nightlife',
    [VenueTypeEnum.PUB]: 'nightlife',
    [VenueTypeEnum.BOLICHE]: 'nightlife'
};

/**
 * Resolves the glyph of a venue's «Ver carta» button.
 *
 * @param input.type - The venue type from the public payload (case-insensitive).
 * @returns `{ glyph }`, `food` for an unknown type (the pre-HOS-2607 glyph).
 */
export function resolveVenueMenuGlyph({ type }: { readonly type: string | null | undefined }): {
    readonly glyph: VenueMenuGlyph;
} {
    const key = (type ?? '').toUpperCase() as VenueTypeEnum;
    return { glyph: VENUE_MENU_GLYPH_BY_TYPE[key] ?? 'food' };
}
