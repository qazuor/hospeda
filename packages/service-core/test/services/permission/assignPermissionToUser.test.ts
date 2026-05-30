import type { RRolePermissionModel, RUserPermissionModel, UserModel } from '@repo/db';
import {
    PermissionEffectEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    type UserIdType
} from '@repo/schemas';
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

describe('PermissionService.assignPermissionToUser', () => {
    let service: PermissionService;
    let rolePermissionModelMock: ReturnType<typeof createModelMock>;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let userModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let cacheSpy: ReturnType<typeof vi.fn>;
    let auditSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        rolePermissionModelMock = createModelMock([]);
        userPermissionModelMock = createModelMock(['findOne', 'create', 'update']);
        userModelMock = createModelMock(['findById']);
        // Non-super target user by default; the SUPER_ADMIN guard is exercised explicitly.
        userModelMock.findById.mockResolvedValue({ id: validInput.userId, role: RoleEnum.USER });
        loggerMock = createLoggerMock();
        service = new PermissionService(
            { logger: loggerMock },
            {
                rolePermissionModel: rolePermissionModelMock as unknown as RRolePermissionModel,
                userPermissionModel: userPermissionModelMock as unknown as RUserPermissionModel,
                userModel: userModelMock as unknown as UserModel
            }
        );
        actor = createActor({ permissions: [PermissionEnum.PERMISSION_ASSIGN] });

        cacheSpy = vi.fn();
        auditSpy = vi.fn();
        setUserPermissionsCacheInvalidator(cacheSpy);
        setPermissionChangeAuditEmitter(auditSpy);
    });

    afterEach(() => {
        _resetPermissionEffects();
    });

    it('should create a grant override when none exists', async () => {
        userPermissionModelMock.findOne.mockResolvedValue(undefined);
        userPermissionModelMock.create.mockResolvedValue({});

        const result = await service.assignPermissionToUser(actor, validInput);

        expect(result.data).toEqual({ assigned: true });
        expect(result.error).toBeUndefined();
        expect(userPermissionModelMock.create).toHaveBeenCalledWith({
            userId: validInput.userId,
            permission: validInput.permission,
            effect: 'grant'
        });
    });

    it('should invalidate cache and emit audit after a successful assignment', async () => {
        userPermissionModelMock.findOne.mockResolvedValue(undefined);
        userPermissionModelMock.create.mockResolvedValue({});

        await service.assignPermissionToUser(actor, validInput);

        expect(cacheSpy).toHaveBeenCalledWith({ userId: validInput.userId });
        expect(auditSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                targetUserId: validInput.userId,
                changeType: 'permission_grant',
                oldValue: 'none',
                newValue: `${validInput.permission}:grant`
            })
        );
    });

    it('should return assigned: false when the same effect already exists (no-op)', async () => {
        userPermissionModelMock.findOne.mockResolvedValue({
            userId: validInput.userId,
            permission: validInput.permission,
            effect: 'grant'
        });

        const result = await service.assignPermissionToUser(actor, validInput);

        expect(result.data).toEqual({ assigned: false });
        expect(userPermissionModelMock.update).not.toHaveBeenCalled();
        expect(userPermissionModelMock.create).not.toHaveBeenCalled();
        expect(cacheSpy).not.toHaveBeenCalled();
    });

    it('should flip the effect (update in place) when an override with a different effect exists', async () => {
        userPermissionModelMock.findOne.mockResolvedValue({
            userId: validInput.userId,
            permission: validInput.permission,
            effect: 'grant'
        });
        userPermissionModelMock.update.mockResolvedValue({});

        const result = await service.assignPermissionToUser(actor, {
            ...validInput,
            effect: PermissionEffectEnum.DENY
        });

        expect(result.data).toEqual({ assigned: true });
        expect(userPermissionModelMock.update).toHaveBeenCalledWith(
            { userId: validInput.userId, permission: validInput.permission },
            { effect: 'deny' }
        );
        expect(userPermissionModelMock.create).not.toHaveBeenCalled();
        expect(auditSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                oldValue: 'grant',
                newValue: `${validInput.permission}:deny`
            })
        );
    });

    it('should return a 400 (VALIDATION_ERROR) when the target user is a SUPER_ADMIN', async () => {
        userModelMock.findById.mockResolvedValue({
            id: validInput.userId,
            role: RoleEnum.SUPER_ADMIN
        });

        const result = await service.assignPermissionToUser(actor, validInput);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
        expect(userPermissionModelMock.create).not.toHaveBeenCalled();
        expect(userPermissionModelMock.update).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.assignPermissionToUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = {
            userId: 'not-a-uuid' as unknown as UserIdType,
            permission: '' as PermissionEnum
        };
        const result = await service.assignPermissionToUser(actor, invalid as typeof validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        userPermissionModelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.assignPermissionToUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
