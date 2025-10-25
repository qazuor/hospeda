import { faker } from '@faker-js/faker';
import { FeaturedStatusEnum } from '../../src/enums/featured-status.enum.js';
import { FeaturedTypeEnum } from '../../src/enums/featured-type.enum.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields
} from './common.fixtures.js';

/**
 * FeaturedAccommodation fixtures for testing
 */

/**
 * Create featured accommodation specific entity fields
 */
const createFeaturedAccommodationEntityFields = () => ({
    clientId: faker.string.uuid(),
    accommodationId: faker.string.uuid(),
    featuredType: faker.helpers.enumValue(FeaturedTypeEnum),
    fromDate: faker.date.future().toISOString(),
    toDate: faker.date.future({ years: 1 }).toISOString(),
    status: faker.helpers.enumValue(FeaturedStatusEnum)
});

export const createValidFeaturedAccommodation = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createFeaturedAccommodationEntityFields(),
    ...createBaseAdminFields()
});

export const createMinimalFeaturedAccommodation = () => ({
    id: faker.string.uuid(),
    clientId: faker.string.uuid(),
    accommodationId: faker.string.uuid(),
    featuredType: FeaturedTypeEnum.HOME,
    fromDate: new Date().toISOString(),
    toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days later
    status: FeaturedStatusEnum.ACTIVE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexFeaturedAccommodation = () => ({
    ...createValidFeaturedAccommodation(),
    featuredType: FeaturedTypeEnum.DESTINATION,
    status: FeaturedStatusEnum.ACTIVE,
    adminInfo: {
        notes: faker.lorem.paragraph(),
        approvalStatus: 'approved',
        reviewedBy: faker.string.uuid(),
        reviewedAt: faker.date.past().toISOString(),
        priority: faker.number.int({ min: 1, max: 10 })
    }
});

export const createInvalidFeaturedAccommodation = () => ({
    // Missing required fields and invalid values
    id: 'invalid-id',
    clientId: 'invalid-client-id',
    accommodationId: '',
    featuredType: 'INVALID_TYPE',
    fromDate: 'invalid-date',
    toDate: 'invalid-date',
    status: 'INVALID_STATUS'
});

export const createFeaturedAccommodationEdgeCases = () => ({
    ...createValidFeaturedAccommodation(),
    fromDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days later
    toDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString() // 50 days later (invalid: toDate before fromDate)
});

export const createFeaturedAccommodationWithValidDates = () => ({
    ...createValidFeaturedAccommodation(),
    fromDate: new Date().toISOString(),
    toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
});

export const createFeaturedAccommodationWithInvalidDates = () => ({
    ...createValidFeaturedAccommodation(),
    fromDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    toDate: new Date().toISOString() // toDate before fromDate
});

export const createFeaturedAccommodationByType = (type: FeaturedTypeEnum) => ({
    ...createValidFeaturedAccommodation(),
    featuredType: type
});

export const createFeaturedAccommodationByStatus = (status: FeaturedStatusEnum) => ({
    ...createValidFeaturedAccommodation(),
    status
});
