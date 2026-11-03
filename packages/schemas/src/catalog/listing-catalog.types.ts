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
/** Definition of a feature nested within a listing section. */
export interface SectionTraitDefinition<
    _V extends ListingVertical = ListingVertical,
    _S extends string = string
> {
    /** Literal feature id derived from the catalog. */
    readonly id: string;
    /** Optional entitlement needed for this feature. */
    readonly entitlementKey?: EntitlementKeyEnum;
}
/** Definition of a vertical's listing content section. */
export interface ListingSectionDefinition<V extends ListingVertical = ListingVertical> {
    /** Literal section id derived from the catalog. */
    readonly id: string;
    /** Owning listing vertical. */
    readonly vertical: V;
    /** Whether this section applies to every business line. */
    readonly common: boolean;
    /** Optional entitlement needed for the full section. */
    readonly entitlementKey?: EntitlementKeyEnum;
    /** Optional nested features. */
    readonly traits?: readonly SectionTraitDefinition<V, string>[];
    /** Update input fields owned by this section. */
    readonly fields: readonly (keyof UpdateInputOf<V>)[];
    /** Optional heading key when multiple lines apply. */
    readonly headingWhenMultiLineKey?: string;
    /** Shared editor and public-page order. */
    readonly order: number;
    /** Presentation group. */
    readonly group: 'property' | 'content' | 'management';
}
/** Literal business line values declared per vertical. */
export const BUSINESS_LINE_VALUES = {
    venue: ['food', 'nightlife'],
    accommodation: ['standard'],
    experience: ['standard']
} as const satisfies Readonly<Record<ListingVertical, readonly string[]>>;
/** Business line values for one vertical. */
export type BusinessLineValue<V extends ListingVertical> = (typeof BUSINESS_LINE_VALUES)[V][number];
/** Any listing business line value. */
export type BusinessLine = BusinessLineValue<ListingVertical>;
/** A business line catalog entry. */
export interface BusinessLineDefinition<V extends ListingVertical = ListingVertical> {
    /** Owning vertical. */
    readonly vertical: V;
    /** Internal business line value. */
    readonly value: BusinessLineValue<V>;
    /** Public URL slug, when applicable. */
    readonly urlSlug?: string;
    /** Whether this line has a public collection. */
    readonly public: boolean;
    /** Non-common sections associated with this line. */
    readonly sections: readonly string[];
}
/** Allowed and preselected business lines for one listing type. */
export interface BusinessLineTypeRule<V extends ListingVertical> {
    /** Values permitted for this listing type. */
    readonly allowed: readonly BusinessLineValue<V>[];
    /** Values selected by default during listing creation. */
    readonly preselect: readonly BusinessLineValue<V>[];
    /** Optional suggested update fields. */
    readonly fieldDefaults?: Partial<UpdateInputOf<V>>;
}
/** Business line constraints and exhaustive rules by listing type. */
export interface BusinessLineRules<V extends ListingVertical = ListingVertical> {
    /** Owning vertical. */
    readonly vertical: V;
    /** Optional maximum number of lines per listing. */
    readonly maxPerListing?: number;
    /** Optional mutually exclusive pairs. */
    readonly excludes?: readonly (readonly [BusinessLineValue<V>, BusinessLineValue<V>])[];
    /** Exhaustive rules for every listing type. */
    readonly typeRules: Readonly<Record<ListingTypeOf<V>, BusinessLineTypeRule<V>>>;
}
