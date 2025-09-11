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
 * EventLocation fixtures for testing
 */

/**
 * Create invalid coordinates for testing
 */
const createInvalidCoordinates = () => ({
    lat: 'invalid-latitude',
    long: 'invalid-longitude'
});

/**
 * Create base location fields directly (not nested)
 */
const createDirectLocationFields = () => ({
    state: faker.location.state().slice(0, 50),
    zipCode: faker.location.zipCode().slice(0, 20),
    country: faker.location.country().slice(0, 50),
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
    neighborhood: faker.location.county().slice(0, 50),
    city: faker.location.city().slice(0, 50),
    department: faker.location.state().slice(0, 50),
    placeName: faker.company.name().slice(0, 100)
});

export const createValidEventLocation = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createEventLocationEntityFields(),
    ...createBaseLifecycleFields(),
    ...createDirectLocationFields(),
    ...createBaseAdminFields()
});

export const createMinimalEventLocation = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createDirectLocationFields()
});

export const createComplexEventLocation = () => ({
    ...createValidEventLocation(),
    street: faker.location.streetAddress(),
    number: faker.location.buildingNumber(),
    floor: '5',
    apartment: 'A',
    neighborhood: faker.location.county(),
    city: faker.location.city(),
    department: faker.location.state(),
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
    neighborhood: createTooLongString(100),
    city: createTooLongString(100),
    department: createTooLongString(100),
    placeName: createTooLongString(200)
});

export const createEventLocationEdgeCases = () => [
    // Minimal with only required fields
    createMinimalEventLocation(),

    // With all optional fields
    createComplexEventLocation(),

    // With undefined optional strings (should be valid)
    {
        ...createMinimalEventLocation(),
        street: undefined,
        number: undefined,
        floor: undefined,
        apartment: undefined,
        neighborhood: undefined,
        city: undefined,
        department: undefined,
        placeName: undefined
    },

    // With minimum length strings
    {
        ...createMinimalEventLocation(),
        street: 'AB',
        number: '1',
        floor: '1',
        apartment: '1',
        neighborhood: 'AB',
        city: 'AB',
        department: 'AB',
        placeName: 'AB'
    },

    // With maximum length strings
    {
        ...createMinimalEventLocation(),
        street: 'A'.repeat(50),
        number: '1'.repeat(10),
        floor: '1'.repeat(10),
        apartment: 'A'.repeat(10),
        neighborhood: 'A'.repeat(50),
        city: 'A'.repeat(50),
        department: 'A'.repeat(50),
        placeName: 'A'.repeat(100)
    }
];

export const createEventLocationInvalidCases = () => [
    // Invalid string lengths - too short
    {
        ...createMinimalEventLocation(),
        street: createTooShortString(),
        neighborhood: createTooShortString(),
        city: createTooShortString(),
        department: createTooShortString(),
        placeName: createTooShortString()
    },

    // Invalid string lengths - too long
    {
        ...createMinimalEventLocation(),
        street: createTooLongString(60),
        number: createTooLongString(20),
        floor: createTooLongString(20),
        apartment: createTooLongString(20),
        neighborhood: createTooLongString(60),
        city: createTooLongString(60),
        department: createTooLongString(60),
        placeName: createTooLongString(120)
    },

    // Invalid coordinates
    {
        ...createMinimalEventLocation(),
        coordinates: createInvalidCoordinates()
    }
];
