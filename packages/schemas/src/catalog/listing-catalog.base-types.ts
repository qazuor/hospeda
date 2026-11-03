import type { AccommodationUpdateInput } from '../entities/accommodation/accommodation.crud.schema.js';
import type { ExperienceUpdateInput } from '../entities/experience/experience.crud.schema.js';
import type { VenueUpdateInput } from '../entities/venue/venue.crud.schema.js';
import type { AccommodationTypeEnum } from '../enums/accommodation-type.enum.js';
import type { ExperienceTypeEnum } from '../enums/experience-type.enum.js';
import type { VenueTypeEnum } from '../enums/venue-type.enum.js';
import type { EntitlementKeyEnum } from './key-enums.js';

/** Listing verticals that have a listing editor and catalog. */
export const LISTING_VERTICALS = ['accommodation', 'venue', 'experience'] as const;
/** A vertical with a listing and content catalog. */
export type ListingVertical = (typeof LISTING_VERTICALS)[number];
/** Update input shape for a listing vertical. */
export type UpdateInputOf<V extends ListingVertical> = V extends 'venue'
    ? VenueUpdateInput
    : V extends 'experience'
      ? ExperienceUpdateInput
      : AccommodationUpdateInput;
/** Listing type enum value for a vertical. */
export type ListingTypeOf<V extends ListingVertical> = V extends 'venue'
    ? VenueTypeEnum
    : V extends 'experience'
      ? ExperienceTypeEnum
      : AccommodationTypeEnum;

/** Construction shape used to type-check section content before deriving its ids. */
export interface ListingSectionDefinitionBase<V extends ListingVertical = ListingVertical> {
    /** Section id, narrowed by the exported public definition after inference. */
    readonly id: string;
    /** Owning listing vertical. */
    readonly vertical: V;
    /** Whether this section applies to every business line. */
    readonly common: boolean;
    /** Optional entitlement needed for the full section. */
    readonly entitlementKey?: EntitlementKeyEnum;
    /** Optional nested feature definitions. */
    readonly traits?: readonly SectionTraitDefinitionBase[];
    /** Update input fields owned by this section. */
    readonly fields: readonly (keyof UpdateInputOf<V>)[];
    /** Fields owned by this section in read responses; never writable and never counted by sections-touched. */
    readonly readOnlyFields?: readonly string[];
    /** Optional heading when the listing has multiple business lines. */
    readonly headingWhenMultiLineKey?: string;
    /** Shared editor and public-page order. */
    readonly order: number;
    /** Presentation group. */
    readonly group: 'property' | 'content' | 'management';
}
/** Construction shape for a feature nested within a section. */
export interface SectionTraitDefinitionBase {
    /** Trait id, narrowed by the exported public definition after inference. */
    readonly id: string;
    /** Update input fields whose presence requests this trait. */
    readonly fields?: readonly string[];
    /** Optional entitlement needed for this feature. */
    readonly entitlementKey?: EntitlementKeyEnum;
}
