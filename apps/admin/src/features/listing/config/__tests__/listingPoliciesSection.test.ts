/**
 * Tests for the shared admin house-rules section (HOS-2060).
 */
import {
    LISTING_PAYMENT_METHODS,
    LISTING_PET_ADMISSION_VALUES,
    LISTING_SMOKING_VALUES,
    PermissionEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { createListingPoliciesSection } from '../listingPoliciesSection';

type Translate = Parameters<typeof createListingPoliciesSection>[0]['t'];

/** Echoes the key, so a label can be traced back to the i18n key it reads. */
const t = ((key: string) => key) as Translate;

const BASE_IDS = [
    'policies.paymentMethods',
    'policies.pets.admission',
    'policies.pets.extraCost',
    'policies.smokingAllowed',
    'policies.eventsAllowed'
];

describe('createListingPoliciesSection', () => {
    it.each([
        ['accommodation', [...BASE_IDS, 'policies.minNights', 'policies.maxNights']],
        ['venue', BASE_IDS],
        ['experience', [...BASE_IDS, 'policies.cancellation', 'policies.privateGroups']]
    ] as const)('exposes the %s rule set', (vertical, expected) => {
        // Act
        const { section } = createListingPoliciesSection({ vertical, t });

        // Assert
        expect(section.id).toBe('listing-policies');
        expect(section.fields.map((field) => field.id)).toEqual(expected);
    });

    it('never exposes the venue night keys, which belong to nightInfo', () => {
        // Act
        const ids = createListingPoliciesSection({ vertical: 'venue', t }).section.fields.map(
            (field) => field.id
        );

        // Assert
        for (const key of ['minAge', 'dressCode', 'dressCodeNote']) {
            expect(ids).not.toContain(`policies.${key}`);
        }
    });

    it('keeps every field optional', () => {
        // Act
        const { section } = createListingPoliciesSection({ vertical: 'accommodation', t });

        // Assert
        expect(section.fields.every((field) => field.required === false)).toBe(true);
    });

    it('offers exactly the schema values in the closed selects', () => {
        // Arrange
        const { section } = createListingPoliciesSection({ vertical: 'venue', t });
        const optionsOf = (id: string) =>
            (
                section.fields.find((field) => field.id === id)?.typeConfig as {
                    options: { value: string }[];
                }
            ).options.map((option) => option.value);

        // Assert
        expect(optionsOf('policies.paymentMethods')).toEqual([...LISTING_PAYMENT_METHODS]);
        expect(optionsOf('policies.pets.admission')).toEqual([...LISTING_PET_ADMISSION_VALUES]);
        expect(optionsOf('policies.smokingAllowed')).toEqual([...LISTING_SMOKING_VALUES]);
        expect(section.fields.find((f) => f.id === 'policies.paymentMethods')?.type).toBe(
            FieldTypeEnum.SELECT_MULTIPLE
        );
    });

    it('bounds the stay to the schema range', () => {
        // Act
        const { section } = createListingPoliciesSection({ vertical: 'accommodation', t });

        // Assert
        for (const id of ['policies.minNights', 'policies.maxNights']) {
            expect(section.fields.find((field) => field.id === id)?.typeConfig).toMatchObject({
                min: 1,
                max: 365
            });
        }
    });

    it('uses the vertical permissions', () => {
        // Act
        const venue = createListingPoliciesSection({ vertical: 'venue', t }).section;
        const accommodation = createListingPoliciesSection({
            vertical: 'accommodation',
            t
        }).section;

        // Assert
        expect(venue.permissions?.edit).toEqual([
            PermissionEnum.VENUE_EDIT_OWN,
            PermissionEnum.VENUE_EDIT_ALL
        ]);
        expect(accommodation.permissions?.edit).toEqual([
            PermissionEnum.ACCOMMODATION_AMENITIES_EDIT
        ]);
    });

    it('labels the closed values with the shared listing.policies i18n keys', () => {
        // Arrange
        const { section } = createListingPoliciesSection({ vertical: 'venue', t });
        const labelsOf = (id: string) =>
            (
                section.fields.find((field) => field.id === id)?.typeConfig as {
                    options: { label: string }[];
                }
            ).options.map((option) => option.label);

        // Assert
        expect(labelsOf('policies.paymentMethods')).toEqual(
            LISTING_PAYMENT_METHODS.map((value) => `listing.policies.paymentMethods.${value}`)
        );
        expect(labelsOf('policies.pets.admission')).toEqual(
            LISTING_PET_ADMISSION_VALUES.map((value) => `listing.policies.pets.admission.${value}`)
        );
        expect(labelsOf('policies.smokingAllowed')).toEqual(
            LISTING_SMOKING_VALUES.map((value) => `listing.policies.smokingAllowed.${value}`)
        );
    });
});
