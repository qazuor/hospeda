import { describe, expect, it } from 'vitest';
import {
    CreateServiceOrderSchema,
    HttpCreateServiceOrderSchema,
    HttpSearchServiceOrdersSchema,
    SearchServiceOrdersSchema,
    ServiceOrderSchema,
    UpdateServiceOrderStatusSchema
} from '../../../src/entities/serviceOrder/index.js';
import { ServiceOrderStatusEnum } from '../../../src/enums/service-order-status.enum.js';

describe('Service Order Schema', () => {
    describe('ServiceOrderSchema', () => {
        it('should validate a valid service order object', () => {
            const validOrder = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                status: ServiceOrderStatusEnum.IN_PROGRESS,
                orderedAt: new Date('2023-01-01T00:00:00Z'),
                deliveryDate: new Date('2023-01-15T00:00:00Z'),
                completedAt: null,
                notes: 'Standard photography service for accommodation',
                clientRequirements:
                    'High-resolution photos of all rooms, common areas, and exterior. Include golden hour shots if possible.',
                deliverables: {
                    files: [
                        {
                            id: '880e8400-e29b-41d4-a716-446655440000',
                            name: 'accommodation_photos.zip',
                            url: 'https://storage.example.com/files/accommodation_photos.zip',
                            size: 25600000,
                            mimeType: 'application/zip',
                            uploadedAt: new Date('2023-01-14T15:30:00Z')
                        }
                    ],
                    description: 'Complete photo package including raw and edited versions',
                    completionNotes: 'All photos processed and optimized for web use',
                    revisionRequests: [],
                    approvalStatus: 'approved',
                    approvedAt: new Date('2023-01-15T10:00:00Z'),
                    approvedById: '550e8400-e29b-41d4-a716-446655440000'
                },
                pricing: {
                    baseAmount: 500.0,
                    additionalCharges: 50.0,
                    discountAmount: 25.0,
                    totalAmount: 525.0,
                    currency: 'USD',
                    taxAmount: 42.0,
                    finalAmount: 567.0
                },
                serviceMetadata: {
                    photographyType: 'interior_exterior',
                    equipmentUsed: ['DSLR', 'Tripod', 'Professional lighting'],
                    shootDuration: '4 hours'
                },
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-15T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001',
                adminInfo: {
                    assignedPhotographer: 'John Doe',
                    priorityLevel: 'standard'
                }
            };

            const result = ServiceOrderSchema.safeParse(validOrder);
            expect(result.success).toBe(true);
        });

        it('should validate completed order with completion date', () => {
            const completedOrder = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                status: ServiceOrderStatusEnum.COMPLETED,
                orderedAt: new Date('2023-01-01T00:00:00Z'),
                deliveryDate: new Date('2023-01-15T00:00:00Z'),
                completedAt: new Date('2023-01-15T16:00:00Z'), // Required for completed status
                clientRequirements: 'SEO optimization for accommodation listing',
                pricing: {
                    baseAmount: 200.0,
                    additionalCharges: 0,
                    discountAmount: 0,
                    totalAmount: 200.0,
                    currency: 'USD',
                    taxAmount: 16.0,
                    finalAmount: 216.0
                },
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-15T16:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ServiceOrderSchema.safeParse(completedOrder);
            expect(result.success).toBe(true);
        });

        it('should fail validation for completed status without completion date', () => {
            const invalidOrder = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                status: ServiceOrderStatusEnum.COMPLETED,
                orderedAt: new Date('2023-01-01T00:00:00Z'),
                completedAt: null, // Missing completion date for completed status
                clientRequirements: 'Test requirements',
                pricing: {
                    baseAmount: 100.0,
                    additionalCharges: 0,
                    discountAmount: 0,
                    totalAmount: 100.0,
                    currency: 'USD',
                    taxAmount: 8.0,
                    finalAmount: 108.0
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ServiceOrderSchema.safeParse(invalidOrder);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.serviceOrder.status.inconsistentCompletion'
            );
        });

        it('should fail validation for invalid pricing totals', () => {
            const invalidPricingOrder = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                status: ServiceOrderStatusEnum.PENDING,
                orderedAt: new Date('2023-01-01T00:00:00Z'),
                completedAt: null,
                clientRequirements: 'Test requirements',
                pricing: {
                    baseAmount: 100.0,
                    additionalCharges: 20.0,
                    discountAmount: 10.0,
                    totalAmount: 150.0, // Should be 110.00 (100 + 20 - 10)
                    currency: 'USD',
                    taxAmount: 12.0,
                    finalAmount: 162.0
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ServiceOrderSchema.safeParse(invalidPricingOrder);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.serviceOrder.pricing.invalidTotal'
            );
        });

        it('should fail validation for delivery date before order date', () => {
            const invalidDateOrder = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                status: ServiceOrderStatusEnum.PENDING,
                orderedAt: new Date('2023-01-15T00:00:00Z'),
                deliveryDate: new Date('2023-01-01T00:00:00Z'), // Before order date
                completedAt: null,
                clientRequirements: 'Test requirements',
                pricing: {
                    baseAmount: 100.0,
                    additionalCharges: 0,
                    discountAmount: 0,
                    totalAmount: 100.0,
                    currency: 'USD',
                    taxAmount: 8.0,
                    finalAmount: 108.0
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ServiceOrderSchema.safeParse(invalidDateOrder);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.serviceOrder.deliveryDate.beforeOrderDate'
            );
        });

        it('should validate order with revision requests', () => {
            const orderWithRevisions = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                status: ServiceOrderStatusEnum.IN_PROGRESS,
                orderedAt: new Date('2023-01-01T00:00:00Z'),
                completedAt: null,
                clientRequirements: 'Design requirements with specific brand guidelines',
                deliverables: {
                    files: [],
                    revisionRequests: [
                        {
                            id: '990e8400-e29b-41d4-a716-446655440000',
                            requestedAt: new Date('2023-01-10T14:00:00Z'),
                            description: 'Please adjust the color scheme to match our brand colors',
                            status: 'completed',
                            completedAt: new Date('2023-01-11T16:00:00Z')
                        },
                        {
                            id: '991e8400-e29b-41d4-a716-446655440000',
                            requestedAt: new Date('2023-01-12T09:00:00Z'),
                            description: 'Minor text adjustments needed',
                            status: 'pending'
                        }
                    ],
                    approvalStatus: 'needs_revision'
                },
                pricing: {
                    baseAmount: 300.0,
                    additionalCharges: 0,
                    discountAmount: 0,
                    totalAmount: 300.0,
                    currency: 'USD',
                    taxAmount: 24.0,
                    finalAmount: 324.0
                },
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-12T09:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ServiceOrderSchema.safeParse(orderWithRevisions);
            expect(result.success).toBe(true);
        });
    });

    describe('CreateServiceOrderSchema', () => {
        it('should validate valid creation data', () => {
            const createData = {
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                clientRequirements:
                    'Professional copywriting for accommodation description and amenities list',
                deliveryDate: new Date('2023-01-20T00:00:00Z'),
                notes: 'Rush order, client needs this by end of week',
                pricing: {
                    baseAmount: 150.0,
                    additionalCharges: 25.0,
                    discountAmount: 10.0,
                    totalAmount: 165.0,
                    currency: 'USD',
                    taxAmount: 13.2,
                    finalAmount: 178.2
                }
            };

            const result = CreateServiceOrderSchema.safeParse(createData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe(ServiceOrderStatusEnum.PENDING);
                expect(result.data.orderedAt).toBeInstanceOf(Date);
            }
        });

        it('should use default values for optional fields', () => {
            const minimalCreateData = {
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                clientRequirements: 'Basic SEO optimization service',
                pricing: {
                    baseAmount: 100.0,
                    totalAmount: 100.0,
                    finalAmount: 108.0,
                    taxAmount: 8.0
                }
            };

            const result = CreateServiceOrderSchema.safeParse(minimalCreateData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe(ServiceOrderStatusEnum.PENDING);
                expect(result.data.pricing.currency).toBe('USD');
                expect(result.data.pricing.additionalCharges).toBe(0);
                expect(result.data.pricing.discountAmount).toBe(0);
            }
        });

        it('should fail validation for invalid pricing calculation', () => {
            const invalidCreateData = {
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                clientRequirements: 'Test service with invalid pricing',
                pricing: {
                    baseAmount: 100.0,
                    additionalCharges: 20.0,
                    discountAmount: 5.0,
                    totalAmount: 200.0, // Should be 115.00
                    currency: 'USD',
                    taxAmount: 16.0,
                    finalAmount: 216.0
                }
            };

            const result = CreateServiceOrderSchema.safeParse(invalidCreateData);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.serviceOrder.pricing.invalidTotal'
            );
        });
    });

    describe('UpdateServiceOrderStatusSchema', () => {
        it('should validate status update with completion date', () => {
            const statusUpdate = {
                status: ServiceOrderStatusEnum.COMPLETED,
                completedAt: new Date('2023-01-15T16:00:00Z'),
                adminInfo: {
                    completionNotes: 'Order completed successfully',
                    qualityRating: '5'
                }
            };

            const result = UpdateServiceOrderStatusSchema.safeParse(statusUpdate);
            expect(result.success).toBe(true);
        });

        it('should validate status update to in-progress', () => {
            const statusUpdate = {
                status: ServiceOrderStatusEnum.IN_PROGRESS,
                deliveryDate: new Date('2023-01-20T00:00:00Z')
            };

            const result = UpdateServiceOrderStatusSchema.safeParse(statusUpdate);
            expect(result.success).toBe(true);
        });

        it('should fail validation for completed status without completion date', () => {
            const invalidStatusUpdate = {
                status: ServiceOrderStatusEnum.COMPLETED
                // Missing completedAt for COMPLETED status
            };

            const result = UpdateServiceOrderStatusSchema.safeParse(invalidStatusUpdate);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.serviceOrder.status.missingCompletedAt'
            );
        });
    });

    describe('SearchServiceOrdersSchema', () => {
        it('should validate basic search parameters', () => {
            const searchData = {
                q: 'photography design',
                status: ServiceOrderStatusEnum.IN_PROGRESS,
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                page: 1,
                pageSize: 20
            };

            const result = SearchServiceOrdersSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should validate date range filtering', () => {
            const searchData = {
                orderedAfter: new Date('2023-01-01T00:00:00Z'),
                orderedBefore: new Date('2023-12-31T23:59:59Z'),
                deliveryAfter: new Date('2023-01-15T00:00:00Z'),
                deliveryBefore: new Date('2023-12-15T23:59:59Z')
            };

            const result = SearchServiceOrdersSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should validate amount range filtering', () => {
            const searchData = {
                minAmount: 100,
                maxAmount: 1000,
                currency: 'USD',
                hasDeliverables: true,
                approvalStatus: 'approved'
            };

            const result = SearchServiceOrdersSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should fail for invalid date ranges', () => {
            const invalidSearchData = {
                orderedAfter: new Date('2023-12-31T00:00:00Z'),
                orderedBefore: new Date('2023-01-01T00:00:00Z') // Before orderedAfter
            };

            const result = SearchServiceOrdersSchema.safeParse(invalidSearchData);
            expect(result.success).toBe(false);
            expect(result.error?.issues[0]?.message).toBe(
                'zodError.serviceOrder.search.invalidOrderedDateRange'
            );
        });

        it('should use default values', () => {
            const searchData = {
                q: 'test'
            };

            const result = SearchServiceOrdersSchema.safeParse(searchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.sortBy).toBe('orderedAt');
                expect(result.data.sortOrder).toBe('desc');
                expect(result.data.includeService).toBe(false);
                expect(result.data.includeDeliverables).toBe(false);
            }
        });
    });

    describe('HttpCreateServiceOrderSchema', () => {
        it('should coerce string numbers in pricing', () => {
            const httpData = {
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                serviceTypeId: '660e8400-e29b-41d4-a716-446655440000',
                pricingPlanId: '770e8400-e29b-41d4-a716-446655440000',
                clientRequirements: 'HTTP created service order',
                pricing: {
                    baseAmount: '200.50', // String number
                    additionalCharges: '30.25',
                    discountAmount: '15.75',
                    totalAmount: '215.00',
                    taxAmount: '17.20',
                    finalAmount: '232.20'
                }
            };

            const result = HttpCreateServiceOrderSchema.safeParse(httpData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pricing.baseAmount).toBe(200.5);
                expect(result.data.pricing.additionalCharges).toBe(30.25);
                expect(result.data.pricing.discountAmount).toBe(15.75);
                expect(result.data.pricing.totalAmount).toBe(215);
                expect(result.data.pricing.taxAmount).toBe(17.2);
                expect(result.data.pricing.finalAmount).toBe(232.2);
            }
        });
    });

    describe('HttpSearchServiceOrdersSchema', () => {
        it('should parse comma-separated statuses and coerce values', () => {
            const httpSearchData = {
                statuses: 'PENDING,IN_PROGRESS,COMPLETED',
                page: '3',
                pageSize: '25',
                minAmount: '50.00',
                maxAmount: '2000.50',
                hasDeliverables: 'true',
                hasRevisions: 'false',
                includeService: 'true',
                includeDeliverables: 'true'
            };

            const result = HttpSearchServiceOrdersSchema.safeParse(httpSearchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.statuses).toEqual(['PENDING', 'IN_PROGRESS', 'COMPLETED']);
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(25);
                expect(result.data.minAmount).toBe(50);
                expect(result.data.maxAmount).toBe(2000.5);
                expect(result.data.hasDeliverables).toBe(true);
                expect(result.data.hasRevisions).toBe(false);
                expect(result.data.includeService).toBe(true);
                expect(result.data.includeDeliverables).toBe(true);
            }
        });

        it('should filter out invalid statuses', () => {
            const httpSearchData = {
                statuses: 'PENDING,INVALID_STATUS,COMPLETED,ANOTHER_INVALID'
            };

            const result = HttpSearchServiceOrdersSchema.safeParse(httpSearchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.statuses).toEqual(['PENDING', 'COMPLETED']);
            }
        });

        it('should handle various boolean string formats', () => {
            const testCases = [
                { input: 'true', expected: true },
                { input: 'false', expected: false },
                { input: '1', expected: true },
                { input: '0', expected: false }
            ];

            for (const { input, expected } of testCases) {
                const httpSearchData = {
                    hasDeliverables: input
                };

                const result = HttpSearchServiceOrdersSchema.safeParse(httpSearchData);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.hasDeliverables).toBe(expected);
                }
            }
        });
    });
});
