import { describe, expect, it } from 'vitest';
import {
    PricingPlanListOutputSchema,
    PricingPlanSearchOutputSchema,
    PricingPlanSearchSchema,
    PricingPlanSummarySchema
} from '../../../src/entities/pricingPlan/pricingPlan.query.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../../src/enums/billing-scheme.enum.js';

describe('PricingPlan Query Schema', () => {
    describe('PricingPlanSearchSchema', () => {
        it('should validate basic search with pagination', () => {
            const searchInput = {
                page: 1,
                pageSize: 20,
                sortBy: 'amountMinor',
                sortOrder: 'asc' as const
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.sortBy).toBe('amountMinor');
                expect(result.data.sortOrder).toBe('asc');
            }
        });

        it('should validate search with productId filter', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                productId: '987fcdeb-51a2-43d7-b123-456789012345'
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.productId).toBe('987fcdeb-51a2-43d7-b123-456789012345');
            }
        });

        it('should validate search with billing scheme filter', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                billingScheme: BillingSchemeEnum.RECURRING
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
            }
        });

        it('should validate search with interval filter', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                interval: BillingIntervalEnum.MONTH
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.interval).toBe(BillingIntervalEnum.MONTH);
            }
        });

        it('should validate search with currency filter', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'amountMinor',
                sortOrder: 'asc' as const,
                currency: 'USD'
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.currency).toBe('USD');
            }
        });

        it('should validate search with amount range filters', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'amountMinor',
                sortOrder: 'asc' as const,
                amountMinorMin: 1000,
                amountMinorMax: 10000
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amountMinorMin).toBe(1000);
                expect(result.data.amountMinorMax).toBe(10000);
            }
        });

        it('should validate search with isActive filter', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                isActive: true
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should validate search with combined filters', () => {
            const searchInput = {
                page: 2,
                pageSize: 25,
                sortBy: 'updatedAt',
                sortOrder: 'desc' as const,
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.YEAR,
                currency: 'EUR',
                isActive: true,
                lifecycleState: 'ACTIVE'
            };

            const result = PricingPlanSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.productId).toBe('987fcdeb-51a2-43d7-b123-456789012345');
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
                expect(result.data.interval).toBe(BillingIntervalEnum.YEAR);
                expect(result.data.currency).toBe('EUR');
                expect(result.data.isActive).toBe(true);
                expect(result.data.lifecycleState).toBe('ACTIVE');
            }
        });
    });

    describe('PricingPlanSearchOutputSchema', () => {
        it('should validate search output with pagination structure', () => {
            const searchOutput = {
                data: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        productId: '987fcdeb-51a2-43d7-b123-456789012345',
                        billingScheme: BillingSchemeEnum.RECURRING,
                        interval: BillingIntervalEnum.MONTH,
                        amountMinor: 2999,
                        currency: 'ARS',
                        isActive: true,
                        isDeleted: false,
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2024-01-15T10:00:00Z'),
                        updatedAt: new Date('2024-01-15T10:00:00Z')
                    }
                ],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            const result = PricingPlanSearchOutputSchema.safeParse(searchOutput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.data).toHaveLength(1);
                expect(result.data.pagination.total).toBe(1);
            }
        });
    });

    describe('PricingPlanListOutputSchema', () => {
        it('should validate paginated list output', () => {
            const listOutput = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        productId: '987fcdeb-51a2-43d7-b123-456789012345',
                        billingScheme: BillingSchemeEnum.ONE_TIME,
                        amountMinor: 9999,
                        currency: 'USD',
                        isActive: true,
                        isDeleted: false,
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2024-01-15T10:00:00Z'),
                        updatedAt: new Date('2024-01-15T10:00:00Z')
                    }
                ],
                totalCount: 1,
                page: 1,
                pageSize: 10,
                totalPages: 1
            };

            const result = PricingPlanListOutputSchema.safeParse(listOutput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(1);
                expect(result.data.totalCount).toBe(1);
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
                expect(result.data.totalPages).toBe(1);
            }
        });
    });

    describe('PricingPlanSummarySchema', () => {
        it('should validate pricing plan summary', () => {
            const summaryData = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                amountMinor: 2999,
                currency: 'ARS',
                isActive: true
            };

            const result = PricingPlanSummarySchema.safeParse(summaryData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
                expect(result.data.interval).toBe(BillingIntervalEnum.MONTH);
                expect(result.data.amountMinor).toBe(2999);
            }
        });
    });
});
