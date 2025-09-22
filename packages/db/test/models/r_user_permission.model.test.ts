import type { UserIdType, UserPermissionAssignment } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/client';
import { RUserPermissionModel } from '../../src/models/user/rUserPermission.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/client');
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
        vi.clearAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const userPermissionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                userId: asUserId('a'),
                permission: PermissionEnum.USER_READ_ALL,
                user: {}
            })
        });
        vi.mocked(getDb).mockReturnValue({
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
        vi.mocked(getDb).mockReturnValue({
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
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                userPermission: userPermissionMock
            }
        });
        await expect(
            model.findWithRelations({ userId: asUserId('a') }, { user: true })
        ).rejects.toThrow(DbError);
    });
});
