/**
 * @file listing-vertical-form-config.ts
 * @description Per-vertical configuration for the owner create form
 * (HOS-1787 leaf 5.6).
 *
 * `ListingCreateForm` and `BasicInfoSection` used to branch on
 * `vertical === 'venue'` for the type options, the form schema and the price
 * fields. G-FAC-05 (leaf 5.8) scans those files for comparisons against a
 * vertical literal, so the three decisions live here instead: one record keyed
 * by vertical, read as data by both components. Behaviour is unchanged.
 *
 * @module lib/listing/listing-vertical-form-config
 */

import type { ExperienceOwnerCreateInput, VenueOwnerCreateInput } from '@repo/schemas';
import {
    ExperienceOwnerCreateInputSchema,
    ExperienceTypeEnum,
    requirePricingUnlessOnRequest,
    resolveBusinessLineDefaults as resolveDefaults,
    VenueOwnerCreateInputSchema,
    VenueTypeEnum
} from '@repo/schemas';
import type { ZodTypeAny } from 'zod';
import { resolveExperienceTypeLabel } from '@/lib/experience/type-labels';
import type { CreateOwnerListingPayload, VenueOrExperience } from '@/lib/listing/owner-listings';
import { resolveVenueTypeLabel } from '@/lib/venue/type-labels';

/** Translator shape used by the type-label resolvers. */
type Translate = (key: string, fallback?: string) => string;

/** Business-line defaults the create form applies when a type is chosen. */
export interface ListingBusinessLineDefaults {
    readonly preselect: readonly string[];
    readonly fieldDefaults: {
        readonly minAge?: number | null;
    };
}

/** Create-form copy that names the thing being created. */
export interface ListingVerticalFormLabels {
    readonly nameKey: string;
    readonly nameFallback: string;
    readonly submitKey: string;
    readonly submitFallback: string;
    readonly createErrorKey: string;
    readonly createErrorFallback: string;
}

/** One vertical's create-form decision surface. */
export interface ListingVerticalFormConfig {
    /** Listing-type enum values, in display order. */
    readonly typeOptions: readonly string[];
    /** The subset of the real create schema this form collects. */
    readonly formSchema: ZodTypeAny;
    /** Whether this vertical has a business-line selector and sends the field. */
    readonly showsBusinessLines: boolean;
    /** Whether this vertical shows the experience price fields. */
    readonly showsPriceFields: boolean;
    /** Whether the selected type's description is rendered under the select. */
    readonly showsTypeDescription: boolean;
    /** Resolves the localized label of one listing type. */
    readonly resolveTypeLabel: (args: { readonly t: Translate; readonly type: string }) => string;
    /** The copy that names what is being created. */
    readonly labels: ListingVerticalFormLabels;
    /** Preselection and field suggestions for a listing type. */
    readonly resolveBusinessLineDefaults: (type: string) => ListingBusinessLineDefaults;
    /** Builds the typed owner-create payload for this vertical. */
    readonly buildCreatePayload: (data: unknown) => CreateOwnerListingPayload;
}

/** Fields the venue create form collects — a subset of the real create schema. */
const VENUE_FORM_SCHEMA = VenueOwnerCreateInputSchema.pick({
    name: true,
    type: true,
    summary: true,
    description: true,
    destinationId: true,
    businessLines: true,
    minAge: true
});

/**
 * Fields the experience create form collects.
 *
 * The pick is taken from the PLAIN create schema and the cross-field pricing
 * rule is re-applied afterwards, deliberately in that order: Zod 4 throws
 * `.pick() cannot be used on object schemas containing refinements`, so picking
 * from `ExperienceOwnerCreateInputCheckedSchema` would crash this module on
 * load. Re-applying the shared predicate keeps the client and the server
 * enforcing the same rule from one definition instead of two (H-156).
 */
const EXPERIENCE_FORM_SCHEMA = ExperienceOwnerCreateInputSchema.pick({
    name: true,
    type: true,
    summary: true,
    description: true,
    destinationId: true,
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true
}).superRefine(requirePricingUnlessOnRequest);

/** The per-vertical record both create-form consumers read. */
export const LISTING_VERTICAL_FORM_CONFIG: Readonly<
    Record<VenueOrExperience, ListingVerticalFormConfig>
> = {
    venue: {
        typeOptions: Object.values(VenueTypeEnum),
        formSchema: VENUE_FORM_SCHEMA,
        showsBusinessLines: true,
        showsPriceFields: false,
        showsTypeDescription: true,
        resolveTypeLabel: resolveVenueTypeLabel,
        labels: {
            nameKey: 'listing.owner.create.fields.name.venue',
            nameFallback: 'Nombre del comercio',
            submitKey: 'listing.owner.create.submit.venue',
            submitFallback: 'Crear comercio',
            createErrorKey: 'listing.owner.create.error.venue',
            createErrorFallback: 'No pudimos crear el comercio. Probá de nuevo.'
        },
        resolveBusinessLineDefaults: (type) => {
            const { preselect, fieldDefaults } = resolveDefaults({ vertical: 'venue', type });
            return {
                preselect,
                fieldDefaults: fieldDefaults as ListingBusinessLineDefaults['fieldDefaults']
            };
        },
        buildCreatePayload: (data) => ({
            vertical: 'venue',
            data: data as VenueOwnerCreateInput
        })
    },
    experience: {
        typeOptions: Object.values(ExperienceTypeEnum),
        formSchema: EXPERIENCE_FORM_SCHEMA,
        showsBusinessLines: false,
        showsPriceFields: true,
        showsTypeDescription: false,
        resolveTypeLabel: resolveExperienceTypeLabel,
        labels: {
            nameKey: 'listing.owner.create.fields.name.experience',
            nameFallback: 'Nombre de la experiencia',
            submitKey: 'listing.owner.create.submit.experience',
            submitFallback: 'Crear experiencia',
            createErrorKey: 'listing.owner.create.error.experience',
            createErrorFallback: 'No pudimos crear la experiencia. Probá de nuevo.'
        },
        resolveBusinessLineDefaults: () => ({ preselect: [], fieldDefaults: {} }),
        buildCreatePayload: (data) => ({
            vertical: 'experience',
            data: data as ExperienceOwnerCreateInput
        })
    }
};
