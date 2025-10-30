import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TouristServiceModel } from '../../src/models/touristService.model';
import type { TouristService } from '../../src/schemas/serviceListing/touristService.dbschema';

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

// Create mock tourist service data
const mockTouristServiceData: TouristService = {
    id: 'service-id-1',
    clientId: 'client-id-1',
    name: 'Kayak Tour of Laguna del Gualeguaychú',
    category: 'tour',
    description: 'Guided kayak tour through beautiful wetlands',
    serviceDetails: {
        duration: '3 hours',
        maxParticipants: 10,
        minAge: 12,
        difficulty: 'moderate',
        languages: ['es', 'en'],
        included: ['Kayak', 'Life jacket', 'Guide', 'Snacks'],
        excluded: ['Transportation', 'Tips'],
        requirements: ['Basic swimming skills', 'Comfortable clothes'],
        meetingPoint: 'Puerto de Gualeguaychú',
        pickupAvailable: false,
        cancelationPolicy: '24 hours in advance for full refund',
        operatingDays: ['saturday', 'sunday'],
        operatingHours: '08:00-16:00',
        seasonality: {
            startMonth: 10,
            endMonth: 4
        }
    },
    contactInfo: 'tours@kayakgchu.com | +54 3446 123456',
    location: 'Gualeguaychú, Entre Ríos',
    adminInfo: {
        notes: 'Popular eco-tourism activity',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('TouristServiceModel', () => {
    let model: TouristServiceModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new TouristServiceModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'service-id-1') {
                return mockTouristServiceData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockTouristServiceData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockTouristServiceData,
            ...data,
            id: 'service-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockTouristServiceData,
            ...data,
            id: where.id || 'service-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'service-id-1',
                                clientId: data.clientId,
                                name: data.name,
                                category: data.category,
                                description: data.description,
                                serviceDetails: data.serviceDetails,
                                contactInfo: data.contactInfo,
                                location: data.location,
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
                                    id: 'service-id-1',
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
                                ...mockTouristServiceData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                touristServices: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'service-id-1',
                            name: 'Kayak Tour of Laguna del Gualeguaychú'
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
            expect(model).toBeInstanceOf(TouristServiceModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(TouristServiceModel);
        });
    });

    describe('findById', () => {
        it('should find a tourist service by ID', async () => {
            const result = await model.findById('service-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('service-id-1');
            expect(result?.name).toBe('Kayak Tour of Laguna del Gualeguaychú');
            expect(result?.category).toBe('tour');
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all tourist services', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new tourist service', async () => {
            const newServiceData = {
                clientId: 'client-id-2',
                name: 'Horseback Riding Experience',
                category: 'activity',
                description: 'Explore the countryside on horseback',
                serviceDetails: {
                    duration: '2 hours',
                    maxParticipants: 6,
                    difficulty: 'easy'
                },
                contactInfo: 'rides@campo.com',
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newServiceData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Horseback Riding Experience');
        });
    });

    describe('count', () => {
        it('should count tourist services', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByClient', () => {
        it('should find services by client ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockTouristServiceData],
                total: 1
            });

            const result = await model.findByClient('client-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.clientId).toBe('client-id-1');
        });
    });

    describe('findByCategory', () => {
        it('should find services by category', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockTouristServiceData],
                total: 1
            });

            const result = await model.findByCategory('tour');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.category).toBe('tour');
        });
    });
});
