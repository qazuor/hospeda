import { faker } from '@faker-js/faker';
import { ListingStatusEnum } from '../../src/enums/listing-status.enum.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields
} from './common.fixtures.js';

/**
 * AccommodationListing fixtures for testing
 */

/**
 * Create accommodation listing specific entity fields
 */
const createAccommodationListingEntityFields = () => ({
    clientId: faker.string.uuid(),
    accommodationId: faker.string.uuid(),
    listingPlanId: faker.string.uuid(),
    fromDate: faker.date.future().toISOString(),
    toDate: faker.date.future({ years: 1 }).toISOString(),
    trialEndsAt: faker.datatype.boolean()
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    isTrial: faker.datatype.boolean(),
    status: faker.helpers.enumValue(ListingStatusEnum)
});

export const createValidAccommodationListing = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAccommodationListingEntityFields(),
    ...createBaseAdminFields()
});

export const createMinimalAccommodationListing = () => ({
    id: faker.string.uuid(),
    clientId: faker.string.uuid(),
    accommodationId: faker.string.uuid(),
    listingPlanId: faker.string.uuid(),
    fromDate: new Date().toISOString(),
    toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days later
    isTrial: false,
    status: ListingStatusEnum.ACTIVE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexAccommodationListing = () => ({
    ...createValidAccommodationListing(),
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isTrial: true,
    status: ListingStatusEnum.TRIAL,
    adminInfo: {
        notes: faker.lorem.paragraph(),
        approvalStatus: 'approved',
        reviewedBy: faker.string.uuid(),
        reviewedAt: faker.date.past().toISOString()
    }
});

export const createInvalidAccommodationListing = () => ({
    // Missing required fields and invalid values
    id: 'invalid-id',
    clientId: 'invalid-client-id',
    accommodationId: '',
    listingPlanId: null,
    fromDate: 'invalid-date',
    toDate: 'invalid-date',
    isTrial: 'not-boolean',
    status: 'INVALID_STATUS'
});

export const createAccommodationListingEdgeCases = () => ({
    ...createValidAccommodationListing(),
    fromDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days later
    toDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(), // 50 days later (invalid: toDate before fromDate)
    isTrial: true,
    trialEndsAt: undefined // invalid: trial but no trial end date
});

export const createAccommodationListingWithValidDates = () => ({
    ...createValidAccommodationListing(),
    fromDate: new Date().toISOString(),
    toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isTrial: true,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
});

export const createAccommodationListingWithInvalidDates = () => ({
    ...createValidAccommodationListing(),
    fromDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    toDate: new Date().toISOString() // toDate before fromDate
});
