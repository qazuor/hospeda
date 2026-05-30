import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, type UserIdType } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _resetPermissionEffects,
    setPermissionChangeAuditEmitter,
    setUserPermissionsCacheInvalidator
} from '../../../src/services/permission/permission.effects';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const validInput = {
    userId: getMockId('user', 'user-1') as UserIdType,
    permission: PermissionEnum.USER_CREATE
};

describe('PermissionService.removePermissionFromUser', () => {
    let service: PermissionService;
    let rolePermissionModelMock: ReturnType<typeof createModelMock>;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let cacheSpy: ReturnType<typeof vi.fn>;
    let auditSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        rolePermissionModelMock = createModelMock([]);
        userPermissionModelMock = createModelMock(['findOne', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = new PermissionService(
            { logger: loggerMock },
            {
                rolePermissionModel: rolePermissionModelMock as unknown as RRolePermissionModel,
                userPermissionModel: userPermissionModelMock as unknown as RUserPermissionModel
            }
        );
        actor = createActor({ permissions: [PermissionEnum.PERMISSION_REVOKE] });

        cacheSpy = vi.fn();
        auditSpy = vi.fn();
        setUserPermissionsCacheInvalidator(cacheSpy);
        setPermissionChangeAuditEmitter(auditSpy);
    });

    afterEach(() => {
        _resetPermissionEffects();
    });

    it('should remove permission from user when assigned', async () => {
        userPermissionModelMock.findOne.mockResolvedValue({ ...validInput, effect: 'deny' });
        userPermissionModelMock.hardDelete.mockResolvedValue({});

        const result = await service.removePermissionFromUser(actor, validInput);

        expect(result.data).toEqual({ removed: true });
        expect(result.error).toBeUndefined();
        expect(userPermissionModelMock.hardDelete).toHaveBeenCalled();
    });

    it('should invalidate cache and emit a revoke audit after removal', async () => {
        userPermissionModelMock.findOne.mockResolvedValue({ ...validInput, effect: 'deny' });
        userPermissionModelMock.hardDelete.mockResolvedValue({});

        await service.removePermissionFromUser(actor, validInput);

        expect(cacheSpy).toHaveBeenCalledWith({ userId: validInput.userId });
        expect(auditSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                targetUserId: validInput.userId,
                changeType: 'permission_revoke',
                oldValue: `${validInput.permission}:deny`,
                newValue: 'none'
            })
        );
    });

    it('should return removed: false if not assigned', async () => {
        userPermissionModelMock.findOne.mockResolvedValue(undefined);

        const result = await service.removePermissionFromUser(actor, validInput);

        expect(result.data).toEqual({ removed: false });
        expect(result.error).toBeUndefined();
        expect(cacheSpy).not.toHaveBeenCalled();
        expect(auditSpy).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.removePermissionFromUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = {
            userId: 'not-a-uuid' as unknown as UserIdType,
            permission: '' as PermissionEnum
        };
        const result = await service.removePermissionFromUser(actor, invalid as typeof validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        userPermissionModelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.removePermissionFromUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
