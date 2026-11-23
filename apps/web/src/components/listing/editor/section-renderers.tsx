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
import { EditorSocialLinksSection } from '@/components/account/editor-fields/EditorSocialLinksSection';
import { ListingContactSection } from '@/components/account/editor-fields/ListingContactSection';
import { ListingLocationSection } from '@/components/account/editor-fields/ListingLocationSection';
import { Section } from '@/components/account/ui/Section';
import { MeetingPointSection } from '@/components/experience/MeetingPointSection.client';
import type { DestinationOption } from '@/components/listing/destination-option';
import { BasicInfoSection } from '@/components/listing/editor/BasicInfoSection.client';
import {
    type ContactValues,
    type ListingEditData,
    type ListingFieldChange,
    type LocationValues,
    SOCIAL_KEYS,
    type SocialValues
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
import {
    type ListingI18nValues,
    ListingTranslationPanel
} from '@/components/listing/ListingTranslationPanel.client';
import type { AmenityAttributeChange } from '@/components/shared/catalog-picker/AmenityAttributeControls.client';
import { CatalogPicker } from '@/components/shared/catalog-picker/CatalogPicker.client';
import type { AmenityData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { FieldErrors } from '@/lib/forms/field-errors';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createT, createTranslations } from '@/lib/i18n';
import { LISTING_BASE_POLICY_KEYS, type ListingPolicyKey } from '@/lib/listing/listing-policies';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { LISTING_FIELD_ID_SUFFIXES, LISTING_FIELD_PREFIX } from './field-ids';

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
    /** Merges a patch into the venue `location` members against the current state. */
    readonly onLocationChange: (patch: Partial<LocationValues>) => void;
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
 * Whether the postal-address form renders for each vertical (HOS-2189).
 *
 * `location` is a venue section: the experience update schema has no such key
 * (an experience carries a `meetingPoint`), so the form stays out of an
 * experience's way even if its route were ever reached.
 */
const RENDERS_LOCATION_FORM: Readonly<Record<VenueOrExperience, boolean>> = {
    venue: true,
    experience: false
};

/**
 * Whether the WhatsApp number and its visibility choice render for each vertical
 * (HOS-2256). They exist on the venue update schema only; an experience's
 * WhatsApp CTA is a different, retired surface (HOS-363).
 */
const RENDERS_WHATSAPP_FORM: Readonly<Record<VenueOrExperience, boolean>> = {
    venue: true,
    experience: false
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

/** One venue address input: its member, its i18n label, its cap and whether it is optional. */
const VENUE_ADDRESS_FIELDS = [
    {
        key: 'street',
        label: 'account.editorFields.location.street',
        maxLength: 50,
        optional: false
    },
    {
        key: 'number',
        label: 'account.editorFields.location.number',
        maxLength: 10,
        optional: false
    },
    { key: 'floor', label: 'account.editorFields.location.floor', maxLength: 10, optional: true },
    {
        key: 'apartment',
        label: 'account.editorFields.location.apartment',
        maxLength: 10,
        optional: true
    }
] as const satisfies ReadonlyArray<{
    readonly key: keyof LocationValues;
    readonly label: string;
    readonly maxLength: number;
    readonly optional: boolean;
}>;

/**
 * The venue postal address and its map pin, through the shared location
 * section (HOS-2189, fused by HOS-2496).
 *
 * City, neighborhood and department are NOT asked here; they come from the
 * destination chosen in the basic-info page. A venue is a business open to the
 * public, so this address is the one its public page shows, and the pin is
 * exact. Every edit merges into the CURRENT `location` member set.
 *
 * @param context - The render context.
 * @returns The location section.
 */
function renderVenueLocation(context: ListingSectionRenderContext): JSX.Element {
    const t = createT(context.locale);
    const location = context.data.location;
    // Functional on purpose: the patch merges into the state at write time, so a
    // pin move never reverts an address edit typed after this render.
    const setMembers = context.onLocationChange;

    return (
        <ListingLocationSection
            locale={context.locale}
            idPrefix={LISTING_FIELD_PREFIX}
            sectionId="editor-location"
            title={t('account.editorFields.location.title')}
            description={t('account.editorFields.location.addressHint')}
            helpId={sectionHelpId({ vertical: 'venue', slug: 'ubicacion' })}
            address={VENUE_ADDRESS_FIELDS.map((field) => ({
                name: `location.${field.key}`,
                label: t(field.label),
                value: location[field.key],
                onChange: (value: string) => setMembers({ [field.key]: value }),
                error: context.errors[`location.${field.key}`],
                maxLength: field.maxLength,
                optional: field.optional
            }))}
            pin={{
                mapLabel: t('account.editorFields.location.venueMapLabel'),
                lat: {
                    name: 'location.coordinates.lat',
                    value: location.lat,
                    error: context.errors['location.coordinates.lat']
                },
                long: {
                    name: 'location.coordinates.long',
                    value: location.long,
                    error: context.errors['location.coordinates.long']
                },
                onChange: (next) => setMembers({ lat: next.lat, long: next.long })
            }}
        />
    );
}

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
    location: (context) =>
        RENDERS_LOCATION_FORM[context.vertical] ? renderVenueLocation(context) : <></>,
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
            vertical={context.vertical}
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
                <Section
                    id="editor-amenities"
                    title={translate(
                        context.locale,
                        'listing.owner.editor.groups.amenities',
                        'Qué ofrece tu comercio'
                    )}
                    helpId={sectionHelpId({ vertical: context.vertical, slug: 'servicios' })}
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
                </Section>
            )}
            {/* HOS-2060: `policies` lives in the amenities section of the catalog. */}
            <Section
                id="editor-policies"
                title={translate(context.locale, 'listing.policies.panelTitle', 'Políticas')}
                helpId={sectionHelpId({ vertical: context.vertical, slug: 'servicios' })}
            >
                <PoliciesPanel
                    locale={context.locale}
                    idPrefix={LISTING_FIELD_PREFIX}
                    keys={POLICIES_PANEL_KEYS[context.vertical]}
                    policies={context.data.policies}
                    errors={context.errors}
                    onChange={context.onPolicyChange}
                />
            </Section>
        </>
    ),
    contact: (context) => (
        <>
            {/* HOS-2497: the one contact section both editors render. */}
            <ListingContactSection
                locale={context.locale}
                idPrefix={LISTING_FIELD_PREFIX}
                suffixes={LISTING_FIELD_ID_SUFFIXES}
                helpId={`section:${context.vertical}.contacto`}
                phone={{
                    name: 'contactInfo.mobilePhone',
                    value: context.data.contact.mobilePhone,
                    onChange: (value) => context.onContactChange({ mobilePhone: value }),
                    error: context.errors['contactInfo.mobilePhone']
                }}
                landline={{
                    name: 'contactInfo.workPhone',
                    value: context.data.contact.workPhone,
                    onChange: (value) => context.onContactChange({ workPhone: value }),
                    error: context.errors['contactInfo.workPhone']
                }}
                whatsapp={
                    RENDERS_WHATSAPP_FORM[context.vertical]
                        ? {
                              name: 'contactInfo.whatsapp',
                              value: context.data.whatsapp,
                              onChange: (value) => context.onFieldChange('whatsapp', value),
                              error: context.errors['contactInfo.whatsapp']
                          }
                        : undefined
                }
                whatsappVisibility={
                    RENDERS_WHATSAPP_FORM[context.vertical]
                        ? {
                              name: 'whatsappVisibility',
                              value: context.data.whatsappVisibility,
                              onChange: (value) =>
                                  context.onFieldChange('whatsappVisibility', value)
                          }
                        : undefined
                }
                email={{
                    name: 'contactInfo.workEmail',
                    value: context.data.contact.workEmail,
                    onChange: (value) => context.onContactChange({ workEmail: value }),
                    error: context.errors['contactInfo.workEmail']
                }}
            />
            <EditorSocialLinksSection
                locale={context.locale}
                helpId={`section:${context.vertical}.contacto`}
                links={SOCIAL_KEYS.map((key) => ({
                    id: buildFieldId({
                        prefix: LISTING_FIELD_PREFIX,
                        name: `socialNetworks.${key}`
                    }),
                    label: createT(context.locale)(`account.editorFields.social.${key}`),
                    value: context.data.social[key],
                    onChange: (value: string) => context.onSocialChange(key, value),
                    error: context.errors[`socialNetworks.${key}`]
                }))}
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
