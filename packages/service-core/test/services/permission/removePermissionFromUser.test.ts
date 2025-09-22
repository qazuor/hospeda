import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, type UserIdType } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    beforeEach(() => {
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
        actor = createActor({ permissions: [PermissionEnum.USER_UPDATE_ROLES] });
        vi.clearAllMocks();
    });

    it('should remove permission from user when assigned', async () => {
        userPermissionModelMock.findOne.mockResolvedValue(validInput);
        userPermissionModelMock.hardDelete.mockResolvedValue({});
        const result = await service.removePermissionFromUser(actor, validInput);
        expect(result.data).toEqual({ removed: true });
        expect(result.error).toBeUndefined();
        expect(userPermissionModelMock.hardDelete).toHaveBeenCalled();
    });

    it('should return removed: false if not assigned', async () => {
        userPermissionModelMock.findOne.mockResolvedValue(undefined);
        const result = await service.removePermissionFromUser(actor, validInput);
        expect(result.data).toEqual({ removed: false });
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.removePermissionFromUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = {
            userId: 'not-a-uuid' as any,
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
