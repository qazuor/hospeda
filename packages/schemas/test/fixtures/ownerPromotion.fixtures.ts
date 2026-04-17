import { faker } from '@faker-js/faker';
import { LifecycleStatusEnum } from '../../src/enums/lifecycle-state.enum.js';
import { OwnerPromotionDiscountTypeEnum } from '../../src/enums/owner-promotion-discount-type.enum.js';
import { createBaseAuditFields, createBaseIdFields } from './common.fixtures.js';

/**
 * OwnerPromotion fixtures for testing
 */

const DISCOUNT_TYPES = Object.values(OwnerPromotionDiscountTypeEnum);

/**
 * Creates owner-promotion-specific entity fields (without id and audit fields).
 */
const createOwnerPromotionEntityFields = () => {
    const discountType = faker.helpers.arrayElement(DISCOUNT_TYPES);
    const discountValue =
        discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE
            ? faker.number.float({ min: 1, max: 80, fractionDigits: 2 })
            : discountType === OwnerPromotionDiscountTypeEnum.FIXED
              ? faker.number.float({ min: 10, max: 500, fractionDigits: 2 })
              : faker.number.int({ min: 1, max: 5 }); // free_night: integer nights

    const validFrom = faker.date.recent({ days: 30 });
    const validUntil = faker.helpers.maybe(
        () => faker.date.future({ years: 1, refDate: validFrom }),
        {
            probability: 0.7
        }
    );

    return {
        slug: `promo-${faker.lorem.slug(3)}`,
        ownerId: faker.string.uuid(),
        accommodationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.8 }),
        title: faker.lorem.words({ min: 3, max: 8 }).slice(0, 100),
        description: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 500), {
            probability: 0.7
        }),
        discountType,
        discountValue,
        minNights: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 14 }), {
            probability: 0.6
        }),
        validFrom,
        validUntil,
        maxRedemptions: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 1000 }), {
            probability: 0.6
        }),
        currentRedemptions: faker.number.int({ min: 0, max: 50 }),
        lifecycleState: faker.helpers.arrayElement([
            LifecycleStatusEnum.DRAFT,
            LifecycleStatusEnum.ACTIVE,
            LifecycleStatusEnum.ARCHIVED
        ])
    };
};

/**
 * Creates a complete valid OwnerPromotion object (full entity with id and audit fields).
 */
export const createValidOwnerPromotion = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createOwnerPromotionEntityFields()
});

/**
 * Creates a minimal valid OwnerPromotion with only required fields.
 * Uses fixed values to guarantee deterministic validity.
 */
export const createMinimalOwnerPromotion = () => ({
    id: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid(),
    slug: 'summer-deal-2024',
    ownerId: faker.string.uuid(),
    title: 'Summer Special Discount',
    discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
    discountValue: 20,
    validFrom: new Date('2024-06-01'),
    currentRedemptions: 0,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});

/**
 * Creates a valid OwnerPromotion create input (no id, no auto-generated fields).
 */
export const createOwnerPromotionCreateInput = () => {
    const discountType = faker.helpers.arrayElement(DISCOUNT_TYPES);
    const discountValue =
        discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE
            ? faker.number.float({ min: 5, max: 60, fractionDigits: 2 })
            : faker.number.float({ min: 10, max: 300, fractionDigits: 2 });

    return {
        ownerId: faker.string.uuid(),
        accommodationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.8 }),
        title: faker.lorem.words({ min: 3, max: 6 }).slice(0, 100),
        description: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 500), {
            probability: 0.6
        }),
        discountType,
        discountValue,
        minNights: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 10 }), {
            probability: 0.5
        }),
        validFrom: faker.date.recent({ days: 10 }),
        validUntil: faker.helpers.maybe(() => faker.date.future({ years: 1 }), {
            probability: 0.7
        }),
        maxRedemptions: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 500 }), {
            probability: 0.5
        }),
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
};

/**
 * Creates a valid partial OwnerPromotion update input.
 */
export const createOwnerPromotionUpdateInput = () => ({
    title: faker.lorem.words({ min: 3, max: 6 }).slice(0, 100),
    description: faker.lorem.paragraph().slice(0, 500),
    lifecycleState: faker.helpers.arrayElement([
        LifecycleStatusEnum.DRAFT,
        LifecycleStatusEnum.ACTIVE,
        LifecycleStatusEnum.ARCHIVED
    ]),
    discountValue: faker.number.float({ min: 1, max: 50, fractionDigits: 2 })
});

/**
 * Creates an OwnerPromotion with a PERCENTAGE discount type.
 */
export const createPercentagePromotion = () => ({
    ...createValidOwnerPromotion(),
    discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
    discountValue: 25
});

/**
 * Creates an OwnerPromotion with a FIXED discount type.
 */
export const createFixedPromotion = () => ({
    ...createValidOwnerPromotion(),
    discountType: OwnerPromotionDiscountTypeEnum.FIXED,
    discountValue: 100
});

/**
 * Creates an OwnerPromotion with a FREE_NIGHT discount type.
 */
export const createFreeNightPromotion = () => ({
    ...createValidOwnerPromotion(),
    discountType: OwnerPromotionDiscountTypeEnum.FREE_NIGHT,
    discountValue: 1
});

/**
 * Creates multiple valid OwnerPromotions for array-based tests.
 */
export const createMultipleOwnerPromotions = (count = 5) =>
    Array.from({ length: count }, () => createValidOwnerPromotion());
