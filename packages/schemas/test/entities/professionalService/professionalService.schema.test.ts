import { describe, expect, it } from 'vitest';
import {
    CreateProfessionalServiceSchema,
    HttpCreateProfessionalServiceSchema,
    HttpSearchProfessionalServicesSchema,
    ProfessionalServiceSchema,
    SearchProfessionalServicesSchema,
    UpdateProfessionalServiceSchema
} from '../../../src/entities/professionalService/index.js';
import { ProfessionalServiceCategoryEnum } from '../../../src/enums/professional-service-category.enum.js';

describe('Professional Service Schema', () => {
    describe('ProfessionalServiceSchema', () => {
        it('should validate a valid professional service object', () => {
            const validService = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Professional Photography Service',
                description:
                    'High-quality accommodation photography services for hospitality businesses',
                category: ProfessionalServiceCategoryEnum.PHOTO,
                defaultPricing: {
                    basePrice: 299.99,
                    currency: 'USD',
                    billingUnit: 'project',
                    minOrderValue: 100,
                    maxOrderValue: 2000
                },
                isActive: true,
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001',
                adminInfo: {
                    notes: 'Premium service provider',
                    verificationStatus: 'verified'
                }
            };

            const result = ProfessionalServiceSchema.safeParse(validService);
            expect(result.success).toBe(true);
        });

        it('should validate service with minimal required fields', () => {
            const minimalService = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'SEO Service',
                description: 'Basic SEO optimization for accommodation listings',
                category: ProfessionalServiceCategoryEnum.SEO,
                defaultPricing: {
                    basePrice: 150.0,
                    currency: 'USD',
                    billingUnit: 'month'
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProfessionalServiceSchema.safeParse(minimalService);
            expect(result.success).toBe(true);
        });

        it('should fail validation for invalid pricing range', () => {
            const invalidService = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Invalid Service',
                description: 'Service with invalid pricing range',
                category: ProfessionalServiceCategoryEnum.DESIGN,
                defaultPricing: {
                    basePrice: 100,
                    currency: 'USD',
                    billingUnit: 'project',
                    minOrderValue: 500, // Greater than maxOrderValue
                    maxOrderValue: 200
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProfessionalServiceSchema.safeParse(invalidService);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.professionalService.pricing.invalidRange'
            );
        });

        it('should fail validation for negative base price', () => {
            const invalidService = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Invalid Service',
                description: 'Service with negative price',
                category: ProfessionalServiceCategoryEnum.MAINTENANCE,
                defaultPricing: {
                    basePrice: -50,
                    currency: 'USD',
                    billingUnit: 'hour'
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProfessionalServiceSchema.safeParse(invalidService);
            expect(result.success).toBe(false);
        });

        it('should fail validation for short name', () => {
            const invalidService = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'AB', // Too short
                description: 'Valid description here',
                category: ProfessionalServiceCategoryEnum.OTHER,
                defaultPricing: {
                    basePrice: 100,
                    currency: 'USD',
                    billingUnit: 'project'
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProfessionalServiceSchema.safeParse(invalidService);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.professionalService.name.tooShort'
            );
        });
    });

    describe('CreateProfessionalServiceSchema', () => {
        it('should validate valid creation data', () => {
            const createData = {
                name: 'Copywriting Service',
                description:
                    'Professional copywriting for accommodation descriptions and marketing materials',
                category: ProfessionalServiceCategoryEnum.COPYWRITING,
                defaultPricing: {
                    basePrice: 75,
                    currency: 'USD',
                    billingUnit: 'hour'
                },
                isActive: true
            };

            const result = CreateProfessionalServiceSchema.safeParse(createData);
            expect(result.success).toBe(true);
        });

        it('should use default values for optional fields', () => {
            const createData = {
                name: 'Tour Service',
                description: 'Guided tours for accommodation guests',
                category: ProfessionalServiceCategoryEnum.TOUR,
                defaultPricing: {
                    basePrice: 45.5
                }
            };

            const result = CreateProfessionalServiceSchema.safeParse(createData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.defaultPricing.currency).toBe('USD');
                expect(result.data.defaultPricing.billingUnit).toBe('project');
                expect(result.data.isActive).toBe(true);
            }
        });
    });

    describe('UpdateProfessionalServiceSchema', () => {
        it('should validate partial updates', () => {
            const updateData = {
                name: 'Updated Service Name',
                isActive: false
            };

            const result = UpdateProfessionalServiceSchema.safeParse(updateData);
            expect(result.success).toBe(true);
        });

        it('should validate pricing updates', () => {
            const updateData = {
                defaultPricing: {
                    basePrice: 199.99,
                    billingUnit: 'day',
                    minOrderValue: 100,
                    maxOrderValue: 1000
                }
            };

            const result = UpdateProfessionalServiceSchema.safeParse(updateData);
            expect(result.success).toBe(true);
        });

        it('should fail for invalid pricing range in update', () => {
            const updateData = {
                defaultPricing: {
                    basePrice: 100,
                    minOrderValue: 800,
                    maxOrderValue: 200
                }
            };

            const result = UpdateProfessionalServiceSchema.safeParse(updateData);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.professionalService.pricing.invalidRange'
            );
        });
    });

    describe('SearchProfessionalServicesSchema', () => {
        it('should validate basic search parameters', () => {
            const searchData = {
                q: 'photography',
                category: ProfessionalServiceCategoryEnum.PHOTO,
                isActive: true,
                page: 1,
                pageSize: 20
            };

            const result = SearchProfessionalServicesSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should validate price range filtering', () => {
            const searchData = {
                minPrice: 50,
                maxPrice: 500,
                currency: 'USD',
                billingUnit: 'project'
            };

            const result = SearchProfessionalServicesSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should fail for invalid price range', () => {
            const searchData = {
                minPrice: 500,
                maxPrice: 100 // Less than minPrice
            };

            const result = SearchProfessionalServicesSchema.safeParse(searchData);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.professionalService.search.invalidPriceRange'
            );
        });

        it('should validate multiple categories filter', () => {
            const searchData = {
                categories: [
                    ProfessionalServiceCategoryEnum.PHOTO,
                    ProfessionalServiceCategoryEnum.DESIGN,
                    ProfessionalServiceCategoryEnum.COPYWRITING
                ]
            };

            const result = SearchProfessionalServicesSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should use default pagination values', () => {
            const searchData = {
                q: 'test'
            };

            const result = SearchProfessionalServicesSchema.safeParse(searchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.sortBy).toBe('createdAt');
                expect(result.data.sortOrder).toBe('desc');
            }
        });
    });

    describe('HttpCreateProfessionalServiceSchema', () => {
        it('should coerce string numbers to numbers in pricing', () => {
            const httpData = {
                name: 'HTTP Service',
                description: 'Service created via HTTP',
                category: ProfessionalServiceCategoryEnum.SEO,
                defaultPricing: {
                    basePrice: '150.00', // String that should be coerced
                    minOrderValue: '50',
                    maxOrderValue: '1000'
                },
                isActive: 'true' // String boolean
            };

            const result = HttpCreateProfessionalServiceSchema.safeParse(httpData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.defaultPricing.basePrice).toBe(150);
                expect(result.data.defaultPricing.minOrderValue).toBe(50);
                expect(result.data.defaultPricing.maxOrderValue).toBe(1000);
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should handle various boolean string formats', () => {
            const testCases = [
                { input: 'true', expected: true },
                { input: 'false', expected: false },
                { input: '1', expected: true },
                { input: '0', expected: false },
                { input: true, expected: true },
                { input: false, expected: false }
            ];

            for (const { input, expected } of testCases) {
                const httpData = {
                    name: 'Test Service',
                    description: 'Testing boolean conversion',
                    category: ProfessionalServiceCategoryEnum.OTHER,
                    defaultPricing: {
                        basePrice: 100
                    },
                    isActive: input
                };

                const result = HttpCreateProfessionalServiceSchema.safeParse(httpData);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.isActive).toBe(expected);
                }
            }
        });
    });

    describe('HttpSearchProfessionalServicesSchema', () => {
        it('should parse comma-separated categories from query string', () => {
            const httpSearchData = {
                categories: 'PHOTO,DESIGN,COPYWRITING',
                page: '2',
                pageSize: '50',
                minPrice: '100.50',
                maxPrice: '500.75',
                isActive: 'true'
            };

            const result = HttpSearchProfessionalServicesSchema.safeParse(httpSearchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.categories).toEqual(['PHOTO', 'DESIGN', 'COPYWRITING']);
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(50);
                expect(result.data.minPrice).toBe(100.5);
                expect(result.data.maxPrice).toBe(500.75);
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should filter out invalid categories', () => {
            const httpSearchData = {
                categories: 'PHOTO,INVALID_CATEGORY,DESIGN,ANOTHER_INVALID'
            };

            const result = HttpSearchProfessionalServicesSchema.safeParse(httpSearchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.categories).toEqual(['PHOTO', 'DESIGN']);
            }
        });

        it('should handle single category as string', () => {
            const httpSearchData = {
                categories: 'MAINTENANCE'
            };

            const result = HttpSearchProfessionalServicesSchema.safeParse(httpSearchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.categories).toEqual(['MAINTENANCE']);
            }
        });
    });
});
