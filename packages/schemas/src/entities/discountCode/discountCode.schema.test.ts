import { describe, expect, it } from 'vitest';
import { DiscountTypeEnum } from '../../enums/index.js';
import {
    CreateDiscountCodeSchema,
    DiscountCodeSchema,
    DiscountCodeValidationResultSchema,
    FixedAmountDiscountCodeSchema,
    HttpCreateDiscountCodeSchema,
    HttpListDiscountCodesSchema,
    PercentageDiscountCodeSchema,
    SearchDiscountCodesSchema,
    UpdateDiscountCodeSchema
} from './index.js';

describe('DiscountCode Schema Tests', () => {
    const baseFields = {
        createdAt: new Date('2024-01-15T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    };

    describe('DiscountCodeSchema - Main Entity', () => {
        it('should validate percentage discount code correctly', () => {
            const discountCode = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'SUMMER25',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25.0,
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T23:59:59Z'),
                maxRedemptionsGlobal: 1000,
                maxRedemptionsPerUser: 1,
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => DiscountCodeSchema.parse(discountCode)).not.toThrow();
        });

        it('should validate fixed amount discount code correctly', () => {
            const discountCode = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'SAVE50',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                amountOffMinor: 5000, // $50.00 in cents
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T23:59:59Z'),
                maxRedemptionsGlobal: 500,
                usedCountGlobal: 25,
                ...baseFields
            };

            expect(() => DiscountCodeSchema.parse(discountCode)).not.toThrow();
        });

        it('should fail validation if percentage type has amountOffMinor', () => {
            const discountCode = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'INVALID',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25.0,
                amountOffMinor: 1000, // Should not be present for percentage type
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T23:59:59Z'),
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => DiscountCodeSchema.parse(discountCode)).toThrow();
        });

        it('should fail validation if fixed amount type has percentOff', () => {
            const discountCode = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'INVALID',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                amountOffMinor: 1000,
                percentOff: 25.0, // Should not be present for fixed amount type
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T23:59:59Z'),
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => DiscountCodeSchema.parse(discountCode)).toThrow();
        });

        it('should fail validation if validTo is before validFrom', () => {
            const discountCode = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'INVALID_DATES',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 10.0,
                validFrom: new Date('2024-08-31T00:00:00Z'),
                validTo: new Date('2024-06-01T00:00:00Z'), // Before validFrom
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => DiscountCodeSchema.parse(discountCode)).toThrow();
        });

        it('should fail validation if maxRedemptionsPerUser exceeds maxRedemptionsGlobal', () => {
            const discountCode = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'INVALID_LIMITS',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 10.0,
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T00:00:00Z'),
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: 150, // Exceeds global limit
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => DiscountCodeSchema.parse(discountCode)).toThrow();
        });

        it('should validate code format restrictions', () => {
            const invalidCodes = ['save 10', 'save@10', 'save.10', 'lowercase'];

            for (const code of invalidCodes) {
                const discountCode = {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                    code,
                    discountType: DiscountTypeEnum.PERCENTAGE,
                    percentOff: 10.0,
                    validFrom: new Date('2024-06-01T00:00:00Z'),
                    validTo: new Date('2024-08-31T00:00:00Z'),
                    usedCountGlobal: 0,
                    ...baseFields
                };

                expect(() => DiscountCodeSchema.parse(discountCode)).toThrow();
            }
        });
    });

    describe('CreateDiscountCodeSchema - CRUD Operations', () => {
        it('should validate percentage discount creation', () => {
            const createData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                code: 'NEW_SUMMER25',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25.0,
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T23:59:59Z'),
                maxRedemptionsGlobal: 1000
            };

            expect(() => CreateDiscountCodeSchema.parse(createData)).not.toThrow();
        });

        it('should validate fixed amount discount creation', () => {
            const createData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                code: 'NEW_SAVE50',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                amountOffMinor: 5000,
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T23:59:59Z')
            };

            expect(() => CreateDiscountCodeSchema.parse(createData)).not.toThrow();
        });
    });

    describe('UpdateDiscountCodeSchema - Updates', () => {
        it('should validate partial updates', () => {
            const updateData = {
                updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                validTo: new Date('2024-12-31T23:59:59Z'),
                maxRedemptionsGlobal: 2000
            };

            expect(() => UpdateDiscountCodeSchema.parse(updateData)).not.toThrow();
        });

        it('should validate type change updates', () => {
            const updateData = {
                updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                amountOffMinor: 3000
            };

            expect(() => UpdateDiscountCodeSchema.parse(updateData)).not.toThrow();
        });
    });

    describe('Subtype Schemas', () => {
        it('should validate PercentageDiscountCodeSchema', () => {
            const percentageDiscount = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'PERCENT20',
                discountType: 'percentage' as const,
                percentOff: 20.0,
                amountOffMinor: undefined,
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T00:00:00Z'),
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => PercentageDiscountCodeSchema.parse(percentageDiscount)).not.toThrow();
        });

        it('should validate FixedAmountDiscountCodeSchema', () => {
            const fixedAmountDiscount = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                code: 'FIXED30',
                discountType: 'fixed_amount' as const,
                amountOffMinor: 3000,
                percentOff: undefined,
                validFrom: new Date('2024-06-01T00:00:00Z'),
                validTo: new Date('2024-08-31T00:00:00Z'),
                usedCountGlobal: 0,
                ...baseFields
            };

            expect(() => FixedAmountDiscountCodeSchema.parse(fixedAmountDiscount)).not.toThrow();
        });
    });

    describe('SearchDiscountCodesSchema - Query Operations', () => {
        it('should validate search with filters', () => {
            const searchData = {
                q: 'SUMMER',
                discountType: DiscountTypeEnum.PERCENTAGE,
                isValid: true,
                percentOffMin: 10,
                percentOffMax: 50,
                validFromStart: new Date('2024-06-01T00:00:00Z'),
                validFromEnd: new Date('2024-08-31T00:00:00Z')
            };

            expect(() => SearchDiscountCodesSchema.parse(searchData)).not.toThrow();
        });

        it('should validate date range consistency', () => {
            const invalidSearchData = {
                validFromStart: new Date('2024-08-31T00:00:00Z'),
                validFromEnd: new Date('2024-06-01T00:00:00Z') // Before start
            };

            expect(() => SearchDiscountCodesSchema.parse(invalidSearchData)).toThrow();
        });
    });

    describe('HTTP Schemas - Coercion', () => {
        it('should coerce string dates in HttpCreateDiscountCodeSchema', () => {
            const httpData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                code: 'HTTP_TEST',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '25.5', // String that should be coerced
                validFrom: '2024-06-01T00:00:00Z', // String date
                validTo: '2024-08-31T23:59:59Z', // String date
                maxRedemptionsGlobal: '1000' // String number
            };

            const result = HttpCreateDiscountCodeSchema.parse(httpData);
            expect(typeof result.percentOff).toBe('number');
            expect(result.percentOff).toBe(25.5);
            expect(result.validFrom).toBeInstanceOf(Date);
            expect(typeof result.maxRedemptionsGlobal).toBe('number');
        });

        it('should coerce query parameters in HttpListDiscountCodesSchema', () => {
            const httpQuery = {
                page: '2',
                pageSize: '20',
                isValid: 'true',
                percentOffMin: '10.5',
                includeDeleted: 'false'
            };

            const result = HttpListDiscountCodesSchema.parse(httpQuery);
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(20);
            expect(result.isValid).toBe(true);
            expect(result.percentOffMin).toBe(10.5);
            // Note: includeDeleted is not defined in the schema, so it won't be in the result
        });
    });

    describe('DiscountCodeValidationResultSchema - Relations', () => {
        it('should validate validation result for valid code', () => {
            const validationResult = {
                isValid: true,
                canBeUsed: true,
                discountCode: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                    code: 'VALID_CODE',
                    discountType: DiscountTypeEnum.PERCENTAGE,
                    percentOff: 15.0,
                    validFrom: new Date('2024-01-01T00:00:00Z'),
                    validTo: new Date('2024-12-31T23:59:59Z'),
                    usedCountGlobal: 50,
                    ...baseFields
                },
                validationErrors: [],
                clientUsageCount: 0,
                globalUsageCount: 50,
                globalUsageLimit: 1000,
                isExpired: false,
                isNotYetValid: false,
                isGloballyExhausted: false,
                isClientLimitReached: false
            };

            expect(() => DiscountCodeValidationResultSchema.parse(validationResult)).not.toThrow();
        });

        it('should validate validation result for invalid code', () => {
            const validationResult = {
                isValid: false,
                canBeUsed: false,
                validationErrors: ['Code has expired', 'Global usage limit reached'],
                clientUsageCount: 2,
                globalUsageCount: 1000,
                globalUsageLimit: 1000,
                isExpired: true,
                isGloballyExhausted: true
            };

            expect(() => DiscountCodeValidationResultSchema.parse(validationResult)).not.toThrow();
        });
    });
});
