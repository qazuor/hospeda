import { SubscriptionItemEntityTypeEnum, SubscriptionItemSourceTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { SubscriptionItemModel } from '../../src/models/subscription/subscriptionItem.model';

// Define the SubscriptionItem type for testing
interface SubscriptionItem {
    id: string;
    sourceId: string;
    sourceType: string;
    linkedEntityId: string;
    entityType: string;
    createdAt: Date;
    updatedAt: Date;
    createdById?: string;
    updatedById?: string;
    deletedAt?: Date | null;
    deletedById?: string | null;
    adminInfo?: any;
}

// Mock data
const mockSubscriptionItem: SubscriptionItem = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    sourceId: '550e8400-e29b-41d4-a716-446655440002',
    sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
    linkedEntityId: '550e8400-e29b-41d4-a716-446655440003',
    entityType: SubscriptionItemEntityTypeEnum.CAMPAIGN,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

const mockSubscriptionItemForAccommodation: SubscriptionItem = {
    ...mockSubscriptionItem,
    id: '550e8400-e29b-41d4-a716-446655440004',
    entityType: SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('SubscriptionItemModel', () => {
    let subscriptionItemModel: SubscriptionItemModel;
    let mockDb: any;

    beforeEach(() => {
        subscriptionItemModel = new SubscriptionItemModel();
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            returning: vi.fn()
        };
        (dbUtils.getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (subscriptionItemModel as any).getTableName();
            expect(tableName).toBe('subscription_items');
        });
    });

    describe('polymorphic queries', () => {
        describe('findByEntityType', () => {
            it('should find subscription items by entity type', async () => {
                subscriptionItemModel.findAll = vi.fn().mockResolvedValue({
                    items: [mockSubscriptionItem],
                    total: 1
                });

                const result = await subscriptionItemModel.findByEntityType(
                    SubscriptionItemEntityTypeEnum.CAMPAIGN
                );

                expect(subscriptionItemModel.findAll).toHaveBeenCalledWith(
                    { entityType: SubscriptionItemEntityTypeEnum.CAMPAIGN },
                    undefined,
                    undefined
                );
                expect(result.items).toEqual([mockSubscriptionItem]);
            });
        });

        describe('findByLinkedEntity', () => {
            it('should find subscription items by linked entity ID', async () => {
                mockDb.limit = vi.fn().mockResolvedValue([mockSubscriptionItem]);

                const result = await subscriptionItemModel.findByLinkedEntity(
                    mockSubscriptionItem.linkedEntityId
                );

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toEqual([mockSubscriptionItem]);
            });

            it('should filter by entity type when provided', async () => {
                mockDb.limit = vi.fn().mockResolvedValue([mockSubscriptionItem]);

                await subscriptionItemModel.findByLinkedEntity(
                    mockSubscriptionItem.linkedEntityId,
                    SubscriptionItemEntityTypeEnum.CAMPAIGN
                );

                expect(mockDb.where).toHaveBeenCalled();
            });
        });

        describe('findBySource', () => {
            it('should find subscription items by source', async () => {
                mockDb.limit = vi.fn().mockResolvedValue([mockSubscriptionItem]);

                const result = await subscriptionItemModel.findBySource(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType
                );

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toEqual([mockSubscriptionItem]);
            });
        });
    });

    describe('business methods', () => {
        describe('linkToEntity', () => {
            it('should link an entity to a subscription', async () => {
                // Mock validateSourceExists to return true
                subscriptionItemModel.validateSourceExists = vi.fn().mockResolvedValue(true);
                mockDb.returning.mockResolvedValue([mockSubscriptionItem]);

                const result = await subscriptionItemModel.linkToEntity(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType,
                    mockSubscriptionItem.linkedEntityId,
                    mockSubscriptionItem.entityType
                );

                expect(subscriptionItemModel.validateSourceExists).toHaveBeenCalledWith(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType,
                    undefined
                );
                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sourceId: mockSubscriptionItem.sourceId,
                        sourceType: mockSubscriptionItem.sourceType,
                        linkedEntityId: mockSubscriptionItem.linkedEntityId,
                        entityType: mockSubscriptionItem.entityType
                    })
                );
                expect(result).toEqual(mockSubscriptionItem);
            });

            it('should throw error if source does not exist', async () => {
                subscriptionItemModel.validateSourceExists = vi.fn().mockResolvedValue(false);

                await expect(
                    subscriptionItemModel.linkToEntity(
                        'non-existent-source',
                        SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                        mockSubscriptionItem.linkedEntityId,
                        mockSubscriptionItem.entityType
                    )
                ).rejects.toThrow('Source SUBSCRIPTION with ID non-existent-source does not exist');
            });

            it('should throw error for unsupported entity type', async () => {
                subscriptionItemModel.validateSourceExists = vi.fn().mockResolvedValue(true);

                await expect(
                    subscriptionItemModel.linkToEntity(
                        mockSubscriptionItem.sourceId,
                        mockSubscriptionItem.sourceType,
                        mockSubscriptionItem.linkedEntityId,
                        'UNSUPPORTED_TYPE'
                    )
                ).rejects.toThrow('Unsupported entity type: UNSUPPORTED_TYPE');
            });
        });

        describe('unlinkFromEntity', () => {
            it('should unlink an entity from a subscription', async () => {
                mockDb.returning.mockResolvedValue([mockSubscriptionItem]);

                const result = await subscriptionItemModel.unlinkFromEntity(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType,
                    mockSubscriptionItem.linkedEntityId,
                    mockSubscriptionItem.entityType
                );

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        deletedAt: expect.any(Date),
                        updatedAt: expect.any(Date)
                    })
                );
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toBe(true);
            });

            it('should return false if no items were unlinked', async () => {
                mockDb.returning.mockResolvedValue([]);

                const result = await subscriptionItemModel.unlinkFromEntity(
                    'non-existent-source',
                    mockSubscriptionItem.sourceType,
                    mockSubscriptionItem.linkedEntityId,
                    mockSubscriptionItem.entityType
                );

                expect(result).toBe(false);
            });
        });

        describe('getLinkedEntity', () => {
            it('should return linked entity information', async () => {
                subscriptionItemModel.findById = vi.fn().mockResolvedValue(mockSubscriptionItem);

                const result = await subscriptionItemModel.getLinkedEntity(mockSubscriptionItem.id);

                expect(result).toEqual({
                    linkedEntityId: mockSubscriptionItem.linkedEntityId,
                    entityType: mockSubscriptionItem.entityType
                });
            });

            it('should return null for non-existent item', async () => {
                subscriptionItemModel.findById = vi.fn().mockResolvedValue(null);

                const result = await subscriptionItemModel.getLinkedEntity('non-existent-id');

                expect(result).toBeNull();
            });
        });
    });

    describe('validation methods', () => {
        describe('validateSourceExists', () => {
            it('should validate subscription source exists', async () => {
                mockDb.limit.mockResolvedValue([{ id: mockSubscriptionItem.sourceId }]);

                const result = await subscriptionItemModel.validateSourceExists(
                    mockSubscriptionItem.sourceId,
                    SubscriptionItemSourceTypeEnum.SUBSCRIPTION
                );

                expect(result).toBe(true);
            });

            it('should validate purchase source exists', async () => {
                mockDb.limit.mockResolvedValue([{ id: mockSubscriptionItem.sourceId }]);

                const result = await subscriptionItemModel.validateSourceExists(
                    mockSubscriptionItem.sourceId,
                    SubscriptionItemSourceTypeEnum.PURCHASE
                );

                expect(result).toBe(true);
            });

            it('should return false for non-existent source', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await subscriptionItemModel.validateSourceExists(
                    'non-existent-id',
                    SubscriptionItemSourceTypeEnum.SUBSCRIPTION
                );

                expect(result).toBe(false);
            });

            it('should return false for invalid source type', async () => {
                const result = await subscriptionItemModel.validateSourceExists(
                    mockSubscriptionItem.sourceId,
                    'INVALID_TYPE'
                );

                expect(result).toBe(false);
            });
        });

        describe('validateEntityExists', () => {
            it('should return true for valid entity parameters', async () => {
                const result = await subscriptionItemModel.validateEntityExists(
                    mockSubscriptionItem.linkedEntityId,
                    mockSubscriptionItem.entityType
                );

                expect(result).toBe(true);
            });

            it('should return false for missing parameters', async () => {
                const result1 = await subscriptionItemModel.validateEntityExists(
                    '',
                    mockSubscriptionItem.entityType
                );
                const result2 = await subscriptionItemModel.validateEntityExists(
                    mockSubscriptionItem.linkedEntityId,
                    ''
                );

                expect(result1).toBe(false);
                expect(result2).toBe(false);
            });
        });
    });

    describe('type-safe helpers', () => {
        beforeEach(() => {
            subscriptionItemModel.findBySource = vi
                .fn()
                .mockResolvedValue([mockSubscriptionItem, mockSubscriptionItemForAccommodation]);
        });

        describe('findAccommodationListings', () => {
            it('should filter accommodation listings', async () => {
                const result = await subscriptionItemModel.findAccommodationListings(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType
                );

                expect(result).toEqual([mockSubscriptionItemForAccommodation]);
            });
        });

        describe('findCampaigns', () => {
            it('should filter campaigns', async () => {
                const result = await subscriptionItemModel.findCampaigns(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType
                );

                expect(result).toEqual([mockSubscriptionItem]);
            });
        });

        describe('findSponsorship', () => {
            it('should filter sponsorships', async () => {
                subscriptionItemModel.findBySource = vi.fn().mockResolvedValue([
                    {
                        ...mockSubscriptionItem,
                        entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP
                    }
                ]);

                const result = await subscriptionItemModel.findSponsorship(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType
                );

                expect(result).toHaveLength(1);
                expect(result[0].entityType).toBe(SubscriptionItemEntityTypeEnum.SPONSORSHIP);
            });
        });

        describe('getEntityTypesForSource', () => {
            it('should return unique entity types for a source', async () => {
                const result = await subscriptionItemModel.getEntityTypesForSource(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType
                );

                expect(result).toEqual([
                    SubscriptionItemEntityTypeEnum.CAMPAIGN,
                    SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING
                ]);
            });
        });

        describe('countByEntityType', () => {
            it('should count items by entity type', async () => {
                const result = await subscriptionItemModel.countByEntityType(
                    mockSubscriptionItem.sourceId,
                    mockSubscriptionItem.sourceType
                );

                expect(result).toEqual({
                    [SubscriptionItemEntityTypeEnum.CAMPAIGN]: 1,
                    [SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING]: 1
                });
            });
        });
    });

    describe('complex polymorphic joins', () => {
        describe('withLinkedEntity', () => {
            it('should return item with linked entity details', async () => {
                subscriptionItemModel.findById = vi.fn().mockResolvedValue(mockSubscriptionItem);

                const result = await subscriptionItemModel.withLinkedEntity(
                    mockSubscriptionItem.id
                );

                expect(result).toEqual({
                    item: mockSubscriptionItem,
                    linkedEntityId: mockSubscriptionItem.linkedEntityId,
                    entityType: mockSubscriptionItem.entityType
                });
            });

            it('should return null for non-existent item', async () => {
                subscriptionItemModel.findById = vi.fn().mockResolvedValue(null);

                const result = await subscriptionItemModel.withLinkedEntity('non-existent-id');

                expect(result).toBeNull();
            });
        });
    });
});
