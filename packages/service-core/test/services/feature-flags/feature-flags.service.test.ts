import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type vi } from 'vitest';
import { FeatureFlagService } from '../../../src/services/feature-flags/feature-flags.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';

type FeatureFlagModelMock = StandardModelMock & {
    findActiveFlags: ReturnType<typeof vi.fn>;
    findByKey: ReturnType<typeof vi.fn>;
    createAuditLog: ReturnType<typeof vi.fn>;
    findAuditLogByFlagId: ReturnType<typeof vi.fn>;
    toggleActive: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
};

describe('FeatureFlagService', () => {
    let service: FeatureFlagService;
    let mockModel: FeatureFlagModelMock;

    const mockFlag = {
        id: '00000000-0000-4000-8000-000000000001',
        key: 'new-checkout',
        description: 'Enable new checkout flow',
        enabled: true,
        isActive: true,
        forceOnUserIds: [],
        forceOffUserIds: [],
        enabledForRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        updatedById: null
    };

    const mockAuditLogEntry = {
        id: '00000000-0000-4000-8000-000000000010',
        flagId: '00000000-0000-4000-8000-000000000001',
        action: 'created',
        previousValue: null,
        newValue: { key: 'new-checkout', enabled: false, isActive: true },
        reason: null,
        performedById: '00000000-0000-4000-8000-000000000100',
        createdAt: new Date()
    };

    const actor: Actor = {
        id: '00000000-0000-4000-8000-000000000100',
        role: RoleEnum.SUPER_ADMIN,
        permissions: [PermissionEnum.FEATURE_FLAG_MANAGE]
    };

    const actorNoPerms: Actor = {
        id: '00000000-0000-4000-8000-000000000200',
        role: RoleEnum.HOST,
        permissions: []
    };

    beforeEach(() => {
        mockModel = createModelMock([
            'findActiveFlags',
            'findByKey',
            'findAll',
            'create',
            'update',
            'delete',
            'toggleActive',
            'createAuditLog',
            'findAuditLogByFlagId'
        ]) as FeatureFlagModelMock;
        service = new FeatureFlagService(mockModel as never);
    });

    describe('getAllFlags()', () => {
        it('returns a key-value map of active flags', async () => {
            mockModel.findActiveFlags.mockResolvedValue([
                { ...mockFlag, key: 'flag-a', enabled: true },
                { ...mockFlag, key: 'flag-b', enabled: true }
            ]);

            const result = await service.getAllFlags();

            expect(result).toEqual({ 'flag-a': true, 'flag-b': true });
        });

        it('returns empty object when no active flags exist', async () => {
            mockModel.findActiveFlags.mockResolvedValue([]);

            const result = await service.getAllFlags();

            expect(result).toEqual({});
        });
    });

    describe('evaluateFlag()', () => {
        it('returns false when flag does not exist', async () => {
            mockModel.findByKey.mockResolvedValue(null);

            const result = await service.evaluateFlag('nonexistent');

            expect(result).toBe(false);
        });

        it('returns false when flag is not active (kill-switched)', async () => {
            mockModel.findByKey.mockResolvedValue({ ...mockFlag, isActive: false, enabled: true });

            const result = await service.evaluateFlag('kill-switched-flag');

            expect(result).toBe(false);
        });

        it('returns flag.enabled when no context matches', async () => {
            mockModel.findByKey.mockResolvedValue({ ...mockFlag, enabled: true });

            const result = await service.evaluateFlag('some-flag');

            expect(result).toBe(true);
        });

        it('returns true when user is in forceOnUserIds', async () => {
            const userId = '00000000-0000-4000-8000-000000000999';
            mockModel.findByKey.mockResolvedValue({
                ...mockFlag,
                enabled: false,
                isActive: true,
                forceOnUserIds: [userId],
                forceOffUserIds: []
            });

            const result = await service.evaluateFlag('dark-launch', { userId });

            expect(result).toBe(true);
        });

        it('returns false when user is in forceOffUserIds (even if enabled)', async () => {
            const userId = '00000000-0000-4000-8000-000000000999';
            mockModel.findByKey.mockResolvedValue({
                ...mockFlag,
                enabled: true,
                isActive: true,
                forceOnUserIds: [],
                forceOffUserIds: [userId]
            });

            const result = await service.evaluateFlag('flag', { userId });

            expect(result).toBe(false);
        });

        it('returns true when user role is in enabledForRoles', async () => {
            mockModel.findByKey.mockResolvedValue({
                ...mockFlag,
                enabled: false,
                isActive: true,
                enabledForRoles: [RoleEnum.SUPER_ADMIN],
                forceOnUserIds: [],
                forceOffUserIds: []
            });

            const result = await service.evaluateFlag('admin-only', { role: RoleEnum.SUPER_ADMIN });

            expect(result).toBe(true);
        });

        it('forceOnUserIds takes precedence over forceOffUserIds', async () => {
            const userId = '00000000-0000-4000-8000-000000000999';
            mockModel.findByKey.mockResolvedValue({
                ...mockFlag,
                enabled: false,
                isActive: true,
                forceOnUserIds: [userId],
                forceOffUserIds: [userId]
            });

            const result = await service.evaluateFlag('conflicting', { userId });

            expect(result).toBe(true);
        });

        it('returns default enabled value when no overrides match', async () => {
            mockModel.findByKey.mockResolvedValue({
                ...mockFlag,
                enabled: true,
                isActive: true,
                forceOnUserIds: [],
                forceOffUserIds: [],
                enabledForRoles: []
            });

            const result = await service.evaluateFlag('default-on');

            expect(result).toBe(true);
        });
    });

    describe('adminList()', () => {
        it('returns paginated flags for authorized actor', async () => {
            const paginatedResult = {
                items: [mockFlag],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            mockModel.findAll.mockResolvedValue(paginatedResult);

            const result = await service.adminList(actor, {
                page: 1,
                pageSize: 10,
                sort: 'createdAt:desc',
                status: 'all',
                includeDeleted: false
            });

            expect(result).toEqual(paginatedResult);
            expect(mockModel.findAll).toHaveBeenCalledWith({
                search: undefined,
                isActive: undefined,
                enabled: undefined,
                page: 1,
                pageSize: 10
            });
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(
                service.adminList(actorNoPerms, {
                    page: 1,
                    pageSize: 10,
                    sort: 'createdAt:desc',
                    status: 'all',
                    includeDeleted: false
                })
            ).rejects.toThrow(/FEATURE_FLAG_MANAGE/);
        });
    });

    describe('getById()', () => {
        it('returns flag for authorized actor', async () => {
            mockModel.findById.mockResolvedValue(mockFlag);

            const result = await service.getById(actor, mockFlag.id);

            expect(result).toEqual(mockFlag);
        });

        it('throws NOT_FOUND when flag does not exist', async () => {
            mockModel.findById.mockResolvedValue(null);

            await expect(service.getById(actor, 'nonexistent-id')).rejects.toThrow(/not found/i);
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(service.getById(actorNoPerms, mockFlag.id)).rejects.toThrow(
                /FEATURE_FLAG_MANAGE/
            );
        });
    });

    describe('createFlag()', () => {
        const createInput = {
            key: 'new-flag',
            description: 'A new feature flag',
            enabled: true,
            isActive: true,
            forceOnUserIds: [],
            forceOffUserIds: [],
            enabledForRoles: []
        };

        it('creates a flag and writes audit log', async () => {
            mockModel.findByKey.mockResolvedValue(null);
            mockModel.create.mockResolvedValue(mockFlag);
            mockModel.createAuditLog.mockResolvedValue(mockAuditLogEntry);

            const result = await service.createFlag(actor, createInput);

            expect(result).toEqual(mockFlag);
            expect(mockModel.create).toHaveBeenCalledWith({
                ...createInput,
                createdById: actor.id
            });
            expect(mockModel.createAuditLog).toHaveBeenCalledWith({
                flagId: mockFlag.id,
                action: 'created',
                newValue: {
                    key: mockFlag.key,
                    enabled: mockFlag.enabled,
                    isActive: mockFlag.isActive
                },
                performedById: actor.id
            });
        });

        it('throws VALIDATION_ERROR when key already exists', async () => {
            mockModel.findByKey.mockResolvedValue(mockFlag);

            await expect(service.createFlag(actor, createInput)).rejects.toThrow(/already exists/);
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(service.createFlag(actorNoPerms, createInput)).rejects.toThrow(
                /FEATURE_FLAG_MANAGE/
            );
        });
    });

    describe('updateFlag()', () => {
        const updateInput = { description: 'Updated description' };

        it('updates flag and writes audit log', async () => {
            const updatedFlag = { ...mockFlag, description: 'Updated description' };
            mockModel.findById.mockResolvedValue(mockFlag);
            mockModel.update.mockResolvedValue(updatedFlag);
            mockModel.createAuditLog.mockResolvedValue(mockAuditLogEntry);

            const result = await service.updateFlag(actor, mockFlag.id, updateInput);

            expect(result).toEqual(updatedFlag);
            expect(mockModel.update).toHaveBeenCalledWith(mockFlag.id, {
                ...updateInput,
                updatedById: actor.id
            });
            expect(mockModel.createAuditLog).toHaveBeenCalledWith({
                flagId: mockFlag.id,
                action: 'updated',
                previousValue: {
                    key: mockFlag.key,
                    enabled: mockFlag.enabled,
                    isActive: mockFlag.isActive
                },
                newValue: {
                    key: updatedFlag.key,
                    enabled: updatedFlag.enabled,
                    isActive: updatedFlag.isActive
                },
                performedById: actor.id
            });
        });

        it('throws NOT_FOUND when flag does not exist', async () => {
            mockModel.findById.mockResolvedValue(null);

            await expect(service.updateFlag(actor, 'nonexistent-id', updateInput)).rejects.toThrow(
                /not found/i
            );
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(
                service.updateFlag(actorNoPerms, mockFlag.id, updateInput)
            ).rejects.toThrow(/FEATURE_FLAG_MANAGE/);
        });
    });

    describe('toggleFlag()', () => {
        it('activates flag and writes audit log', async () => {
            const toggledFlag = { ...mockFlag, isActive: true };
            mockModel.findById.mockResolvedValue({ ...mockFlag, isActive: false });
            mockModel.toggleActive.mockResolvedValue(toggledFlag);
            mockModel.createAuditLog.mockResolvedValue(mockAuditLogEntry);

            const result = await service.toggleFlag(actor, mockFlag.id, true);

            expect(result).toEqual(toggledFlag);
            expect(mockModel.toggleActive).toHaveBeenCalledWith(mockFlag.id, {
                isActive: true,
                reason: undefined,
                performedById: actor.id
            });
            expect(mockModel.createAuditLog).toHaveBeenCalledWith({
                flagId: mockFlag.id,
                action: 'activated',
                previousValue: { isActive: false },
                newValue: { isActive: true },
                reason: undefined,
                performedById: actor.id
            });
        });

        it('deactivates flag with reason and writes audit log', async () => {
            const toggledFlag = { ...mockFlag, isActive: false };
            mockModel.findById.mockResolvedValue(mockFlag);
            mockModel.toggleActive.mockResolvedValue(toggledFlag);
            mockModel.createAuditLog.mockResolvedValue(mockAuditLogEntry);

            const result = await service.toggleFlag(
                actor,
                mockFlag.id,
                false,
                'Kill switch: bug in production'
            );

            expect(result).toEqual(toggledFlag);
            expect(mockModel.toggleActive).toHaveBeenCalledWith(mockFlag.id, {
                isActive: false,
                reason: 'Kill switch: bug in production',
                performedById: actor.id
            });
            expect(mockModel.createAuditLog).toHaveBeenCalledWith({
                flagId: mockFlag.id,
                action: 'deactivated',
                previousValue: { isActive: true },
                newValue: { isActive: false },
                reason: 'Kill switch: bug in production',
                performedById: actor.id
            });
        });

        it('throws NOT_FOUND when flag does not exist', async () => {
            mockModel.findById.mockResolvedValue(null);

            await expect(service.toggleFlag(actor, 'nonexistent-id', true)).rejects.toThrow(
                /not found/i
            );
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(service.toggleFlag(actorNoPerms, mockFlag.id, true)).rejects.toThrow(
                /FEATURE_FLAG_MANAGE/
            );
        });
    });

    describe('deleteFlag()', () => {
        it('deletes flag when it exists', async () => {
            mockModel.findById.mockResolvedValue(mockFlag);
            mockModel.delete.mockResolvedValue(undefined);

            await service.deleteFlag(actor, mockFlag.id);

            expect(mockModel.delete).toHaveBeenCalledWith(mockFlag.id);
        });

        it('throws NOT_FOUND when flag does not exist', async () => {
            mockModel.findById.mockResolvedValue(null);

            await expect(service.deleteFlag(actor, 'nonexistent-id')).rejects.toThrow(/not found/i);
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(service.deleteFlag(actorNoPerms, mockFlag.id)).rejects.toThrow(
                /FEATURE_FLAG_MANAGE/
            );
        });
    });

    describe('getAuditLog()', () => {
        it('returns audit log entries for authorized actor', async () => {
            mockModel.findAuditLogByFlagId.mockResolvedValue([mockAuditLogEntry]);

            const result = await service.getAuditLog(actor, mockFlag.id);

            expect(result).toEqual([mockAuditLogEntry]);
            expect(mockModel.findAuditLogByFlagId).toHaveBeenCalledWith(mockFlag.id);
        });

        it('returns empty array when no audit entries exist', async () => {
            mockModel.findAuditLogByFlagId.mockResolvedValue([]);

            const result = await service.getAuditLog(actor, mockFlag.id);

            expect(result).toEqual([]);
        });

        it('throws FORBIDDEN for unauthorized actor', async () => {
            await expect(service.getAuditLog(actorNoPerms, mockFlag.id)).rejects.toThrow(
                /FEATURE_FLAG_MANAGE/
            );
        });
    });
});
