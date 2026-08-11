/**
 * @file edit-data-fixture.ts
 * @description Shared `CommerceEditData` builder for the commerce editor
 * section tests (HOS-258).
 *
 * Every section receives the WHOLE form-state object and reads only its own
 * slice, mirroring the accommodation editor's contract. A single builder keeps
 * each section test focused on its own fields instead of restating eighteen
 * unrelated ones.
 *
 * @module test/components/commerce/editor/edit-data-fixture
 */
import type { CommerceEditData } from '../../../../src/components/commerce/editor/commerce-edit-data';

const blankI18n = () => ({ es: '', en: '', pt: '' });

/**
 * Build a `CommerceEditData` with sensible empty defaults.
 *
 * @param overrides - Fields to override on top of the empty baseline
 * @returns A complete, type-checked form-state object
 */
export function buildEditData(overrides: Partial<CommerceEditData> = {}): CommerceEditData {
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
        ...overrides
    };
}
