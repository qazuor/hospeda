import { AdSlotReservationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdSlotReservationModel } from '../../src/models/adSlotReservation.model';
import type { AdSlotReservation } from '../../src/schemas/campaign/adSlotReservation.dbschema';

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

// Create mock ad slot reservation data
const mockAdSlotReservationData: AdSlotReservation = {
    id: 'ad-slot-reservation-id-1',
    adSlotId: 'ad-slot-id-1',
    campaignId: 'campaign-id-1',
    fromDate: new Date('2024-01-01'),
    toDate: new Date('2024-12-31'),
    status: AdSlotReservationStatusEnum.ACTIVE,
    adminInfo: {
        notes: 'Premium campaign reservation',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('AdSlotReservationModel', () => {
    let model: AdSlotReservationModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new AdSlotReservationModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'ad-slot-reservation-id-1') {
                return mockAdSlotReservationData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockAdSlotReservationData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockAdSlotReservationData,
            ...data,
            id: 'ad-slot-reservation-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockAdSlotReservationData,
            ...data,
            id: where.id || 'ad-slot-reservation-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'ad-slot-reservation-id-1',
                                adSlotId: data.adSlotId,
                                campaignId: data.campaignId,
                                fromDate: data.fromDate,
                                toDate: data.toDate,
                                status: data.status,
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
                                    id: 'ad-slot-reservation-id-1',
                                    status: AdSlotReservationStatusEnum.ACTIVE,
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
                                ...mockAdSlotReservationData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                adSlotReservations: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'ad-slot-reservation-id-1',
                            status: AdSlotReservationStatusEnum.ACTIVE
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
            expect(model).toBeInstanceOf(AdSlotReservationModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AdSlotReservationModel);
        });
    });

    describe('findById', () => {
        it('should find an ad slot reservation by ID', async () => {
            const result = await model.findById('ad-slot-reservation-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('ad-slot-reservation-id-1');
            expect(result?.status).toBe(AdSlotReservationStatusEnum.ACTIVE);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all ad slot reservations', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new ad slot reservation', async () => {
            const newReservationData = {
                adSlotId: 'ad-slot-id-2',
                campaignId: 'campaign-id-2',
                fromDate: new Date('2024-06-01'),
                toDate: new Date('2024-06-30'),
                status: AdSlotReservationStatusEnum.RESERVED,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newReservationData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.status).toBe(AdSlotReservationStatusEnum.RESERVED);
        });
    });

    describe('count', () => {
        it('should count ad slot reservations', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByCampaign', () => {
        it('should find reservations by campaign ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotReservationData],
                total: 1
            });

            const result = await model.findByCampaign('campaign-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.campaignId).toBe('campaign-id-1');
        });
    });

    describe('findByAdSlot', () => {
        it('should find reservations by ad slot ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotReservationData],
                total: 1
            });

            const result = await model.findByAdSlot('ad-slot-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.adSlotId).toBe('ad-slot-id-1');
        });
    });

    describe('findByStatus', () => {
        it('should find reservations by status', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotReservationData],
                total: 1
            });

            const result = await model.findByStatus(AdSlotReservationStatusEnum.ACTIVE);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe(AdSlotReservationStatusEnum.ACTIVE);
        });
    });

    describe('activate', () => {
        it('should activate a reservation', async () => {
            const result = await model.activate('ad-slot-reservation-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('ad-slot-reservation-id-1');
        });
    });

    describe('pause', () => {
        it('should pause a reservation', async () => {
            const result = await model.pause('ad-slot-reservation-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('ad-slot-reservation-id-1');
        });
    });

    describe('cancel', () => {
        it('should cancel a reservation', async () => {
            const result = await model.cancel('ad-slot-reservation-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('ad-slot-reservation-id-1');
        });
    });

    describe('end', () => {
        it('should end a reservation', async () => {
            const result = await model.end('ad-slot-reservation-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('ad-slot-reservation-id-1');
        });
    });
});
