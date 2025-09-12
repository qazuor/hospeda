/**
 * @file search.test.ts
 *
 * Tests for UserService.search method.
 * Covers: success (admin, super admin), forbidden, validation error, internal error, lifecycle hook errors, normalizer usage, pagination.
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
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;
const paginated = (items: unknown[], page = 1, pageSize = 10) => ({
    items,
    page,
    pageSize,
    total: items.length
});

const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('UserService.search', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let entities: ReturnType<typeof getUser>[];
    const admin = getActor(RoleEnum.ADMIN);
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN);
    const user = getActor(RoleEnum.USER);

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
        entities = [getUser(), getUser()];
    });

    it('should return a paginated list of users matching filters (admin)', async () => {
        asMock(userModelMock.findAll).mockResolvedValue(paginated(entities, 1, 2));
        const filters = { role: RoleEnum.USER };
        const result = await service.search(admin, { filters });
        expectSuccess(result);
        expect(result.data?.items?.length).toBe(2);
        expect(asMock(userModelMock.findAll)).toHaveBeenCalledWith(filters, {
            page: 1,
            pageSize: 10
        });
    });

    it('should return a paginated list of users matching filters (super admin)', async () => {
        asMock(userModelMock.findAll).mockResolvedValue(paginated(entities, 1, 2));
        const filters = { role: RoleEnum.USER };
        const result = await service.search(superAdmin, { filters });
        expectSuccess(result);
        expect(result.data?.items?.length).toBe(2);
        expect(asMock(userModelMock.findAll)).toHaveBeenCalledWith(filters, {
            page: 1,
            pageSize: 10
        });
    });

    it('should return FORBIDDEN if actor is not admin or super admin', async () => {
        asMock(userModelMock.findAll).mockResolvedValue(paginated(entities, 1, 2));
        const filters = { role: RoleEnum.USER };
        const result = await service.search(user, { filters });
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.search(admin, { filters: { role: 123 } });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(userModelMock.findAll).mockRejectedValue(new Error('DB error'));
        const filters = { role: RoleEnum.USER };
        const result = await service.search(admin, { filters });
        expectInternalError(result);
    });

    it('should handle errors from the _beforeSearch hook', async () => {
        asMock(userModelMock.findAll).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _beforeSearch: () => void },
            '_beforeSearch'
        ).mockRejectedValue(new Error('beforeSearch error'));
        const filters = { role: RoleEnum.USER };
        const result = await service.search(admin, { filters });
        expectInternalError(result);
    });

    it('should handle errors from the _afterSearch hook', async () => {
        asMock(userModelMock.findAll).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _afterSearch: () => void },
            '_afterSearch'
        ).mockRejectedValue(new Error('afterSearch error'));
        const filters = { role: RoleEnum.USER };
        const result = await service.search(admin, { filters });
        expectInternalError(result);
    });

    it('should use the search normalizer if provided', async () => {
        const normalizer = vi.fn((opts) => ({ ...opts }));
        class ServiceWithNormalizer extends UserService {
            protected override normalizers = {
                ...getNormalizers(service),
                search: normalizer
            };
        }
        const serviceWithNorm = new ServiceWithNormalizer({ logger: loggerMock }, userModelMock);
        asMock(userModelMock.findAll).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.search(admin, { filters: {} });
        expect(normalizer).toHaveBeenCalledWith({ filters: {} }, admin);
        expect(asMock(userModelMock.findAll)).toHaveBeenCalledWith({}, { page: 1, pageSize: 10 });
    });
});
