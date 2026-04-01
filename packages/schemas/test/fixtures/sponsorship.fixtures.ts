import { faker } from '@faker-js/faker';
import type { SponsorshipStatusEnum, SponsorshipTargetTypeEnum } from '../../src/enums/index.js';
import { createBaseAuditFields, createBaseIdFields } from './common.fixtures.js';

/**
 * Sponsorship fixtures for testing
 */

const VALID_STATUS_VALUES: SponsorshipStatusEnum[] = [
    'pending' as SponsorshipStatusEnum,
    'active' as SponsorshipStatusEnum,
    'expired' as SponsorshipStatusEnum,
    'cancelled' as SponsorshipStatusEnum
];

const VALID_TARGET_TYPE_VALUES: SponsorshipTargetTypeEnum[] = [
    'event' as SponsorshipTargetTypeEnum,
    'post' as SponsorshipTargetTypeEnum
];

/**
 * Create analytics sub-object for sponsorship
 */
const createSponsorshipAnalytics = () => ({
    impressions: faker.number.int({ min: 0, max: 100000 }),
    clicks: faker.number.int({ min: 0, max: 10000 }),
    couponsUsed: faker.number.int({ min: 0, max: 1000 })
});

/**
 * Create sponsorship-specific entity fields
 */
const createSponsorshipEntityFields = () => ({
    slug: faker.lorem.slug(3),
    sponsorUserId: faker.string.uuid(),
    targetType: faker.helpers.arrayElement(VALID_TARGET_TYPE_VALUES),
    targetId: faker.string.uuid(),
    levelId: faker.string.uuid(),
    packageId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.5 }),
    status: faker.helpers.arrayElement(VALID_STATUS_VALUES),
    startsAt: faker.date.past(),
    endsAt: faker.helpers.maybe(() => faker.date.future(), { probability: 0.6 }),
    paymentId: faker.helpers.maybe(() => faker.string.alphanumeric(20), { probability: 0.7 }),
    logoUrl: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }),
    linkUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.7 }),
    couponCode: faker.helpers.maybe(() => faker.string.alphanumeric(10).toUpperCase(), {
        probability: 0.5
    }),
    couponDiscountPercent: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 100 }), {
        probability: 0.5
    }),
    analytics: createSponsorshipAnalytics()
});

/**
 * Create a complete valid sponsorship with all fields
 */
export const createValidSponsorship = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createSponsorshipEntityFields()
});

/**
 * Create a minimal sponsorship with only required fields
 */
export const createMinimalSponsorship = () => ({
    id: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid(),
    slug: faker.lorem.slug(2),
    sponsorUserId: faker.string.uuid(),
    targetType: 'event' as SponsorshipTargetTypeEnum,
    targetId: faker.string.uuid(),
    levelId: faker.string.uuid(),
    status: 'pending' as SponsorshipStatusEnum,
    startsAt: faker.date.past(),
    analytics: {
        impressions: 0,
        clicks: 0,
        couponsUsed: 0
    }
});

/**
 * Create valid input for sponsorship creation (no id, audit fields, or analytics)
 */
export const createSponsorshipCreateInput = () => ({
    sponsorUserId: faker.string.uuid(),
    targetType: faker.helpers.arrayElement(VALID_TARGET_TYPE_VALUES),
    targetId: faker.string.uuid(),
    levelId: faker.string.uuid(),
    packageId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.4 }),
    status: faker.helpers.arrayElement(VALID_STATUS_VALUES),
    startsAt: faker.date.past(),
    endsAt: faker.helpers.maybe(() => faker.date.future(), { probability: 0.5 }),
    paymentId: faker.helpers.maybe(() => faker.string.alphanumeric(20), { probability: 0.6 }),
    logoUrl: faker.helpers.maybe(() => faker.image.url(), { probability: 0.6 }),
    linkUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.6 }),
    couponCode: faker.helpers.maybe(() => faker.string.alphanumeric(10).toUpperCase(), {
        probability: 0.4
    }),
    couponDiscountPercent: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 100 }), {
        probability: 0.4
    })
});

/**
 * Create valid input for sponsorship update (all fields optional, partial)
 */
export const createSponsorshipUpdateInput = () => ({
    status: faker.helpers.maybe(() => faker.helpers.arrayElement(VALID_STATUS_VALUES), {
        probability: 0.5
    }),
    endsAt: faker.helpers.maybe(() => faker.date.future(), { probability: 0.4 }),
    logoUrl: faker.helpers.maybe(() => faker.image.url(), { probability: 0.4 }),
    linkUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.4 }),
    couponCode: faker.helpers.maybe(() => faker.string.alphanumeric(10).toUpperCase(), {
        probability: 0.3
    }),
    couponDiscountPercent: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 100 }), {
        probability: 0.3
    })
});
