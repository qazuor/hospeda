/**
 * @file count.test.ts
 *
 * Tests for UserService.count method.
 * Covers: success (admin, super admin), forbidden, validation error, internal error, lifecycle hook errors.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createUser } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const getActor = (role: RoleEnum = RoleEnum.ADMIN) => createUser({ role });
const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.count', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const admin = getActor(RoleEnum.ADMIN);
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN);
    const user = getActor(RoleEnum.USER);

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['count']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should return the count if actor is admin', async () => {
        asMock(userModelMock.count).mockResolvedValue(42);
        const filters = { role: RoleEnum.USER };
        const result = await service.count(admin, { filters });
        expectSuccess(result);
        expect(result.data).toEqual({ count: 42 });
        expect(asMock(userModelMock.count)).toHaveBeenCalledWith(filters);
    });

    it('should return the count if actor is super admin', async () => {
        asMock(userModelMock.count).mockResolvedValue(7);
        const filters = { role: RoleEnum.USER };
        const result = await service.count(superAdmin, { filters });
        expectSuccess(result);
        expect(result.data).toEqual({ count: 7 });
        expect(asMock(userModelMock.count)).toHaveBeenCalledWith(filters);
    });

    it('should return FORBIDDEN if actor is not admin or super admin', async () => {
        asMock(userModelMock.count).mockResolvedValue(0);
        const filters = { role: RoleEnum.USER };
        const result = await service.count(user, { filters });
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.count(admin, { filters: { role: 123 } });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(userModelMock.count).mockRejectedValue(new Error('DB error'));
        const filters = { role: RoleEnum.USER };
        const result = await service.count(admin, { filters });
        expectInternalError(result);
    });

    it('should handle errors from the _beforeCount hook', async () => {
        asMock(userModelMock.count).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _beforeCount: () => void },
            '_beforeCount'
        ).mockRejectedValue(new Error('beforeCount error'));
        const filters = { role: RoleEnum.USER };
        const result = await service.count(admin, { filters });
        expectInternalError(result);
    });

    it('should handle errors from the _afterCount hook', async () => {
        asMock(userModelMock.count).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _afterCount: () => void },
            '_afterCount'
        ).mockRejectedValue(new Error('afterCount error'));
        const filters = { role: RoleEnum.USER };
        const result = await service.count(admin, { filters });
        expectInternalError(result);
    });
});
