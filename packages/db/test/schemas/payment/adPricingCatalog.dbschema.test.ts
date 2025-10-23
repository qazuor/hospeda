import { CampaignChannelEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    adPricingCatalog,
    campaignChannelEnum
} from '../../../src/schemas/payment/adPricingCatalog.dbschema.js';

describe('AdPricingCatalog DB Schema', () => {
    describe('table structure', () => {
        it('should be properly defined as table', () => {
            expect(adPricingCatalog).toBeDefined();
            expect(typeof adPricingCatalog).toBe('object');
        });

        it('should have primary key', () => {
            expect(adPricingCatalog.id).toBeDefined();
        });

        it('should have required ad slot relationship', () => {
            expect(adPricingCatalog.adSlotId).toBeDefined();
            expect(adPricingCatalog.adSlotId.notNull).toBeTruthy();
        });

        it('should have required channel field', () => {
            expect(adPricingCatalog.channel).toBeDefined();
            expect(adPricingCatalog.channel.notNull).toBeTruthy();
        });

        it('should have pricing structure fields', () => {
            expect(adPricingCatalog.basePrice).toBeDefined();
            expect(adPricingCatalog.basePrice.notNull).toBeTruthy();

            expect(adPricingCatalog.currency).toBeDefined();
            expect(adPricingCatalog.currency.default).toBe('USD');

            expect(adPricingCatalog.pricingModel).toBeDefined();
            expect(adPricingCatalog.pricingModel.default).toBe('CPM');
        });

        it('should have time-based pricing fields', () => {
            expect(adPricingCatalog.dailyRate).toBeDefined();
            expect(adPricingCatalog.weeklyRate).toBeDefined();
            expect(adPricingCatalog.monthlyRate).toBeDefined();
        });

        it('should have premium multipliers', () => {
            expect(adPricingCatalog.weekendMultiplier).toBeDefined();
            expect(adPricingCatalog.weekendMultiplier.default).toBe('1.00');

            expect(adPricingCatalog.holidayMultiplier).toBeDefined();
            expect(adPricingCatalog.holidayMultiplier.default).toBe('1.00');
        });

        it('should have budget constraints fields', () => {
            expect(adPricingCatalog.minimumBudget).toBeDefined();
            expect(adPricingCatalog.maximumBudget).toBeDefined();
        });

        it('should have availability fields', () => {
            expect(adPricingCatalog.availableFrom).toBeDefined();
            expect(adPricingCatalog.availableUntil).toBeDefined();
        });

        it('should have pricing configuration field', () => {
            expect(adPricingCatalog.pricingConfig).toBeDefined();
        });

        it('should have catalog metadata fields', () => {
            expect(adPricingCatalog.description).toBeDefined();
            expect(adPricingCatalog.isActive).toBeDefined();
            expect(adPricingCatalog.isActive.default).toBe('true');
        });

        it('should have audit fields', () => {
            expect(adPricingCatalog.createdAt).toBeDefined();
            expect(adPricingCatalog.updatedAt).toBeDefined();
            expect(adPricingCatalog.createdById).toBeDefined();
            expect(adPricingCatalog.updatedById).toBeDefined();
        });

        it('should have soft delete fields', () => {
            expect(adPricingCatalog.deletedAt).toBeDefined();
            expect(adPricingCatalog.deletedById).toBeDefined();
        });
    });

    describe('enum configuration', () => {
        it('should have correct campaign channel enum values', () => {
            expect(campaignChannelEnum.enumValues).toEqual([
                CampaignChannelEnum.WEB,
                CampaignChannelEnum.SOCIAL
            ]);
        });
    });

    describe('business logic validation', () => {
        it('should default to USD currency', () => {
            expect(adPricingCatalog.currency.default).toBe('USD');
        });

        it('should default to CPM pricing model', () => {
            expect(adPricingCatalog.pricingModel.default).toBe('CPM');
        });

        it('should default multipliers to 1.00', () => {
            expect(adPricingCatalog.weekendMultiplier.default).toBe('1.00');
            expect(adPricingCatalog.holidayMultiplier.default).toBe('1.00');
        });

        it('should default to active status', () => {
            expect(adPricingCatalog.isActive.default).toBe('true');
        });

        it('should support channel-specific pricing', () => {
            // Each ad slot can have different pricing per channel
            expect(adPricingCatalog.adSlotId).toBeDefined();
            expect(adPricingCatalog.channel).toBeDefined();
        });

        it('should support flexible pricing configuration', () => {
            // Should support JSONB pricing config for complex rules
            expect(adPricingCatalog.pricingConfig).toBeDefined();
        });

        it('should support multiple time-based rates', () => {
            expect(adPricingCatalog.dailyRate).toBeDefined();
            expect(adPricingCatalog.weeklyRate).toBeDefined();
            expect(adPricingCatalog.monthlyRate).toBeDefined();
        });
    });
});
