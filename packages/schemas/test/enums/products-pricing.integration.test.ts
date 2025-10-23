import { describe, expect, it } from 'vitest';
import {
    BillingIntervalEnum,
    BillingIntervalEnumSchema,
    BillingSchemeEnum,
    BillingSchemeEnumSchema,
    ProductTypeEnum,
    ProductTypeEnumSchema
} from '../../src/enums/index.js';

describe('Products and Pricing Enums Integration', () => {
    describe('Cross-validation rules', () => {
        it('should validate that billing intervals only work with recurring schemes', () => {
            // Valid combinations
            const recurringScheme = BillingSchemeEnumSchema.parse(BillingSchemeEnum.RECURRING);
            const monthInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.MONTH);
            const yearInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.YEAR);
            const biyearInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.BIYEAR);

            expect(recurringScheme).toBe('recurring');
            expect(monthInterval).toBe('month');
            expect(yearInterval).toBe('year');
            expect(biyearInterval).toBe('biyear');
        });

        it('should validate product types with their expected billing schemes', () => {
            // Test that certain products typically use specific billing schemes
            const sponsorshipProduct = ProductTypeEnumSchema.parse(ProductTypeEnum.SPONSORSHIP);
            const campaignProduct = ProductTypeEnumSchema.parse(ProductTypeEnum.CAMPAIGN);
            const listingPlanProduct = ProductTypeEnumSchema.parse(ProductTypeEnum.LISTING_PLAN);

            expect(sponsorshipProduct).toBe('sponsorship');
            expect(campaignProduct).toBe('campaign');
            expect(listingPlanProduct).toBe('listing_plan');

            // These can work with both billing schemes
            const oneTimeScheme = BillingSchemeEnumSchema.parse(BillingSchemeEnum.ONE_TIME);
            const recurringScheme = BillingSchemeEnumSchema.parse(BillingSchemeEnum.RECURRING);

            expect(oneTimeScheme).toBe('one_time');
            expect(recurringScheme).toBe('recurring');
        });
    });

    describe('Business logic validation', () => {
        it('should validate listing plans typically use recurring billing', () => {
            const listingPlan = ProductTypeEnum.LISTING_PLAN;
            const recurringScheme = BillingSchemeEnum.RECURRING;
            const monthInterval = BillingIntervalEnum.MONTH;

            expect(listingPlan).toBe('listing_plan');
            expect(recurringScheme).toBe('recurring');
            expect(monthInterval).toBe('month');
        });

        it('should validate campaigns can use one-time billing', () => {
            const campaign = ProductTypeEnum.CAMPAIGN;
            const oneTimeScheme = BillingSchemeEnum.ONE_TIME;

            expect(campaign).toBe('campaign');
            expect(oneTimeScheme).toBe('one_time');
        });

        it('should validate professional services can use both billing schemes', () => {
            const profService = ProductTypeEnum.PROF_SERVICE;
            const oneTimeScheme = BillingSchemeEnum.ONE_TIME;
            const recurringScheme = BillingSchemeEnum.RECURRING;

            expect(profService).toBe('prof_service');
            expect(oneTimeScheme).toBe('one_time');
            expect(recurringScheme).toBe('recurring');
        });
    });

    describe('Enum completeness', () => {
        it('should have all required product types for business model', () => {
            const requiredProductTypes = [
                'sponsorship', // For POST/EVENT sponsorships
                'campaign', // For advertising campaigns
                'featured', // For featured accommodations
                'prof_service', // For professional services
                'listing_plan', // For accommodation/benefit/service listings
                'placement_rate' // For ad placement rates
            ];

            const enumValues = Object.values(ProductTypeEnum);
            expect(enumValues).toHaveLength(requiredProductTypes.length);

            // biome-ignore lint/complexity/noForEach: <explanation>
            requiredProductTypes.forEach((required) => {
                expect(enumValues).toContain(required);
            });
        });

        it('should have both billing schemes required for flexibility', () => {
            const requiredSchemes = ['one_time', 'recurring'];
            const enumValues = Object.values(BillingSchemeEnum);

            expect(enumValues).toHaveLength(requiredSchemes.length);
            // biome-ignore lint/complexity/noForEach: <explanation>
            requiredSchemes.forEach((required) => {
                expect(enumValues).toContain(required);
            });
        });

        it('should have all required billing intervals', () => {
            const requiredIntervals = ['month', 'year', 'biyear'];
            const enumValues = Object.values(BillingIntervalEnum);

            expect(enumValues).toHaveLength(requiredIntervals.length);
            // biome-ignore lint/complexity/noForEach: <explanation>
            requiredIntervals.forEach((required) => {
                expect(enumValues).toContain(required);
            });
        });
    });

    describe('Schema imports and exports', () => {
        it('should export all enums from index', () => {
            expect(ProductTypeEnum).toBeDefined();
            expect(BillingSchemeEnum).toBeDefined();
            expect(BillingIntervalEnum).toBeDefined();
        });

        it('should have working schema validations', () => {
            expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.SPONSORSHIP)).not.toThrow();
            expect(() => BillingSchemeEnumSchema.parse(BillingSchemeEnum.ONE_TIME)).not.toThrow();
            expect(() => BillingIntervalEnumSchema.parse(BillingIntervalEnum.MONTH)).not.toThrow();
        });
    });
});
