import { describe, expect, it } from 'vitest';
import {
    HttpPricingPlanSearchSchema,
    PricingPlanCreateHttpSchema,
    PricingPlanUpdateHttpSchema,
    httpToDomainPricingPlanCreate,
    httpToDomainPricingPlanSearch,
    httpToDomainPricingPlanUpdate
} from '../../../src/entities/pricingPlan/pricingPlan.http.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../../src/enums/billing-scheme.enum.js';

describe('PricingPlan HTTP Schema', () => {
    describe('HttpPricingPlanSearchSchema', () => {
        it('should coerce string numbers to integers for pagination', () => {
            const httpParams = {
                page: '2',
                pageSize: '25',
                sortBy: 'amountMinor',
                sortOrder: 'desc' as const
            };

            const result = HttpPricingPlanSearchSchema.safeParse(httpParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(25);
                expect(typeof result.data.page).toBe('number');
                expect(typeof result.data.pageSize).toBe('number');
            }
        });

        it('should coerce string booleans to boolean values', () => {
            const httpParams = {
                page: '1',
                pageSize: '10',
                sortBy: 'createdAt',
                sortOrder: 'asc' as const,
                isActive: 'true',
                isDeleted: 'false'
            };

            const result = HttpPricingPlanSearchSchema.safeParse(httpParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
                expect(result.data.isDeleted).toBe(false);
                expect(typeof result.data.isActive).toBe('boolean');
                expect(typeof result.data.isDeleted).toBe('boolean');
            }
        });

        it('should coerce amount range strings to numbers', () => {
            const httpParams = {
                page: '1',
                pageSize: '10',
                sortBy: 'amountMinor',
                sortOrder: 'asc' as const,
                amountMinorMin: '1000',
                amountMinorMax: '10000'
            };

            const result = HttpPricingPlanSearchSchema.safeParse(httpParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amountMinorMin).toBe(1000);
                expect(result.data.amountMinorMax).toBe(10000);
                expect(typeof result.data.amountMinorMin).toBe('number');
                expect(typeof result.data.amountMinorMax).toBe('number');
            }
        });

        it('should handle enum string values', () => {
            const httpParams = {
                page: '1',
                pageSize: '10',
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                billingScheme: 'recurring',
                interval: 'month',
                lifecycleState: 'ACTIVE'
            };

            const result = HttpPricingPlanSearchSchema.safeParse(httpParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe('recurring');
                expect(result.data.interval).toBe('month');
                expect(result.data.lifecycleState).toBe('ACTIVE');
            }
        });
    });

    describe('PricingPlanCreateHttpSchema', () => {
        it('should coerce numeric strings to numbers', () => {
            const httpData = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: 'recurring',
                interval: 'month',
                amountMinor: '2999',
                currency: 'ARS',
                metadata: '{"tier": "basic"}'
            };

            const result = PricingPlanCreateHttpSchema.safeParse(httpData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amountMinor).toBe(2999);
                expect(typeof result.data.amountMinor).toBe('number');
            }
        });

        it('should handle JSON metadata string', () => {
            const httpData = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: 'one_time',
                amountMinor: '9999',
                currency: 'USD',
                metadata: '{"features": ["premium", "analytics"]}'
            };

            const result = PricingPlanCreateHttpSchema.safeParse(httpData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.metadata).toBe('{"features": ["premium", "analytics"]}');
            }
        });
    });

    describe('PricingPlanUpdateHttpSchema', () => {
        it('should handle partial updates with coercion', () => {
            const httpData = {
                amountMinor: '3999',
                metadata: '{"updated": true}'
            };

            const result = PricingPlanUpdateHttpSchema.safeParse(httpData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amountMinor).toBe(3999);
                expect(typeof result.data.amountMinor).toBe('number');
            }
        });
    });

    describe('HTTP to Domain Conversions', () => {
        it('should convert HTTP search to domain search', () => {
            const httpParams = {
                page: 2,
                pageSize: 25,
                sortBy: 'amountMinor',
                sortOrder: 'desc' as const,
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                currency: 'EUR',
                isActive: true
            };

            const domainSearch = httpToDomainPricingPlanSearch(httpParams);

            expect(domainSearch.page).toBe(2);
            expect(domainSearch.pageSize).toBe(25);
            expect(domainSearch.sortBy).toBe('amountMinor');
            expect(domainSearch.sortOrder).toBe('desc');
            expect(domainSearch.productId).toBe('987fcdeb-51a2-43d7-b123-456789012345');
            expect(domainSearch.billingScheme).toBe(BillingSchemeEnum.RECURRING);
            expect(domainSearch.interval).toBe(BillingIntervalEnum.MONTH);
            expect(domainSearch.currency).toBe('EUR');
            expect(domainSearch.isActive).toBe(true);
        });

        it('should convert HTTP create to domain create', () => {
            const httpData = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 9999,
                currency: 'USD',
                metadata: '{"tier": "premium"}'
            };

            const domainCreate = httpToDomainPricingPlanCreate(httpData);
            expect(domainCreate.productId).toBe('987fcdeb-51a2-43d7-b123-456789012345');
            expect(domainCreate.billingScheme).toBe(BillingSchemeEnum.ONE_TIME);
            expect(domainCreate.amountMinor).toBe(9999);
            expect(domainCreate.currency).toBe('USD');
            expect(domainCreate.metadata).toEqual({ tier: 'premium' });
            expect(domainCreate.lifecycleState).toBe('ACTIVE');
        });

        it('should convert HTTP update to domain update', () => {
            const httpData = {
                amountMinor: 3999,
                currency: 'GBP',
                metadata: '{"updated": true}'
            };

            const domainUpdate = httpToDomainPricingPlanUpdate(httpData);
            expect(domainUpdate.amountMinor).toBe(3999);
            expect(domainUpdate.currency).toBe('GBP');
            expect(domainUpdate.metadata).toEqual({ updated: true });
        });

        it('should handle invalid JSON metadata gracefully', () => {
            const httpData = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 9999,
                currency: 'USD',
                metadata: 'invalid json'
            };

            const domainCreate = httpToDomainPricingPlanCreate(httpData);
            expect(domainCreate.metadata).toEqual({});
        });
    });
});
