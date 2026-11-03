import type { EntitlementKeyEnum } from './key-enums.js';
import type {
    ListingSectionDefinitionBase,
    ListingTypeOf,
    ListingVertical,
    UpdateInputOf
} from './listing-catalog.base-types.js';
import type { ListingSectionId, SectionTraitId } from './listing-catalog.ids.js';

export type {
    ListingTypeOf,
    ListingVertical,
    UpdateInputOf
} from './listing-catalog.base-types.js';
/** Definition of a feature nested within a listing section. */
export interface SectionTraitDefinition<
    V extends ListingVertical = ListingVertical,
    S extends ListingSectionId<V> = ListingSectionId<V>
> {
    /** Literal feature id derived from the section catalog. */
    readonly id: SectionTraitId<V, S>;
    /** Optional entitlement needed for this feature. */
    readonly entitlementKey?: EntitlementKeyEnum;
}
/** Definition of a listing section with ids narrowed from the catalog content. */
export interface ListingSectionDefinition<V extends ListingVertical = ListingVertical>
    extends Omit<ListingSectionDefinitionBase<V>, 'id' | 'traits'> {
    /** Literal section id derived from the catalog. */
    readonly id: ListingSectionId<V>;
    /** Optional nested features with ids derived from this vertical's sections. */
    readonly traits?: readonly SectionTraitDefinition<V>[];
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
    /** Non-common sections associated with this business line. */
    readonly sections: readonly ListingSectionId<V>[];
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
