/** TEST:V5:16 (HOS-1460): direct assignment rejects and legacy exclusive rows are ineffective. */
import {
    eq,
    getDb,
    RRolePermissionModel,
    RUserPermissionModel,
    rolePermission,
    sql,
    userPermission,
    userRole
} from '@repo/db';
import {
    PermissionEffectEnum,
    PermissionEnum,
    RoleEnum,
    SUPER_ADMIN_EXCLUSIVE_PERMISSIONS
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { PermissionService } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resolveEffectivePermissions } from '../../../src/middlewares/actor';
import { apiLogger } from '../../../src/utils/logger';
import { testDb } from '../../e2e/setup/test-database';
import { createOwner } from '../listing-publication/publication-routes.helpers';

const rolePermissionModel = new RRolePermissionModel();
const userPermissionModel = new RUserPermissionModel();
const service = new PermissionService(
    { logger: apiLogger },
    { rolePermissionModel, userPermissionModel }
);
const actor: Actor = {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.PERMISSION_ASSIGN],
    entitlements: new Set<string>()
};
const createdUserIds: string[] = [];
const plantedRolePermissions: Array<{ role: RoleEnum; permission: PermissionEnum }> = [];

beforeAll(async () => testDb.setup());
afterEach(async () => {
    const db = getDb();
    for (const id of createdUserIds.splice(0)) {
        await db.delete(userPermission).where(eq(userPermission.userId, id));
        await db.delete(userRole).where(eq(userRole.userId, id));
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
        expect(await db.select().from(userPermission).where(eq(userPermission.userId, id))).toEqual(
            []
        );
    }
    for (const row of plantedRolePermissions.splice(0)) {
        // Delete only the row this test planted, preserving other permissions for that role.
        await db.execute(sql`
            DELETE FROM role_permission WHERE role = ${row.role} AND permission = ${row.permission}
        `);
        expect(
            await db
                .select()
                .from(rolePermission)
                .where(eq(rolePermission.permission, row.permission))
        ).not.toContainEqual(row);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V5:16 SUPER_ADMIN-exclusive permission assignment and resolution', () => {
    it('rejects assignment and subtracts legacy user and role rows while SUPER_ADMIN keeps all permissions', async () => {
        const target = await createOwner();
        createdUserIds.push(target.id);
        await getDb().insert(userRole).values({ userId: target.id, role: RoleEnum.CLIENT_MANAGER });

        for (const permission of SUPER_ADMIN_EXCLUSIVE_PERMISSIONS) {
            for (const effect of [PermissionEffectEnum.GRANT, PermissionEffectEnum.DENY]) {
                const result = await service.assignPermissionToUser(actor, {
                    userId: target.id,
                    permission,
                    effect
                });
                expect(result.error?.code).toBe('VALIDATION_ERROR');
                expect(result.error?.reason).toBe('SUPER_ADMIN_ONLY_PERMISSION');
                expect(
                    await userPermissionModel.findOne({ userId: target.id, permission })
                ).toBeFalsy();
            }
            for (const role of [RoleEnum.CLIENT_MANAGER, RoleEnum.ADMIN]) {
                const result = await service.assignPermissionToRole(actor, { role, permission });
                expect(result.error?.code).toBe('VALIDATION_ERROR');
                expect(result.error?.reason).toBe('SUPER_ADMIN_ONLY_PERMISSION');
                expect(await rolePermissionModel.findOne({ role, permission })).toBeFalsy();
            }
            await userPermissionModel.create({
                userId: target.id,
                permission,
                effect: PermissionEffectEnum.GRANT
            });
        }
        await userPermissionModel.create({
            userId: target.id,
            permission: PermissionEnum.POST_VIEW_ALL,
            effect: PermissionEffectEnum.GRANT
        });

        const effective = await resolveEffectivePermissions({
            userId: target.id,
            roles: [RoleEnum.CLIENT_MANAGER],
            read: 'uncached'
        });
        for (const permission of SUPER_ADMIN_EXCLUSIVE_PERMISSIONS) {
            expect(effective.permissions).not.toContain(permission);
        }
        expect(effective.permissions).toContain(PermissionEnum.POST_VIEW_ALL);

        const plantedAdminRow = {
            role: RoleEnum.ADMIN,
            permission: SUPER_ADMIN_EXCLUSIVE_PERMISSIONS[0]
        };
        const prior = await rolePermissionModel.findOne(plantedAdminRow);
        if (!prior) {
            await rolePermissionModel.create(plantedAdminRow);
            plantedRolePermissions.push(plantedAdminRow);
        }
        const adminEffective = await resolveEffectivePermissions({
            userId: target.id,
            roles: [RoleEnum.ADMIN],
            read: 'uncached'
        });
        expect(adminEffective.permissions).not.toContain(plantedAdminRow.permission);

        const superAdmin = await resolveEffectivePermissions({
            userId: target.id,
            roles: [RoleEnum.SUPER_ADMIN],
            read: 'uncached'
        });
        expect(superAdmin.permissions).toEqual(Object.values(PermissionEnum));
    });
});
