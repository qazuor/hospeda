import { faker } from '@faker-js/faker';
import { GastronomyTypeEnum } from '../../src/enums/index.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseMediaFields,
    createBaseModerationFields,
    createBaseReviewFields,
    createBaseSeoFields,
    createBaseTagsFields,
    createBaseVisibilityFields
} from './common.fixtures.js';

/**
 * Gastronomy fixtures for testing
 */

/**
 * Creates gastronomy-specific identity fields matching CommerceIdentityFields.
 */
const createGastronomyIdentityFields = () => ({
    slug: faker.lorem.slug(3),
    name: faker.company.name().slice(0, 100),
    summary: faker.lorem.paragraph().slice(0, 300),
    description: faker.lorem.paragraphs(2).slice(0, 2000),
    richDescription: faker.helpers.maybe(() => faker.lorem.paragraphs(3), { probability: 0.5 }),
    nameI18n: undefined,
    summaryI18n: undefined,
    descriptionI18n: undefined,
    richDescriptionI18n: undefined,
    translationMeta: undefined
});

/**
 * Creates opening hours in the expected schema format.
 */
const createOpeningHoursFields = () => ({
    openingHours: faker.helpers.maybe(
        () => ({
            timezone: 'America/Argentina/Buenos_Aires',
            days: {
                mon: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                tue: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                wed: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                thu: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                fri: { closed: false, shifts: [{ open: '09:00', close: '23:59' }] },
                sat: { closed: false, shifts: [{ open: '10:00', close: '23:59' }] },
                sun: { closed: true, shifts: [] }
            }
        }),
        { probability: 0.7 }
    )
});

/**
 * Creates a commerce rating (food/service/ambiance/value).
 */
const createCommerceRating = () => ({
    food: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
    service: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
    ambiance: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
    value: faker.number.float({ min: 1, max: 5, fractionDigits: 1 })
});

/**
 * Creates a valid gastronomy fixture with all required and optional fields.
 * Note: socialNetworks is intentionally omitted because the shared fixture helper
 * produces placeholder URLs (e.g. "https://facebook.com/example") that may not
 * pass the schema's strict regex validation for each platform pattern.
 */
export const createValidGastronomy = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createGastronomyIdentityFields(),
    type: faker.helpers.arrayElement(Object.values(GastronomyTypeEnum)),
    priceRange: faker.helpers.maybe(
        () => faker.helpers.arrayElement(['BUDGET', 'MID', 'HIGH', 'PREMIUM'] as const),
        { probability: 0.8 }
    ),
    menuUrl: faker.helpers.maybe(() => `https://${faker.internet.domainName()}/menu`, {
        probability: 0.5
    }),
    destinationId: faker.string.uuid(),
    ownerId: faker.string.uuid(),
    isFeatured: faker.datatype.boolean({ probability: 0.2 }),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseReviewFields(),
    ...createBaseSeoFields(),
    ...createBaseContactFields(),
    // socialNetworks intentionally omitted — strict regex per platform
    ...createOpeningHoursFields(),
    ...createBaseMediaFields(),
    ...createBaseAdminFields(),
    ...createBaseTagsFields(),
    rating: faker.helpers.maybe(() => createCommerceRating(), { probability: 0.7 }),
    faqs: undefined
});

/**
 * Creates a minimal gastronomy with only required fields.
 */
export const createMinimalGastronomy = () => ({
    id: faker.string.uuid(),
    slug: 'parrilla-de-juan',
    name: 'La Parrilla de Juan',
    summary: 'Parrilla tradicional argentina',
    description: faker.lorem.paragraphs(2).slice(0, 2000),
    type: GastronomyTypeEnum.PARRILLA,
    destinationId: faker.string.uuid(),
    ownerId: faker.string.uuid(),
    isFeatured: false,
    lifecycleState: 'DRAFT',
    moderationState: 'PENDING',
    visibility: 'PRIVATE',
    reviewsCount: 0,
    averageRating: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: faker.string.uuid(),
    updatedById: null
});

/**
 * Creates an invalid gastronomy (missing required fields + bad values).
 */
export const createInvalidGastronomy = () => ({
    id: 'not-a-uuid',
    name: '', // Too short
    type: 'INVALID_TYPE', // Not in enum
    menuUrl: 'http://insecure.com/menu', // must be https
    destinationId: 'not-a-uuid',
    ownerId: 'not-a-uuid'
});
