import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const validInput = {
    permission: PermissionEnum.USER_CREATE
};

describe('PermissionService.getRolesForPermission', () => {
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

    it('should return roles for permission when valid', async () => {
        rolePermissionModelMock.findAll.mockResolvedValue({
            items: [
                { role: 'ADMIN', permission: PermissionEnum.USER_CREATE },
                { role: 'EDITOR', permission: PermissionEnum.USER_CREATE }
            ]
        });
        const result = await service.getRolesForPermission(actor, validInput);
        expect(result.data).toEqual({ roles: ['ADMIN', 'EDITOR'] });
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.getRolesForPermission(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = { permission: '' as PermissionEnum };
        const result = await service.getRolesForPermission(actor, invalid as typeof validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        rolePermissionModelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getRolesForPermission(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
