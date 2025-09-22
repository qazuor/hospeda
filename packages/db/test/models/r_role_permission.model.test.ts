import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/client';
import { RRolePermissionModel } from '../../src/models/user/rRolePermission.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/client');
vi.mock('../../src/utils/logger');

const model = new RRolePermissionModel();

/**
 * Test suite for RRolePermissionModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

describe('RRolePermissionModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const rolePermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                role: RoleEnum.ADMIN,
                permission: PermissionEnum.USER_CREATE
            })
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rolePermission: rolePermissionMock
            }
        });
        const result = await model.findWithRelations({ role: RoleEnum.ADMIN }, { role: true });
        expect(result).toBeTruthy();
        expect((result as { role?: unknown }).role).toBeDefined();
    });

    it('findWithRelations - sin relaciones, fallback a findOne', async () => {
        const dummy = {
            role: RoleEnum.ADMIN,
            permission: PermissionEnum.USER_CREATE
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations({ role: RoleEnum.ADMIN }, {});
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - no encontrada', async () => {
        const rolePermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rolePermission: rolePermissionMock
            }
        });
        const result = await model.findWithRelations({ role: RoleEnum.ADMIN }, { role: true });
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const rolePermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rolePermission: rolePermissionMock
            }
        });
        await expect(
            model.findWithRelations({ role: RoleEnum.ADMIN }, { role: true })
        ).rejects.toThrow(DbError);
    });
});
