import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { CampaignModel } from '../../src/models/campaign/campaign.model';
import type { campaigns } from '../../src/schemas/marketing/campaign.dbschema';

// Use inferred type from database schema
type Campaign = typeof campaigns.$inferSelect;

// Mock data
const mockCampaign: Campaign = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Campaign',
    channel: 'WEB',
    fromDate: new Date('2024-01-01T00:00:00Z'),
    toDate: new Date('2024-01-31T00:00:00Z'),
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

// Mock database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

describe('CampaignModel', () => {
    let campaignModel: CampaignModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        campaignModel = new CampaignModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('CampaignModel basic functionality', () => {
        it('should be instantiated correctly', () => {
            expect(campaignModel).toBeDefined();
            expect(campaignModel).toBeInstanceOf(CampaignModel);
        });
    });

    describe('findByClient', () => {
        it('should find campaigns by client ID', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockCampaign])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await campaignModel.findByClient('550e8400-e29b-41d4-a716-446655440000');

            expect(mockDb.select).toHaveBeenCalled();
            expect(result).toEqual([mockCampaign]);
        });

        it('should return empty array if no campaigns found', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await campaignModel.findByClient('non-existent-client-id');

            expect(result).toEqual([]);
        });
    });

    describe('findActive', () => {
        it('should find active campaigns', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockCampaign])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await campaignModel.findActive();

            expect(mockDb.select).toHaveBeenCalled();
            expect(result).toEqual([mockCampaign]);
        });
    });
});
