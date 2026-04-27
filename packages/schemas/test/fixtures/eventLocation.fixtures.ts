import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * EventLocation fixtures for testing.
 *
 * Post SPEC-095: geographic context (city, state, country) is removed from
 * eventLocation. Geography lives on the destination relation accessed via
 * `destinationId`. Fixtures only generate the postal-address fields plus the
 * required FK.
 */

/**
 * Create invalid coordinates for testing
 */
const createInvalidCoordinates = () => ({
    lat: 'invalid-latitude',
    long: 'invalid-longitude'
});

/**
 * Create a valid slug for event location
 */
const createValidSlug = () => {
    const words = faker.lorem.words(3).toLowerCase().replace(/\s+/g, '-');
    return words.replace(/[^a-z0-9-]/g, '').slice(0, 100);
};

/**
 * Create the postal-address + destinationId block (SPEC-095).
 */
const createAddressFields = () => ({
    destinationId: faker.string.uuid(),
    coordinates: {
        lat: faker.location.latitude().toString(),
        long: faker.location.longitude().toString()
    }
});

/**
 * Create event location-specific entity fields
 */
const createEventLocationEntityFields = () => ({
    street: faker.location.streetAddress().slice(0, 50),
    number: faker.location.buildingNumber().slice(0, 10),
    floor: faker.number.int({ min: 1, max: 20 }).toString(),
    apartment: faker.string.alphanumeric(5),
    placeName: faker.company.name().slice(0, 100)
});

export const createValidEventLocation = () => ({
    ...createBaseIdFields(),
    slug: createValidSlug(),
    ...createBaseAuditFields(),
    ...createEventLocationEntityFields(),
    ...createBaseLifecycleFields(),
    ...createAddressFields(),
    ...createBaseAdminFields()
});

export const createMinimalEventLocation = () => ({
    ...createBaseIdFields(),
    slug: createValidSlug(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createAddressFields()
});

export const createComplexEventLocation = () => ({
    ...createValidEventLocation(),
    street: faker.location.streetAddress(),
    number: faker.location.buildingNumber(),
    floor: '5',
    apartment: 'A',
    placeName: faker.company.name()
});

export const createInvalidEventLocation = () => ({
    ...createValidEventLocation(),
    // Invalid coordinates
    coordinates: createInvalidCoordinates(),
    // Invalid string lengths
    street: createTooLongString(100),
    number: createTooLongString(20),
    floor: createTooLongString(20),
    apartment: createTooLongString(20),
    placeName: createTooLongString(200)
});

export const createEventLocationEdgeCases = () => [
    // Minimal with only required fields
    createMinimalEventLocation(),

    // With all optional fields
    createComplexEventLocation(),

    // With undefined optional strings (postal address fields)
    {
        ...createMinimalEventLocation(),
        street: undefined,
        number: undefined,
        floor: undefined,
        apartment: undefined,
        placeName: undefined
    },

    // With minimum length strings
    {
        ...createMinimalEventLocation(),
        slug: 'ab',
        street: 'AB',
        number: '1',
        floor: '1',
        apartment: '1',
        placeName: 'AB'
    },

    // With maximum length strings
    {
        ...createMinimalEventLocation(),
        slug: 'a'.repeat(100),
        street: 'A'.repeat(50),
        number: '1'.repeat(10),
        floor: '1'.repeat(10),
        apartment: 'A'.repeat(10),
        placeName: 'A'.repeat(100)
    }
];

export const createEventLocationInvalidCases = () => [
    // Invalid string lengths - too short
    {
        ...createMinimalEventLocation(),
        street: createTooShortString(),
        placeName: createTooShortString()
    },

    // Invalid string lengths - too long
    {
        ...createMinimalEventLocation(),
        street: createTooLongString(60),
        number: createTooLongString(20),
        floor: createTooLongString(20),
        apartment: createTooLongString(20),
        placeName: createTooLongString(120)
    },

    // Invalid coordinates
    {
        ...createMinimalEventLocation(),
        coordinates: createInvalidCoordinates()
    },

    // Missing required destinationId
    (() => {
        const { destinationId: _id, ...rest } = createMinimalEventLocation();
        return rest;
    })()
];
