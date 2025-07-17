import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const validInput = {
    userId: getMockId('user', 'user-1')
};

describe('PermissionService.getPermissionsForUser', () => {
    let service: PermissionService;
    let rolePermissionModelMock: ReturnType<typeof createModelMock>;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        rolePermissionModelMock = createModelMock([]);
        userPermissionModelMock = createModelMock(['findAll']);
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

    it('should return permissions for user when valid', async () => {
        userPermissionModelMock.findAll.mockResolvedValue({
            items: [
                { userId: validInput.userId, permission: PermissionEnum.USER_CREATE },
                { userId: validInput.userId, permission: PermissionEnum.USER_DELETE }
            ]
        });
        const result = await service.getPermissionsForUser(actor, validInput);
        expect(result.data).toEqual({
            permissions: [PermissionEnum.USER_CREATE, PermissionEnum.USER_DELETE]
        });
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.getPermissionsForUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = { userId: '' };
        const result = await service.getPermissionsForUser(actor, invalid as typeof validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        userPermissionModelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getPermissionsForUser(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
