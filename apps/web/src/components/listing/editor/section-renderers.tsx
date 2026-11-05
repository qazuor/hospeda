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
import { AmenitiesSection } from '@/components/listing/editor/AmenitiesSection.client';
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
import { PracticalInfoSection } from '@/components/listing/editor/PracticalInfoSection.client';
import { PriceSection } from '@/components/listing/editor/PriceSection.client';
import { SocialNetworksSection } from '@/components/listing/editor/SocialNetworksSection.client';
import {
    type ListingI18nValues,
    ListingTranslationPanel
} from '@/components/listing/ListingTranslationPanel.client';
import type { AmenityData } from '@/lib/api/types';
import type { FieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

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
    readonly onContactChange: (patch: Partial<ContactValues>) => void;
    readonly onSocialChange: (key: keyof SocialValues, value: string) => void;
    readonly onToggleAmenity: (id: string) => void;
    readonly onToggleFeature: (id: string) => void;
    readonly onI18nChange: (values: ListingI18nValues) => void;
    readonly shouldOfferSlugRefresh: boolean;
}

/**
 * The renderers, one per form section id.
 *
 * `meetingPoint` and `practicalInfo` keep their vertical guard: their keys live
 * on `ExperienceOwnerUpdateInputSchema`, so rendering them for a venue would
 * offer fields the API strips. The registry already makes those routes
 * unreachable for a venue; this stays as the second, form-level gate.
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
        />
    ),
    meetingPoint: (context) =>
        context.vertical === 'experience' ? (
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
        context.vertical === 'experience' ? (
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
        <AmenitiesSection
            locale={context.locale}
            amenities={context.amenities}
            features={context.features}
            selectedAmenityIds={context.data.amenityIds}
            selectedFeatureIds={context.data.featureIds}
            onToggleAmenity={context.onToggleAmenity}
            onToggleFeature={context.onToggleFeature}
        />
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
