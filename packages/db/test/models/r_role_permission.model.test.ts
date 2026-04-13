import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RRolePermissionModel } from '../../src/models/user/rRolePermission.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/utils/logger');

const model = new RRolePermissionModel();

/**
 * Test suite for RRolePermissionModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

describe('RRolePermissionModel', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const rolePermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                role: RoleEnum.ADMIN,
                permission: PermissionEnum.USER_CREATE
            })
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
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
        vi.mocked(dbUtils.getDb).mockReturnValue({
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
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rolePermission: rolePermissionMock
            }
        });
        await expect(
            model.findWithRelations({ role: RoleEnum.ADMIN }, { role: true })
        ).rejects.toThrow(DbError);
    });

    // ========================================================================
    // T-049: tx propagation for RRolePermissionModel
    // ========================================================================
    describe('tx propagation', () => {
        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue(null);
            const mockTx = { query: { rolePermission: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ role: RoleEnum.ADMIN }, { role: true }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(dbUtils.getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('findWithRelations() threads tx to findOne in fallback branch', async () => {
            // Arrange
            const mockTx = {} as any;
            const findOneSpy = vi.spyOn(model, 'findOne').mockResolvedValue(null);
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ role: RoleEnum.ADMIN }, {}, mockTx);

            // Assert
            expect(findOneSpy).toHaveBeenCalledWith({ role: RoleEnum.ADMIN }, mockTx);

            spy.mockRestore();
            findOneSpy.mockRestore();
        });
    });
});
