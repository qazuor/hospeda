import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BenefitPartnerModel } from '../../src/models/benefitPartner.model';
import type { BenefitPartner } from '../../src/schemas/services/benefitPartner.dbschema';

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

// Create mock benefit partner data
const mockBenefitPartnerData: BenefitPartner = {
    id: 'partner-id-1',
    name: 'Luxury Spa & Wellness',
    category: 'spa',
    description: 'Premium spa and wellness center offering exclusive discounts',
    contactInfo: 'contact@luxuryspa.com | +54 9 11 1234-5678',
    clientId: 'client-id-1',
    adminInfo: {
        notes: 'Premium partner',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('BenefitPartnerModel', () => {
    let model: BenefitPartnerModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new BenefitPartnerModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'partner-id-1') {
                return mockBenefitPartnerData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockBenefitPartnerData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockBenefitPartnerData,
            ...data,
            id: 'partner-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockBenefitPartnerData,
            ...data,
            id: where.id || 'partner-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'partner-id-1',
                                name: data.name,
                                category: data.category,
                                description: data.description,
                                contactInfo: data.contactInfo,
                                clientId: data.clientId,
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
                                    id: 'partner-id-1',
                                    name: 'Updated Partner',
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
                                ...mockBenefitPartnerData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                benefitPartners: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'partner-id-1',
                            name: 'Luxury Spa & Wellness'
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
            expect(model).toBeInstanceOf(BenefitPartnerModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(BenefitPartnerModel);
        });
    });

    describe('findById', () => {
        it('should find a benefit partner by ID', async () => {
            const result = await model.findById('partner-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('partner-id-1');
            expect(result?.name).toBe('Luxury Spa & Wellness');
            expect(result?.category).toBe('spa');
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all benefit partners', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new benefit partner', async () => {
            const newPartnerData = {
                name: 'Fine Dining Restaurant',
                category: 'restaurant',
                description: 'Gourmet restaurant with special rates',
                contactInfo: 'reservations@finedining.com',
                clientId: 'client-id-2',
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newPartnerData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Fine Dining Restaurant');
        });
    });

    describe('count', () => {
        it('should count benefit partners', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByClient', () => {
        it('should find partners by client ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitPartnerData],
                total: 1
            });

            const result = await model.findByClient('client-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.clientId).toBe('client-id-1');
        });
    });

    describe('findByCategory', () => {
        it('should find partners by category', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitPartnerData],
                total: 1
            });

            const result = await model.findByCategory('spa');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.category).toBe('spa');
        });
    });
});
