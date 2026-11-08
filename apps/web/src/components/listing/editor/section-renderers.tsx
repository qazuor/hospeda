/**
 * @file section-renderers.tsx
 * @description One renderer per listing-editor form section, keyed by section
 * id (HOS-1787 leaf 5.1).
 *
 * `ListingEditor` used to dispatch with a chain of `sectionId === '<literal'>`
 * conditions. The registry now owns which section a page renders, so the island
 * only has to look up the renderer for the id it was given. Keeping the map
 * exhaustive by type means a new form section cannot be added without deciding
 * what it draws.
 */

import type { JSX } from 'react';
import { MeetingPointSection } from '@/components/experience/MeetingPointSection.client';
import type { DestinationOption } from '@/components/listing/destination-option';
import { BasicInfoSection } from '@/components/listing/editor/BasicInfoSection.client';
import { ContactSection } from '@/components/listing/editor/ContactSection.client';
import type {
    ContactValues,
    ListingEditData,
    ListingFieldChange,
    SocialValues
} from '@/components/listing/editor/listing-edit-data';
import type { ListingEditorFormSectionId } from '@/components/listing/editor/listing-section-payload';
import { NightInfoSection } from '@/components/listing/editor/NightInfoSection.client';
import { OpeningHoursSection } from '@/components/listing/editor/OpeningHoursSection.client';
import {
    type ListingPolicyChange,
    PoliciesPanel
} from '@/components/listing/editor/PoliciesPanel.client';
import { PracticalInfoSection } from '@/components/listing/editor/PracticalInfoSection.client';
import { PriceSection } from '@/components/listing/editor/PriceSection.client';
import { SocialNetworksSection } from '@/components/listing/editor/SocialNetworksSection.client';
import {
    type ListingI18nValues,
    ListingTranslationPanel
} from '@/components/listing/ListingTranslationPanel.client';
import type { AmenityAttributeChange } from '@/components/shared/catalog-picker/AmenityAttributeControls.client';
import { CatalogPicker } from '@/components/shared/catalog-picker/CatalogPicker.client';
import type { AmenityData } from '@/lib/api/types';
import type { FieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { LISTING_BASE_POLICY_KEYS, type ListingPolicyKey } from '@/lib/listing/listing-policies';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import fieldStyles from './editor-fields.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';

/** Resolves one key for a renderer that has only the locale in hand. */
function translate(locale: SupportedLocale, key: string, fallback: string): string {
    return createTranslations(locale).t(key, fallback);
}

/** Everything a section renderer can need, supplied once by `ListingEditor`. */
export interface ListingSectionRenderContext {
    readonly locale: SupportedLocale;
    readonly vertical: VenueOrExperience;
    readonly data: ListingEditData;
    readonly errors: FieldErrors;
    readonly destinations: readonly DestinationOption[];
    readonly destinationsLoadFailed: boolean;
    readonly amenities: readonly AmenityData[];
    readonly features: readonly AmenityData[];
    readonly onFieldChange: ListingFieldChange;
    /** Sets or removes one house-rule key (HOS-2060). */
    readonly onPolicyChange: ListingPolicyChange;
    readonly onContactChange: (patch: Partial<ContactValues>) => void;
    readonly onSocialChange: (key: keyof SocialValues, value: string) => void;
    readonly onToggleAmenity: (id: string) => void;
    readonly onToggleFeature: (id: string) => void;
    /** Sets one declared scope/availability of a checked amenity (HOS-2061). */
    readonly onChangeAmenityAttribute: AmenityAttributeChange;
    readonly onI18nChange: (values: ListingI18nValues) => void;
    readonly shouldOfferSlugRefresh: boolean;
    /** UUID of the listing, forwarded to sections that read listing-scoped data. */
    readonly listingId: string;
}

/**
 * Whether the two experience-only form sections render for each vertical.
 *
 * `meetingPoint` and `practicalInfo` keep their vertical guard: their keys live
 * on `ExperienceOwnerUpdateInputSchema`, so rendering them for a venue would
 * offer fields the API strips. The registry already makes those routes
 * unreachable for a venue; this stays as the second, form-level gate.
 *
 * A record rather than `context.vertical === 'experience'`: G-FAC-05 (leaf 5.8)
 * forbids the editor from deciding by a vertical literal.
 */
const RENDERS_EXPERIENCE_ONLY_FORM: Readonly<Record<VenueOrExperience, boolean>> = {
    venue: false,
    experience: true
};

/**
 * The house-rule keys the amenities page's Policies panel edits per vertical
 * (HOS-2060): the shared base plus the vertical's own. The venue night keys
 * (`minAge`, `dressCode`, `dressCodeNote`) are absent on purpose — the catalog
 * gives them to `nightInfo`, whose page edits them.
 */
const POLICIES_PANEL_KEYS: Readonly<Record<VenueOrExperience, readonly ListingPolicyKey[]>> = {
    venue: [...LISTING_BASE_POLICY_KEYS, 'reservations'],
    experience: [...LISTING_BASE_POLICY_KEYS, 'privateGroups', 'cancellation']
};

/**
 * The renderers, one per form section id.
 *
 * Keeping the map exhaustive by type means a new form section cannot be added
 * without deciding what it draws.
 */
export const LISTING_SECTION_RENDERERS: Readonly<
    Record<ListingEditorFormSectionId, (context: ListingSectionRenderContext) => JSX.Element>
> = {
    basicInfo: (context) => (
        <BasicInfoSection
            locale={context.locale}
            vertical={context.vertical}
            data={context.data}
            destinations={context.destinations}
            destinationsLoadFailed={context.destinationsLoadFailed}
            errors={context.errors}
            onFieldChange={context.onFieldChange}
            shouldOfferSlugRefresh={context.shouldOfferSlugRefresh}
            listingId={context.listingId}
        />
    ),
    meetingPoint: (context) =>
        RENDERS_EXPERIENCE_ONLY_FORM[context.vertical] ? (
            <MeetingPointSection
                locale={context.locale}
                data={context.data}
                errors={context.errors}
                onFieldChange={context.onFieldChange}
            />
        ) : (
            <></>
        ),
    practicalInfo: (context) =>
        RENDERS_EXPERIENCE_ONLY_FORM[context.vertical] ? (
            <PracticalInfoSection
                locale={context.locale}
                data={context.data}
                errors={context.errors}
                onFieldChange={context.onFieldChange}
            />
        ) : (
            <></>
        ),
    openingHours: (context) => (
        <OpeningHoursSection
            locale={context.locale}
            value={context.data.openingHours}
            errors={context.errors}
            onChange={(next) => {
                context.onFieldChange('openingHours', next);
            }}
        />
    ),
    price: (context) => (
        <PriceSection
            locale={context.locale}
            vertical={context.vertical}
            data={context.data}
            errors={context.errors}
            onFieldChange={context.onFieldChange}
        />
    ),
    amenities: (context) => (
        <>
            {/* HOS-2061: the shared picker the accommodation editor uses too. It
                renders nothing when both catalogs are empty, and so does this block. */}
            {(context.amenities.length > 0 || context.features.length > 0) && (
                <section
                    className={fieldStyles.section}
                    id="editor-amenities"
                >
                    <CatalogPicker
                        locale={context.locale}
                        amenitiesTitle={translate(
                            context.locale,
                            'listing.owner.editor.sections.amenities',
                            'Servicios'
                        )}
                        featuresTitle={translate(
                            context.locale,
                            'listing.owner.editor.sections.features',
                            'Características'
                        )}
                        amenities={context.amenities}
                        features={context.features}
                        selectedAmenityIds={context.data.amenityIds}
                        selectedFeatureIds={context.data.featureIds}
                        onToggleAmenity={context.onToggleAmenity}
                        onToggleFeature={context.onToggleFeature}
                        amenityAttributes={context.data.amenityAttributes}
                        onChangeAmenityAttribute={context.onChangeAmenityAttribute}
                    />
                </section>
            )}
            {/* HOS-2060: `policies` lives in the amenities section of the catalog. */}
            <section
                className={fieldStyles.section}
                id="editor-policies"
            >
                <PoliciesPanel
                    locale={context.locale}
                    idPrefix={LISTING_FIELD_PREFIX}
                    keys={POLICIES_PANEL_KEYS[context.vertical]}
                    policies={context.data.policies}
                    errors={context.errors}
                    onChange={context.onPolicyChange}
                />
            </section>
        </>
    ),
    contact: (context) => (
        <>
            <ContactSection
                locale={context.locale}
                contact={context.data.contact}
                errors={context.errors}
                onContactChange={context.onContactChange}
            />
            <SocialNetworksSection
                locale={context.locale}
                social={context.data.social}
                errors={context.errors}
                onSocialChange={context.onSocialChange}
            />
        </>
    ),
    nightInfo: (context) => (
        <NightInfoSection
            locale={context.locale}
            data={context.data}
            errors={context.errors}
            onFieldChange={context.onFieldChange}
            onPolicyChange={context.onPolicyChange}
        />
    ),
    translations: (context) => (
        <ListingTranslationPanel
            locale={context.locale}
            initialValues={context.data.i18nValues}
            plainTextValues={{
                name: context.data.name,
                summary: context.data.summary,
                description: context.data.description,
                richDescription: context.data.richDescription
            }}
            onChange={context.onI18nChange}
        />
    )
};
