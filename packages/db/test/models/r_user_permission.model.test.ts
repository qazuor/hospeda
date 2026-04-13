import type { UserIdType, UserPermissionAssignment } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RUserPermissionModel } from '../../src/models/user/rUserPermission.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/utils/logger');

const model = new RUserPermissionModel();
const asUserId = (id: string) => id as unknown as UserIdType;

/**
 * Test suite for RUserPermissionModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

// This file uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
// This is documented and justified according to project rules.

describe('RUserPermissionModel', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const userPermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                userId: asUserId('a'),
                permission: PermissionEnum.USER_READ_ALL,
                user: {}
            })
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                userPermission: userPermissionMock
            }
        });
        const result = await model.findWithRelations({ userId: asUserId('a') }, { user: true });
        expect(result).toBeTruthy();
        expect((result as { user?: unknown }).user).toBeDefined();
    });

    it('findWithRelations - sin relaciones, fallback a findOne', async () => {
        const dummy: UserPermissionAssignment = {
            userId: asUserId('a'),
            permission: PermissionEnum.USER_READ_ALL
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations({ userId: asUserId('a') }, {});
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - no encontrada', async () => {
        const userPermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                userPermission: userPermissionMock
            }
        });
        const result = await model.findWithRelations({ userId: asUserId('x') }, { user: true });
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const userPermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                userPermission: userPermissionMock
            }
        });
        await expect(
            model.findWithRelations({ userId: asUserId('a') }, { user: true })
        ).rejects.toThrow(DbError);
    });

    // ========================================================================
    // T-049: tx propagation for RUserPermissionModel
    // ========================================================================
    describe('tx propagation', () => {
        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue(null);
            const mockTx = { query: { userPermission: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ userId: asUserId('u1') }, { user: true }, mockTx);

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
            await model.findWithRelations({ userId: asUserId('u1') }, {}, mockTx);

            // Assert
            expect(findOneSpy).toHaveBeenCalledWith({ userId: asUserId('u1') }, mockTx);

            spy.mockRestore();
            findOneSpy.mockRestore();
        });
    });
});
