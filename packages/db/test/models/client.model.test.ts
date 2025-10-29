import type { Client } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { ClientModel } from '../../src/models/client/client.model';

// Mock data
const mockClient: Client = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Client Ltd',
    billingEmail: 'billing@testclient.com',
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: null
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('ClientModel', () => {
    let clientModel: ClientModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clientModel = new ClientModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (clientModel as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('clients');
        });
    });

    describe('findByUser', () => {
        it('should find client by user ID', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClient])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const userId = mockClient.userId;
            if (userId) {
                const result = await clientModel.findByUser(userId);

                expect(result).toBeDefined();
                expect(result?.userId).toBe(mockClient.userId);
            }
        });

        it('should return null if client not found', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientModel.findByUser('non-existent-user-id');

            expect(result).toBeNull();
        });
    });
});
