/**
 * @file edit-data-fixture.ts
 * @description Shared `ListingEditData` builder for the listing editor
 * section tests (HOS-258).
 *
 * Every section receives the WHOLE form-state object and reads only its own
 * slice, mirroring the accommodation editor's contract. A single builder keeps
 * each section test focused on its own fields instead of restating eighteen
 * unrelated ones.
 *
 * @module test/components/listing/editor/edit-data-fixture
 */
import type { ListingEditData } from '../../../../src/components/listing/editor/listing-edit-data';

const blankI18n = () => ({ es: '', en: '', pt: '' });

/**
 * Build a `ListingEditData` with sensible empty defaults.
 *
 * @param overrides - Fields to override on top of the empty baseline
 * @returns A complete, type-checked form-state object
 */
export function buildEditData(overrides: Partial<ListingEditData> = {}): ListingEditData {
    return {
        name: '',
        destinationId: '',
        description: '',
        listingType: '',
        summary: '',
        richDescription: '',
        contact: { mobilePhone: '', workEmail: '' },
        social: {
            facebook: '',
            instagram: '',
            twitter: '',
            tiktok: '',
            youtube: '',
            linkedIn: ''
        },
        openingHours: null,
        priceRange: '',
        menuUrl: '',
        isPriceOnRequest: false,
        priceFrom: null,
        priceUnit: '',
        amenityIds: new Set<string>(),
        featureIds: new Set<string>(),
        i18nValues: {
            nameI18n: blankI18n(),
            summaryI18n: blankI18n(),
            descriptionI18n: blankI18n(),
            richDescriptionI18n: blankI18n()
        },
        refreshSlugFromName: false,
        ...overrides
    };
}
