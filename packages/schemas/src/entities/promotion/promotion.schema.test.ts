import { describe, expect, it } from 'vitest';
import {
    CreatePromotionSchema,
    HttpCreatePromotionSchema,
    HttpListPromotionsSchema,
    PromotionSchema,
    SearchPromotionsSchema,
    UpdatePromotionSchema
} from './index.js';

describe('Promotion Schema Tests', () => {
    const baseFields = {
        createdAt: new Date('2024-01-15T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    };

    describe('PromotionSchema - Main Entity', () => {
        it('should validate complete promotion correctly', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Summer Special Promotion',
                description: 'Get amazing discounts on summer accommodations',
                rules: 'Apply code SUMMER25 at checkout for 25% off eligible accommodations',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                maxTotalUsage: 1000,
                currentUsageCount: 150,
                targetConditions: {
                    minBookingAmount: 10000, // $100.00 minimum
                    accommodationTypes: ['hotel', 'apartment'],
                    regions: ['europe', 'north-america']
                },
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).not.toThrow();
        });

        it('should validate minimal promotion without optional fields', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Basic Promotion',
                rules: 'Basic promotion rules',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                currentUsageCount: 0,
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).not.toThrow();
        });

        it('should fail validation if endsAt is before startsAt', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Invalid Date Promotion',
                rules: 'Invalid date promotion rules',
                startsAt: new Date('2024-08-31T00:00:00Z'),
                endsAt: new Date('2024-06-01T00:00:00Z'), // Before startsAt
                isActive: true,
                currentUsageCount: 0,
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).toThrow();
        });

        it('should fail validation if currentUsageCount exceeds maxTotalUsage', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Over-Used Promotion',
                rules: 'Over-used promotion rules',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                maxTotalUsage: 100,
                currentUsageCount: 150, // Exceeds max
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).toThrow();
        });

        it('should validate complex targetConditions', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Targeted Promotion',
                rules: 'Targeted promotion with complex conditions',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                currentUsageCount: 0,
                targetConditions: {
                    minBookingAmount: 50000, // $500.00
                    maxBookingAmount: 200000, // $2000.00
                    accommodationTypes: ['luxury_hotel', 'resort'],
                    regions: ['caribbean', 'mediterranean'],
                    minStayNights: 3,
                    bookingWindowDays: 30
                },
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).not.toThrow();
        });

        it('should validate required rules field', () => {
            const promotionWithoutRules = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Promotion Without Rules',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                currentUsageCount: 0,
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotionWithoutRules)).toThrow();
        });
    });

    describe('CreatePromotionSchema - CRUD Operations', () => {
        it('should validate promotion creation with all fields', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const endDate = new Date(futureDate);
            endDate.setMonth(endDate.getMonth() + 3);

            const createData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'Summer Campaign 2025',
                description: 'Special promotional campaign for summer travel',
                rules: 'Apply 20% discount on bookings over $2000',
                startsAt: futureDate,
                endsAt: endDate,
                isActive: true,
                priority: 85,
                targetConditions: { minBookingAmount: 200000 },
                maxTotalUsage: 500
            };

            expect(() => CreatePromotionSchema.parse(createData)).not.toThrow();
        });

        it('should validate minimal promotion creation', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const endDate = new Date(futureDate);
            endDate.setFullYear(endDate.getFullYear() + 1);

            const createData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'Basic Promotion',
                rules: 'Free shipping on all orders',
                startsAt: futureDate,
                endsAt: endDate
            };

            expect(() => CreatePromotionSchema.parse(createData)).not.toThrow();
        });

        it('should validate minimal promotion creation', () => {
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 6);
            const endDate = new Date(futureDate);
            endDate.setMonth(endDate.getMonth() + 3);

            const createData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'Simple Promotion',
                rules: 'Simple promotion rules',
                startsAt: futureDate,
                endsAt: endDate,
                isActive: false
            };

            expect(() => CreatePromotionSchema.parse(createData)).not.toThrow();
        });
    });

    describe('UpdatePromotionSchema - Updates', () => {
        it('should validate partial updates', () => {
            const updateData = {
                updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                description: 'Updated promotion description',
                maxTotalUsage: 2000,
                isActive: false
            };

            expect(() => UpdatePromotionSchema.parse(updateData)).not.toThrow();
        });

        it('should validate date range updates', () => {
            const updateData = {
                updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                endsAt: new Date('2024-12-31T23:59:59Z')
            };

            expect(() => UpdatePromotionSchema.parse(updateData)).not.toThrow();
        });

        it('should validate targetConditions updates', () => {
            const updateData = {
                updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                targetConditions: {
                    minBookingAmount: 15000,
                    regions: ['asia-pacific'],
                    minStayNights: 2
                }
            };

            expect(() => UpdatePromotionSchema.parse(updateData)).not.toThrow();
        });
    });

    describe('SearchPromotionsSchema - Query Operations', () => {
        it('should validate search with filters', () => {
            const searchData = {
                q: 'summer',
                isActive: true,
                isCurrentlyValid: true,
                startsAfter: new Date('2024-01-01T00:00:00Z'),
                startsBefore: new Date('2024-12-31T23:59:59Z'),
                endsAfter: new Date('2024-06-01T00:00:00Z'),
                hasUsageLimit: true,
                usageCountMin: 100,
                usageCountMax: 1000
            };

            expect(() => SearchPromotionsSchema.parse(searchData)).not.toThrow();
        });

        it('should validate date range consistency in search', () => {
            const invalidSearchData = {
                startsAfter: new Date('2024-12-31T00:00:00Z'),
                startsBefore: new Date('2024-01-01T00:00:00Z') // Before start
            };

            expect(() => SearchPromotionsSchema.parse(invalidSearchData)).toThrow();
        });

        it('should validate ends at date range consistency', () => {
            const invalidSearchData = {
                endsAfter: new Date('2024-12-31T00:00:00Z'),
                endsBefore: new Date('2024-06-01T00:00:00Z') // Before start
            };

            expect(() => SearchPromotionsSchema.parse(invalidSearchData)).toThrow();
        });

        it('should validate usage count range consistency', () => {
            const invalidSearchData = {
                usageCountMin: 1000,
                usageCountMax: 100 // Less than min
            };

            expect(() => SearchPromotionsSchema.parse(invalidSearchData)).toThrow();
        });
    });

    describe('HTTP Schemas - Coercion', () => {
        it('should coerce string dates in HttpCreatePromotionSchema', () => {
            const httpData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'HTTP Test Promotion',
                rules: 'HTTP test promotion rules',
                startsAt: '2025-06-01T00:00:00Z', // String date
                endsAt: '2025-08-31T23:59:59Z', // String date
                isActive: 'true', // String boolean
                maxTotalUsage: '500' // String number
            };

            const result = HttpCreatePromotionSchema.parse(httpData);
            expect(result.startsAt).toBeInstanceOf(Date);
            expect(result.endsAt).toBeInstanceOf(Date);
            expect(typeof result.isActive).toBe('boolean');
            expect(result.isActive).toBe(true);
            expect(typeof result.maxTotalUsage).toBe('number');
            expect(result.maxTotalUsage).toBe(500);
        });

        it('should coerce query parameters in HttpListPromotionsSchema', () => {
            const httpQuery = {
                page: '2',
                pageSize: '15',
                isActive: 'true',
                // Note: isCurrentlyValid may not be defined in the schema
                hasUsageLimit: 'true',
                usageCountMin: '50'
            };

            const result = HttpListPromotionsSchema.parse(httpQuery);
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(15);
            expect(result.isActive).toBe(true);
            expect(result.hasUsageLimit).toBe(true);
            expect(result.usageCountMin).toBe(50);
        });

        it('should handle minimal HTTP query parameters', () => {
            const httpQuery = {
                page: '1'
            };

            const result = HttpListPromotionsSchema.parse(httpQuery);
            expect(result.page).toBe(1);
        });
    });

    describe('Edge Cases and Complex Validations', () => {
        it('should validate empty arrays in targetConditions', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Empty Arrays Promotion',
                rules: 'Promotion with empty target conditions',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                currentUsageCount: 0,
                targetConditions: {
                    accommodationTypes: [], // Empty array
                    regions: [] // Empty array
                },
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).not.toThrow();
        });

        it('should validate promotion that spans multiple years', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'Long Term Promotion',
                rules: 'Long term promotion spanning multiple years',
                startsAt: new Date('2024-01-01T00:00:00Z'),
                endsAt: new Date('2026-12-31T23:59:59Z'), // 3 years
                isActive: true,
                currentUsageCount: 0,
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).not.toThrow();
        });

        it('should validate promotion with very high usage limits', () => {
            const promotion = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
                name: 'High Volume Promotion',
                rules: 'High volume promotion with large usage limits',
                startsAt: new Date('2024-06-01T00:00:00Z'),
                endsAt: new Date('2024-08-31T23:59:59Z'),
                isActive: true,
                maxTotalUsage: 1000000, // 1 million
                currentUsageCount: 500000, // 500k used
                ...baseFields
            };

            expect(() => PromotionSchema.parse(promotion)).not.toThrow();
        });
    });
});
