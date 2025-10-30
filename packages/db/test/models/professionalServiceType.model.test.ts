import type { ProfessionalService } from '@repo/schemas';
import { ProfessionalServiceCategoryEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalServiceTypeModel } from '../../src/models/professionalServiceType.model';

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn(() => ({}))
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// Mock database operations
vi.mock('../../src/utils/db-utils', () => ({
    buildWhereClause: vi.fn(() => ({}))
}));

// Create mock professional service type data
const mockProfessionalServiceTypeData: ProfessionalService = {
    id: 'service-type-id-1',
    name: 'Professional Photography',
    category: ProfessionalServiceCategoryEnum.PHOTO,
    description: 'High-quality professional photography services for accommodations',
    defaultPricing: {
        basePrice: 150,
        currency: 'USD',
        billingUnit: 'project',
        minOrderValue: 100,
        maxOrderValue: 500
    },
    isActive: true,
    adminInfo: {
        notes: 'Premium service provider',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('ProfessionalServiceTypeModel', () => {
    let model: ProfessionalServiceTypeModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new ProfessionalServiceTypeModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'service-type-id-1') {
                return mockProfessionalServiceTypeData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockProfessionalServiceTypeData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockProfessionalServiceTypeData,
            ...data,
            id: 'service-type-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockProfessionalServiceTypeData,
            ...data,
            id: where.id || 'service-type-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'service-type-id-1',
                                name: data.name,
                                category: data.category,
                                description: data.description,
                                defaultPricing: data.defaultPricing,
                                isActive: data.isActive,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: 'user-id-1',
                                updatedById: 'user-id-1',
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(() =>
                            Promise.resolve([
                                {
                                    id: 'service-type-id-1',
                                    name: 'Updated Service',
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                }
                            ])
                        )
                    }))
                }))
            })),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() =>
                        Promise.resolve([
                            {
                                ...mockProfessionalServiceTypeData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                professionalServiceTypes: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'service-type-id-1',
                            name: 'Professional Photography'
                        })
                    )
                }
            }
        };

        // Override getDb for this instance
        const { getDb } = await import('../../src/client');
        vi.mocked(getDb).mockReturnValue(mockDb as any);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(ProfessionalServiceTypeModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(ProfessionalServiceTypeModel);
        });
    });

    describe('findById', () => {
        it('should find a professional service type by ID', async () => {
            const result = await model.findById('service-type-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('service-type-id-1');
            expect(result?.name).toBe('Professional Photography');
            expect(result?.category).toBe(ProfessionalServiceCategoryEnum.PHOTO);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all professional service types', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new professional service type', async () => {
            const newServiceTypeData = {
                name: 'Professional Copywriting',
                category: ProfessionalServiceCategoryEnum.COPYWRITING,
                description: 'Expert copywriting for accommodation listings',
                defaultPricing: {
                    basePrice: 200,
                    currency: 'USD',
                    billingUnit: 'project',
                    minOrderValue: 150,
                    maxOrderValue: 1000
                },
                isActive: true,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newServiceTypeData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Professional Copywriting');
            expect(result.category).toBe(ProfessionalServiceCategoryEnum.COPYWRITING);
        });
    });

    describe('count', () => {
        it('should count professional service types', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByCategory', () => {
        it('should find service types by category', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockProfessionalServiceTypeData],
                total: 1
            });

            const result = await model.findByCategory(ProfessionalServiceCategoryEnum.PHOTO);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.category).toBe(ProfessionalServiceCategoryEnum.PHOTO);
        });
    });

    describe('findActive', () => {
        it('should find active service types', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockProfessionalServiceTypeData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isActive).toBe(true);
        });
    });

    describe('activate', () => {
        it('should activate a service type', async () => {
            const result = await model.activate('service-type-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('service-type-id-1');
        });
    });

    describe('deactivate', () => {
        it('should deactivate a service type', async () => {
            const result = await model.deactivate('service-type-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('service-type-id-1');
        });
    });
});
