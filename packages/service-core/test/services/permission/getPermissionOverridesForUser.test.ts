import type { RRolePermissionModel, RUserPermissionModel, UserModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode, type UserIdType } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const userId = getMockId('user', 'user-1') as UserIdType;
const validInput = { userId };

describe('PermissionService.getPermissionOverridesForUser', () => {
    let service: PermissionService;
    let rolePermissionModelMock: ReturnType<typeof createModelMock>;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let userModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        rolePermissionModelMock = createModelMock(['findAll']);
        userPermissionModelMock = createModelMock(['findAll']);
        userModelMock = createModelMock(['findById']);
        userModelMock.findById.mockResolvedValue({ id: userId, role: RoleEnum.EDITOR });
        loggerMock = createLoggerMock();
        service = new PermissionService(
            { logger: loggerMock },
            {
                rolePermissionModel: rolePermissionModelMock as unknown as RRolePermissionModel,
                userPermissionModel: userPermissionModelMock as unknown as RUserPermissionModel,
                userModel: userModelMock as unknown as UserModel
            }
        );
        actor = createActor({ permissions: [PermissionEnum.PERMISSION_VIEW] });
    });

    it('should return overrides split by effect plus the role permissions', async () => {
        userPermissionModelMock.findAll.mockResolvedValue({
            items: [
                { userId, permission: PermissionEnum.POST_CREATE, effect: 'grant' },
                { userId, permission: PermissionEnum.USER_DELETE, effect: 'deny' }
            ]
        });
        rolePermissionModelMock.findAll.mockResolvedValue({
            items: [
                { role: RoleEnum.EDITOR, permission: PermissionEnum.USER_CREATE },
                { role: RoleEnum.EDITOR, permission: PermissionEnum.USER_DELETE }
            ]
        });

        const result = await service.getPermissionOverridesForUser(actor, validInput);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({
            fromRole: [PermissionEnum.USER_CREATE, PermissionEnum.USER_DELETE],
            grantOverrides: [PermissionEnum.POST_CREATE],
            denyOverrides: [PermissionEnum.USER_DELETE]
        });
        expect(rolePermissionModelMock.findAll).toHaveBeenCalledWith({ role: RoleEnum.EDITOR });
    });

    it('should return empty buckets when the user has no overrides', async () => {
        userPermissionModelMock.findAll.mockResolvedValue({ items: [] });
        rolePermissionModelMock.findAll.mockResolvedValue({ items: [] });

        const result = await service.getPermissionOverridesForUser(actor, validInput);

        expect(result.data).toEqual({ fromRole: [], grantOverrides: [], denyOverrides: [] });
    });

    it('should return FORBIDDEN when the actor lacks PERMISSION_VIEW', async () => {
        actor = createActor({ permissions: [] });

        const result = await service.getPermissionOverridesForUser(actor, validInput);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND when the target user does not exist', async () => {
        userModelMock.findById.mockResolvedValue(null);

        const result = await service.getPermissionOverridesForUser(actor, validInput);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });
});
