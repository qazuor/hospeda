import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { SubscriptionItemEntityTypeEnum } from '../../src/enums/index.js';
import { SubscriptionItemEntityTypeEnumSchema } from '../../src/enums/subscription-item-entity-type.schema.js';

describe('SubscriptionItemEntityTypeEnumSchema', () => {
    it('should validate valid subscription item entity type values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(SubscriptionItemEntityTypeEnum).forEach((entityType) => {
            expect(() => SubscriptionItemEntityTypeEnumSchema.parse(entityType)).not.toThrow();
        });
    });

    it('should validate SPONSORSHIP entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(SubscriptionItemEntityTypeEnum.SPONSORSHIP)
        ).not.toThrow();
    });

    it('should validate CAMPAIGN entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(SubscriptionItemEntityTypeEnum.CAMPAIGN)
        ).not.toThrow();
    });

    it('should validate FEATURED_ACCOMMODATION entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(
                SubscriptionItemEntityTypeEnum.FEATURED_ACCOMMODATION
            )
        ).not.toThrow();
    });

    it('should validate PROFESSIONAL_SERVICE_ORDER entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(
                SubscriptionItemEntityTypeEnum.PROFESSIONAL_SERVICE_ORDER
            )
        ).not.toThrow();
    });

    it('should validate ACCOMMODATION_LISTING entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(
                SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING
            )
        ).not.toThrow();
    });

    it('should validate BENEFIT_LISTING entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(
                SubscriptionItemEntityTypeEnum.BENEFIT_LISTING
            )
        ).not.toThrow();
    });

    it('should validate SERVICE_LISTING entity type', () => {
        expect(() =>
            SubscriptionItemEntityTypeEnumSchema.parse(
                SubscriptionItemEntityTypeEnum.SERVICE_LISTING
            )
        ).not.toThrow();
    });

    it('should reject invalid subscription item entity type values', () => {
        const invalidEntityTypes = [
            'invalid-entity-type',
            'USER', // Not in polymorphic system
            'PRODUCT',
            'INVOICE',
            'PAYMENT',
            'UNKNOWN',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidEntityTypes.forEach((entityType) => {
            expect(() => SubscriptionItemEntityTypeEnumSchema.parse(entityType)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            SubscriptionItemEntityTypeEnumSchema.parse('invalid-entity-type');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe(
                'zodError.enums.subscriptionItemEntityType.invalid'
            );
        }
    });

    it('should infer correct TypeScript type', () => {
        const validEntityType = SubscriptionItemEntityTypeEnumSchema.parse(
            SubscriptionItemEntityTypeEnum.SPONSORSHIP
        );

        // TypeScript should infer this as SubscriptionItemEntityTypeEnum
        expect(typeof validEntityType).toBe('string');
        expect(Object.values(SubscriptionItemEntityTypeEnum)).toContain(validEntityType);
    });

    it('should have all required entity types for polymorphic system', () => {
        const requiredEntityTypes = [
            'sponsorship',
            'campaign',
            'featured_accommodation',
            'professional_service_order',
            'accommodation_listing',
            'benefit_listing',
            'service_listing'
        ];

        const enumValues = Object.values(SubscriptionItemEntityTypeEnum);
        expect(enumValues).toHaveLength(requiredEntityTypes.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredEntityTypes.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support polymorphic entity targeting', () => {
        // Test that entity types work with polymorphic system
        const sponsorshipType = SubscriptionItemEntityTypeEnumSchema.parse(
            SubscriptionItemEntityTypeEnum.SPONSORSHIP
        );
        const campaignType = SubscriptionItemEntityTypeEnumSchema.parse(
            SubscriptionItemEntityTypeEnum.CAMPAIGN
        );
        const featuredType = SubscriptionItemEntityTypeEnumSchema.parse(
            SubscriptionItemEntityTypeEnum.FEATURED_ACCOMMODATION
        );
        const listingType = SubscriptionItemEntityTypeEnumSchema.parse(
            SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING
        );

        expect(sponsorshipType).toBe('sponsorship');
        expect(campaignType).toBe('campaign');
        expect(featuredType).toBe('featured_accommodation');
        expect(listingType).toBe('accommodation_listing');

        // These will be used to determine the target entity of a subscription item
        const entityTypes = [sponsorshipType, campaignType, featuredType, listingType];
        expect(entityTypes).toHaveLength(4);

        // biome-ignore lint/complexity/noForEach: <explanation>
        entityTypes.forEach((entityType) => {
            expect(typeof entityType).toBe('string');
            expect(entityType.length).toBeGreaterThan(0);
        });
    });

    it('should group entity types by business domain', () => {
        // Test business domain groupings
        const marketingTypes = [
            SubscriptionItemEntityTypeEnum.SPONSORSHIP,
            SubscriptionItemEntityTypeEnum.CAMPAIGN,
            SubscriptionItemEntityTypeEnum.FEATURED_ACCOMMODATION
        ];

        const listingTypes = [
            SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING,
            SubscriptionItemEntityTypeEnum.BENEFIT_LISTING,
            SubscriptionItemEntityTypeEnum.SERVICE_LISTING
        ];

        const serviceTypes = [SubscriptionItemEntityTypeEnum.PROFESSIONAL_SERVICE_ORDER];

        expect(marketingTypes).toHaveLength(3);
        expect(listingTypes).toHaveLength(3);
        expect(serviceTypes).toHaveLength(1);

        // All types should be valid
        const allTypes = [...marketingTypes, ...listingTypes, ...serviceTypes];
        // biome-ignore lint/complexity/noForEach: <explanation>
        allTypes.forEach((type) => {
            expect(() => SubscriptionItemEntityTypeEnumSchema.parse(type)).not.toThrow();
        });
    });
});
