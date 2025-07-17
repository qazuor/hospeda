import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const validInput = {
    role: RoleEnum.ADMIN,
    permission: PermissionEnum.USER_CREATE
};

describe('PermissionService.removePermissionFromRole', () => {
    let service: PermissionService;
    let rolePermissionModelMock: ReturnType<typeof createModelMock>;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        rolePermissionModelMock = createModelMock(['findOne', 'hardDelete']);
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

    it('should remove permission from role when assigned', async () => {
        rolePermissionModelMock.findOne.mockResolvedValue(validInput);
        rolePermissionModelMock.hardDelete.mockResolvedValue({});
        const result = await service.removePermissionFromRole(actor, validInput);
        expect(result.data).toEqual({ removed: true });
        expect(result.error).toBeUndefined();
        expect(rolePermissionModelMock.hardDelete).toHaveBeenCalled();
    });

    it('should return removed: false if not assigned', async () => {
        rolePermissionModelMock.findOne.mockResolvedValue(undefined);
        const result = await service.removePermissionFromRole(actor, validInput);
        expect(result.data).toEqual({ removed: false });
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.removePermissionFromRole(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid: Partial<typeof validInput> = {
            role: '' as RoleEnum,
            permission: '' as PermissionEnum
        };
        const result = await service.removePermissionFromRole(actor, invalid as typeof validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        rolePermissionModelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.removePermissionFromRole(actor, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
