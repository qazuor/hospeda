import type { ClientAccessRight } from '@repo/schemas';
import { AccessRightScopeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { ClientAccessRightModel } from '../../src/models/client/clientAccessRight.model';

// Mock data
const mockClientAccessRight: ClientAccessRight = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
    feature: 'PREMIUM_LISTING',
    scope: AccessRightScopeEnum.ACCOMMODATION,
    scopeId: '550e8400-e29b-41d4-a716-446655440003',
    scopeType: 'ACCOMMODATION',
    validFrom: new Date('2024-01-01T00:00:00Z'),
    validTo: new Date('2024-12-31T23:59:59Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: null
};

const mockGlobalAccessRight: ClientAccessRight = {
    id: '550e8400-e29b-41d4-a716-446655440004',
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    subscriptionItemId: '550e8400-e29b-41d4-a716-446655440005',
    feature: 'ADMIN_ACCESS',
    scope: AccessRightScopeEnum.GLOBAL,
    scopeId: null,
    scopeType: null,
    validFrom: new Date('2024-01-01T00:00:00Z'),
    validTo: undefined,
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

describe('ClientAccessRightModel', () => {
    let clientAccessRightModel: ClientAccessRightModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clientAccessRightModel = new ClientAccessRightModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (
                clientAccessRightModel as unknown as { getTableName(): string }
            ).getTableName();
            expect(tableName).toBe('client_access_rights');
        });
    });

    describe('findByScope', () => {
        it('should find access rights by scope', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClientAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientAccessRightModel.findByScope(
                AccessRightScopeEnum.ACCOMMODATION
            );

            expect(result).toHaveLength(1);
            expect(result[0].scope).toBe(AccessRightScopeEnum.ACCOMMODATION);
        });
    });

    describe('findByScopeType', () => {
        it('should find access rights by scope type', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClientAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientAccessRightModel.findByScopeType('ACCOMMODATION');

            expect(result).toHaveLength(1);
            expect(result[0].scopeType).toBe('ACCOMMODATION');
        });
    });

    describe('findActiveRights', () => {
        it('should find currently active rights', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClientAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientAccessRightModel.findActiveRights();

            expect(result).toHaveLength(1);
            expect(result[0].validFrom).toBeInstanceOf(Date);
        });
    });

    describe('hasPermission', () => {
        it('should check if client has specific permission', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClientAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const hasPermission = await clientAccessRightModel.hasPermission(
                mockClientAccessRight.clientId,
                'PREMIUM_LISTING',
                AccessRightScopeEnum.ACCOMMODATION
            );

            expect(hasPermission).toBe(true);
        });

        it('should return false if client does not have permission', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const hasPermission = await clientAccessRightModel.hasPermission(
                'non-existent-client',
                'PREMIUM_LISTING',
                AccessRightScopeEnum.ACCOMMODATION
            );

            expect(hasPermission).toBe(false);
        });
    });

    describe('findBySubscriptionItem', () => {
        it('should find access rights by subscription item', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClientAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientAccessRightModel.findBySubscriptionItem(
                mockClientAccessRight.subscriptionItemId
            );

            expect(result).toHaveLength(1);
            expect(result[0].subscriptionItemId).toBe(mockClientAccessRight.subscriptionItemId);
        });
    });

    describe('findExpiring', () => {
        it('should find expiring access rights within days', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClientAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientAccessRightModel.findExpiring(30);

            expect(result).toHaveLength(1);
            expect(result[0].validTo).toBeInstanceOf(Date);
        });
    });

    describe('getActiveFeatures', () => {
        it('should get active features for client', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi
                            .fn()
                            .mockResolvedValue([mockClientAccessRight, mockGlobalAccessRight])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const features = await clientAccessRightModel.getActiveFeatures(
                mockClientAccessRight.clientId
            );

            expect(features).toHaveLength(2);
            expect(features).toContain('PREMIUM_LISTING');
            expect(features).toContain('ADMIN_ACCESS');
        });
    });
});
