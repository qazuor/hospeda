import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const validInput = {
    role: RoleEnum.ADMIN
};

describe('PermissionService.getPermissionsForRole', () => {
    let service: PermissionService;
    let rolePermissionModelMock: ReturnType<typeof createModelMock>;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        rolePermissionModelMock = createModelMock(['findAll']);
        userPermissionModelMock = createModelMock([]);
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

    it('should return permissions for role when valid', async () => {
        rolePermissionModelMock.findAll.mockResolvedValue({
            items: [
                { role: validInput.role, permission: PermissionEnum.USER_CREATE },
                { role: validInput.role, permission: PermissionEnum.USER_DELETE }
            ]
        });
        const result = await service.getPermissionsForRole(actor, validInput);
        expect(result.data).toEqual({
            permissions: [PermissionEnum.USER_CREATE, PermissionEnum.USER_DELETE]
        });
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.getPermissionsForRole(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = { role: undefined };
        const result = await service.getPermissionsForRole(actor, invalid as typeof validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        rolePermissionModelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getPermissionsForRole(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
