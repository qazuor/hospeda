/**
 * @file list.test.ts
 *
 * Tests for UserService.list method.
 * Covers: success (admin, super admin), forbidden, internal error, lifecycle hook errors, normalizer usage, pagination.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createUser } from '../../factories/userFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const getActor = (role: RoleEnum = RoleEnum.ADMIN) => createUser({ role });
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;
const paginated = (items: unknown[], page = 1, pageSize = 10) => ({
    items,
    page,
    pageSize,
    total: items.length
});

const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('UserService.list', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let entities: ReturnType<typeof getUser>[];
    const admin = getActor(RoleEnum.ADMIN);
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN);
    const user = getActor(RoleEnum.USER);

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findAllWithCounts']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
        entities = [getUser(), getUser()];
    });

    it('should return a paginated list of users (admin)', async () => {
        asMock(userModelMock.findAllWithCounts).mockResolvedValue(paginated(entities, 1, 2));
        const result = await service.list(admin, { page: 1, pageSize: 2 });
        expectSuccess(result);
        expect(result.data?.items?.length).toBe(2);
        expect(asMock(userModelMock.findAllWithCounts)).toHaveBeenCalledWith({ page: 1, pageSize: 2 }, { page: 1, pageSize: 2 });
    });

    it('should return a paginated list of users (super admin)', async () => {
        asMock(userModelMock.findAllWithCounts).mockResolvedValue(paginated(entities, 1, 2));
        const result = await service.list(superAdmin, { page: 1, pageSize: 2 });
        expectSuccess(result);
        expect(result.data?.items?.length).toBe(2);
        expect(asMock(userModelMock.findAllWithCounts)).toHaveBeenCalledWith({ page: 1, pageSize: 2 }, { page: 1, pageSize: 2 });
    });

    it('should return FORBIDDEN if actor is not admin or super admin', async () => {
        asMock(userModelMock.findAllWithCounts).mockResolvedValue(paginated(entities, 1, 2));
        const result = await service.list(user, { page: 1, pageSize: 2 });
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(userModelMock.findAllWithCounts).mockRejectedValue(new Error('DB error'));
        const result = await service.list(admin, { page: 1, pageSize: 2 });
        expectInternalError(result);
    });

    it('should handle errors from the _beforeList hook', async () => {
        asMock(userModelMock.findAllWithCounts).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _beforeList: () => void },
            '_beforeList'
        ).mockRejectedValue(new Error('beforeList error'));
        const result = await service.list(admin, {});
        expectInternalError(result);
    });

    it('should handle errors from the _afterList hook', async () => {
        asMock(userModelMock.findAllWithCounts).mockResolvedValue(paginated(entities));
        vi.spyOn(service as unknown as { _afterList: () => void }, '_afterList').mockRejectedValue(
            new Error('afterList error')
        );
        const result = await service.list(admin, {});
        expectInternalError(result);
    });

    it('should use the list normalizer if provided', async () => {
        const normalizer = vi.fn((opts) => ({ ...opts, page: 99 }));
        class ServiceWithNormalizer extends UserService {
            protected override normalizers = {
                ...getNormalizers(service),
                list: normalizer
            };
        }
        const serviceWithNorm = new ServiceWithNormalizer({ logger: loggerMock }, userModelMock);
        asMock(userModelMock.findAllWithCounts).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.list(admin, { page: 1, pageSize: 10 });
        expect(normalizer).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, admin);
        expect(asMock(userModelMock.findAllWithCounts)).toHaveBeenCalledWith({ page: 99, pageSize: 10 }, { page: 99, pageSize: 10 });
    });
});
