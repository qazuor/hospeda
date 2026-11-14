/**
 * Unit tests for the extracted `buildActorForUser` function (HOS-2184 T-007).
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/role-permissions-cache');
vi.mock('../../src/utils/user-permissions-cache');
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, getUserRoles: vi.fn() };
});

import { getUserRoles } from '@repo/service-core';
import { buildActorForUser } from '../../src/middlewares/actor';
import { getPermissionsForRoles } from '../../src/utils/role-permissions-cache';
import { getUserPermissionsWithEffect } from '../../src/utils/user-permissions-cache';

const mockGetUserRoles = vi.mocked(getUserRoles);
const mockGetPermissionsForRoles = vi.mocked(getPermissionsForRoles);
const mockGetUserPermissionsWithEffect = vi.mocked(getUserPermissionsWithEffect);

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('buildActorForUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserRoles.mockResolvedValue([RoleEnum.HOST]);
        mockGetPermissionsForRoles.mockResolvedValue([PermissionEnum.ACCESS_API_PUBLIC]);
        mockGetUserPermissionsWithEffect.mockResolvedValue({
            grants: [PermissionEnum.USER_UPDATE_PROFILE],
            denies: []
        });
    });

    it('builds an actor with roles, effective permissions and profile fields', async () => {
        // Arrange
        const user = {
            id: USER_ID,
            name: 'Ana',
            email: 'ana@example.com',
            emailVerified: true,
            image: 'https://img.example/a.png',
            mustChangePassword: true
        };

        // Act
        const actor = await buildActorForUser({ user });

        // Assert
        expect(actor).toMatchObject({
            id: USER_ID,
            roles: [RoleEnum.HOST],
            name: 'Ana',
            email: 'ana@example.com',
            emailVerified: true,
            image: 'https://img.example/a.png',
            mustChangePassword: true
        });
        expect(actor.permissions).toEqual(
            expect.arrayContaining([
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.USER_UPDATE_PROFILE
            ])
        );
        expect(mockGetUserRoles).toHaveBeenCalledWith({ userId: USER_ID });
    });

    it('applies per-user denies over the role union', async () => {
        // Arrange
        mockGetUserPermissionsWithEffect.mockResolvedValue({
            grants: [],
            denies: [PermissionEnum.ACCESS_API_PUBLIC]
        });

        // Act
        const actor = await buildActorForUser({ user: { id: USER_ID } });

        // Assert
        expect(actor.permissions).not.toContain(PermissionEnum.ACCESS_API_PUBLIC);
    });

    it('uses mockRoles instead of reading user_role', async () => {
        // Act
        const actor = await buildActorForUser({
            user: { id: USER_ID },
            mockRoles: [RoleEnum.SUPER_ADMIN]
        });

        // Assert
        expect(actor.roles).toEqual([RoleEnum.SUPER_ADMIN]);
        expect(mockGetUserRoles).not.toHaveBeenCalled();
    });

    it('returns the guest actor when there is no user', async () => {
        // Act
        const actor = await buildActorForUser({ user: null });

        // Assert
        expect(actor.roles).toEqual([RoleEnum.GUEST]);
        expect(mockGetUserRoles).not.toHaveBeenCalled();
    });

    it('throws a 503 when the user holds no roles', async () => {
        // Arrange
        mockGetUserRoles.mockResolvedValue([]);

        // Act + Assert
        await expect(buildActorForUser({ user: { id: USER_ID } })).rejects.toMatchObject({
            status: 503
        });
    });
});
