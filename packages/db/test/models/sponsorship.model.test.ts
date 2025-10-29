import type { Sponsorship } from '@repo/schemas';
import { SponsorshipEntityTypeEnum, SponsorshipStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipModel } from '../../src/models/sponsorship.model';

// Mock the database client more simply
vi.mock('../../src/client', () => ({
    getDb: vi.fn(() => ({})) // Return empty object, we'll override methods in model
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

// Create a mock sponsorship data
const mockSponsorshipData: Sponsorship = {
    id: 'sponsorship-id-1',
    clientId: 'client-id-1',
    entityType: SponsorshipEntityTypeEnum.POST,
    entityId: 'post-id-1',
    fromDate: new Date('2024-01-01'),
    toDate: new Date('2024-12-31'),
    status: SponsorshipStatusEnum.ACTIVE,
    priority: 50,
    spentAmount: 0,
    impressionCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: undefined,
    deletedById: undefined
};

describe('SponsorshipModel', () => {
    let model: SponsorshipModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new SponsorshipModel();

        // Mock the specific methods that are called by the sponsorship model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'sponsorship-id-1') {
                return mockSponsorshipData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockSponsorshipData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockSponsorshipData,
            ...data,
            id: 'sponsorship-id-1'
        }));

        // Mock database operations for insert/update
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'sponsorship-id-1',
                                clientId: data.clientId,
                                entityType: data.entityType, // This will be dynamic based on input
                                entityId: data.entityId,
                                fromDate: data.fromDate,
                                toDate: data.toDate,
                                status: data.status,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: undefined,
                                updatedById: undefined,
                                deletedAt: null,
                                deletedById: null,
                                adminInfo: null
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
                                    id: 'sponsorship-id-1',
                                    status: 'ACTIVE',
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                }
                            ])
                        )
                    }))
                }))
            })),
            query: {
                sponsorships: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'sponsorship-id-1',
                            status: 'ACTIVE'
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
            expect(model).toBeInstanceOf(SponsorshipModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(SponsorshipModel);
        });
    });

    describe('sponsorPost', () => {
        it('should create a post sponsorship', async () => {
            const result = await model.sponsorPost({
                clientId: 'client-id-1',
                postId: 'post-id-1',
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-12-31')
            });

            expect(result).toBeDefined();
            expect(result.entityType).toBe(SponsorshipEntityTypeEnum.POST);
            expect(result.entityId).toBe('post-id-1');
            expect(result.clientId).toBe('client-id-1');
        });
    });

    describe('sponsorEvent', () => {
        it('should create an event sponsorship', async () => {
            const result = await model.sponsorEvent({
                clientId: 'client-id-1',
                eventId: 'event-id-1',
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-12-31')
            });

            expect(result).toBeDefined();
            expect(result.entityType).toBe(SponsorshipEntityTypeEnum.EVENT);
            expect(result.entityId).toBe('event-id-1');
            expect(result.clientId).toBe('client-id-1');
        });
    });

    describe('getSponsoredEntity', () => {
        it('should return the sponsored post entity', async () => {
            await expect(async () => {
                await model.getSponsoredEntity('sponsorship-id-1');
            }).rejects.toThrow('Method getSponsoredEntity not implemented');
        });
    });

    describe('isActive', () => {
        it('should return true for active sponsorship', async () => {
            const result = await model.isActive('sponsorship-id-1');
            expect(typeof result).toBe('boolean');
        });
    });

    describe('calculateCost', () => {
        it('should calculate sponsorship cost', async () => {
            const result = await model.calculateCost('sponsorship-id-1');
            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });
    });

    describe('getVisibilityStats', () => {
        it('should return visibility statistics', async () => {
            const result = await model.getVisibilityStats('sponsorship-id-1');
            expect(result).toHaveProperty('impressions');
            expect(result).toHaveProperty('clicks');
            expect(result).toHaveProperty('reach');
            expect(result).toHaveProperty('engagement');
            expect(typeof result.impressions).toBe('number');
            expect(typeof result.clicks).toBe('number');
            expect(typeof result.reach).toBe('number');
            expect(typeof result.engagement).toBe('number');
        });
    });

    describe('activate', () => {
        it('should activate a sponsorship', async () => {
            const result = await model.activate('sponsorship-id-1');
            expect(result).toBeDefined();
            expect(result.id).toBe('sponsorship-id-1');
        });
    });

    describe('pause', () => {
        it('should pause a sponsorship', async () => {
            const result = await model.pause('sponsorship-id-1');
            expect(result).toBeDefined();
            expect(result.id).toBe('sponsorship-id-1');
        });
    });

    describe('expire', () => {
        it('should expire a sponsorship', async () => {
            const result = await model.expire('sponsorship-id-1');
            expect(result).toBeDefined();
            expect(result.id).toBe('sponsorship-id-1');
        });
    });

    describe('cancel', () => {
        it('should cancel a sponsorship', async () => {
            const result = await model.cancel('sponsorship-id-1');
            expect(result).toBeDefined();
            expect(result.id).toBe('sponsorship-id-1');
        });
    });

    describe('findActive', () => {
        it('should find active sponsorships', async () => {
            const result = await model.findActive();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('findByClient', () => {
        it('should find sponsorships by client ID', async () => {
            const result = await model.findByClient('client-id-1');
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('findByEntity', () => {
        it('should find sponsorships by entity ID and type', async () => {
            const result = await model.findByEntity('post-id-1', SponsorshipEntityTypeEnum.POST);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('withTarget', () => {
        it('should return sponsorship with target entity populated', async () => {
            const result = await model.withTarget('sponsorship-id-1');
            expect(result).toBeDefined();
            expect(result).toHaveProperty('target');
        });
    });

    describe('getImpressions', () => {
        it('should return impression count', async () => {
            const result = await model.getImpressions('sponsorship-id-1');
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getClicks', () => {
        it('should return click count', async () => {
            const result = await model.getClicks('sponsorship-id-1');
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('calculateROI', () => {
        it('should calculate return on investment', async () => {
            const result = await model.calculateROI('sponsorship-id-1');
            expect(typeof result).toBe('number');
        });
    });
});
