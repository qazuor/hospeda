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
        const { section } = createListingPoliciesSection({ vertical });

        // Assert
        expect(section.id).toBe('listing-policies');
        expect(section.fields.map((field) => field.id)).toEqual(expected);
    });

    it('never exposes the venue night keys, which belong to nightInfo', () => {
        // Act
        const ids = createListingPoliciesSection({ vertical: 'venue' }).section.fields.map(
            (field) => field.id
        );

        // Assert
        for (const key of ['minAge', 'dressCode', 'dressCodeNote']) {
            expect(ids).not.toContain(`policies.${key}`);
        }
    });

    it('keeps every field optional', () => {
        // Act
        const { section } = createListingPoliciesSection({ vertical: 'accommodation' });

        // Assert
        expect(section.fields.every((field) => field.required === false)).toBe(true);
    });

    it('offers exactly the schema values in the closed selects', () => {
        // Arrange
        const { section } = createListingPoliciesSection({ vertical: 'venue' });
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
        const { section } = createListingPoliciesSection({ vertical: 'accommodation' });

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
        const venue = createListingPoliciesSection({ vertical: 'venue' }).section;
        const accommodation = createListingPoliciesSection({ vertical: 'accommodation' }).section;

        // Assert
        expect(venue.permissions?.edit).toEqual([
            PermissionEnum.VENUE_EDIT_OWN,
            PermissionEnum.VENUE_EDIT_ALL
        ]);
        expect(accommodation.permissions?.edit).toEqual([
            PermissionEnum.ACCOMMODATION_AMENITIES_EDIT
        ]);
    });
});
