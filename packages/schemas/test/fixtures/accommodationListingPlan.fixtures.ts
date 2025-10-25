import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields
} from './common.fixtures.js';

/**
 * AccommodationListingPlan fixtures for testing
 */

/**
 * Create accommodation listing plan specific entity fields
 */
const createAccommodationListingPlanEntityFields = () => ({
    name: faker.commerce.productName(),
    limits: {
        maxListings: faker.number.int({ min: 1, max: 100 }),
        includedFeatures: faker.helpers.arrayElements(
            ['analytics', 'priority_support', 'custom_branding'],
            { min: 1, max: 3 }
        ),
        maxPhotos: faker.number.int({ min: 5, max: 50 }),
        maxDescriptionLength: faker.number.int({ min: 500, max: 5000 }),
        allowContactInfo: faker.datatype.boolean(),
        priorityPlacement: faker.datatype.boolean()
    }
});

export const createValidAccommodationListingPlan = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAccommodationListingPlanEntityFields(),
    ...createBaseAdminFields()
});

export const createMinimalAccommodationListingPlan = () => ({
    id: faker.string.uuid(),
    name: 'Basic Plan',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexAccommodationListingPlan = () => ({
    ...createValidAccommodationListingPlan(),
    name: 'Premium Enterprise Plan',
    limits: {
        maxListings: 1000,
        includedFeatures: [
            'analytics',
            'priority_support',
            'custom_branding',
            'api_access',
            'bulk_operations'
        ],
        maxPhotos: 100,
        maxDescriptionLength: 10000,
        allowContactInfo: true,
        priorityPlacement: true,
        customIntegrations: true,
        dedicatedSupport: true,
        advancedAnalytics: true,
        multiLanguageSupport: true
    },
    adminInfo: {
        notes: faker.lorem.paragraph(),
        planTier: 'enterprise',
        isSpecialOffer: false,
        effectiveDate: faker.date.past().toISOString()
    }
});

export const createInvalidAccommodationListingPlan = () => ({
    // Missing required fields and invalid values
    id: 'invalid-id',
    name: '', // too short
    limits: 'invalid-json-structure', // should be object
    createdAt: 'invalid-date'
});

export const createAccommodationListingPlanEdgeCases = () => ({
    ...createValidAccommodationListingPlan(),
    name: 'A'.repeat(150), // too long
    limits: null // invalid limits
});

export const createBasicAccommodationListingPlan = () => ({
    ...createMinimalAccommodationListingPlan(),
    name: 'Basic Plan',
    limits: {
        maxListings: 1,
        maxPhotos: 5,
        maxDescriptionLength: 500,
        allowContactInfo: false,
        priorityPlacement: false
    }
});

export const createPremiumAccommodationListingPlan = () => ({
    ...createValidAccommodationListingPlan(),
    name: 'Premium Plan',
    limits: {
        maxListings: 10,
        includedFeatures: ['analytics', 'priority_support'],
        maxPhotos: 25,
        maxDescriptionLength: 2000,
        allowContactInfo: true,
        priorityPlacement: true
    }
});

export const createEnterpriseAccommodationListingPlan = () => ({
    ...createValidAccommodationListingPlan(),
    name: 'Enterprise Plan',
    limits: {
        maxListings: -1, // unlimited
        includedFeatures: ['analytics', 'priority_support', 'custom_branding', 'api_access'],
        maxPhotos: 100,
        maxDescriptionLength: 10000,
        allowContactInfo: true,
        priorityPlacement: true,
        customIntegrations: true,
        dedicatedSupport: true
    }
});

export const createAccommodationListingPlanWithCustomLimits = (
    customLimits: Record<string, unknown>
) => ({
    ...createValidAccommodationListingPlan(),
    limits: {
        ...createAccommodationListingPlanEntityFields().limits,
        ...customLimits
    }
});
