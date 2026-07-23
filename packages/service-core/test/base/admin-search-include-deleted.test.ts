/**
 * @fileoverview
 * Tests verifying that `includeDeleted` is threaded from `list()`/`adminList()`
 * through `_executeAdminSearch()` into the options bag passed to
 * `model.findAll`/`model.findAllWithRelations` (HOS-274).
 *
 * Why this matters: `EventModel`/`PostModel` now default `findAll`,
 * `findAllWithRelations`, and `count` to excluding soft-deleted rows unless the
 * caller passes `options.includeDeleted === true` (see
 * `packages/db/src/models/event/event.model.ts` and
 * `packages/db/src/models/post/post.model.ts`). If the base read paths stopped
 * forwarding `includeDeleted` into that options bag, the admin trash/restore
 * view (`adminList({ includeDeleted: true })`) would silently start hiding
 * soft-deleted rows again for those two models, even though `where.deletedAt`
 * is correctly left absent.
 *
 * These tests use a generic mocked `BaseModel` (mirrors
 * `admin-search-ctx.test.ts`'s ctx.tx-forwarding suite) so they exercise the
 * plumbing in `base.crud.read.ts` directly, independent of any concrete
 * entity. Model-level proof that `EventModel`/`PostModel` actually act on the
 * flag lives in `packages/db/test/models/event.model.soft-delete.test.ts` and
 * `packages/db/test/models/post.model.soft-delete.test.ts`.
 *
 * See: packages/service-core/src/base/base.crud.read.ts — list(), adminList(),
 * _executeAdminSearch()
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import { AdminSearchBaseSchema, type ListRelationsConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSearchExecuteParams } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { mockAdminActor } from './base/base.service.mockData';
import { type TestEntity, TestService } from './base/base.service.test.setup';

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

/** Service variant with NO default list relations — exercises the findAll path. */
class NoRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return undefined;
    }
}

/** Service variant WITH default list relations — exercises the findAllWithRelations path. */
class WithRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return { destination: true };
    }
}

/**
 * Service variant with NO default list relations AND a configured
 * `adminSearchSchema` — required to exercise the full `adminList()` entry
 * point (unlike the `_executeAdminSearch()`-only suite above, which bypasses
 * `adminList()`'s "adminSearchSchema is configured" guard).
 */
class NoRelationsServiceWithAdminSchema extends NoRelationsService {
    protected override adminSearchSchema = AdminSearchBaseSchema;
}

const defaultPaginatedResult = { items: [], total: 0 };

function callExecuteAdminSearch(
    service: TestService,
    params: AdminSearchExecuteParams
): Promise<{ items: TestEntity[]; total: number }> {
    return (
        service as unknown as {
            _executeAdminSearch: (
                p: AdminSearchExecuteParams
            ) => Promise<{ items: TestEntity[]; total: number }>;
        }
    )._executeAdminSearch(params);
}

function buildParams(includeDeleted: boolean | undefined): AdminSearchExecuteParams {
    return {
        where: {},
        entityFilters: {},
        pagination: { page: 1, pageSize: 20 },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
        actor: mockAdminActor,
        includeDeleted
    };
}

describe('BaseCrudRead: _executeAdminSearch — includeDeleted forwarding (HOS-274)', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.findAllWithRelations).mockResolvedValue(defaultPaginatedResult);
    });

    it('forwards includeDeleted=true to model.findAll options when no default relations are configured', async () => {
        const service = createServiceTestInstance(NoRelationsService, modelMock);

        await callExecuteAdminSearch(service, buildParams(true));

        expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
        const [, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect((options as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(true);
    });

    it('forwards includeDeleted=false to model.findAll options', async () => {
        const service = createServiceTestInstance(NoRelationsService, modelMock);

        await callExecuteAdminSearch(service, buildParams(false));

        const [, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect((options as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(false);
    });

    it('forwards includeDeleted=true to model.findAllWithRelations options when default relations are configured', async () => {
        const service = createServiceTestInstance(WithRelationsService, modelMock);

        await callExecuteAdminSearch(service, buildParams(true));

        expect(asMock(modelMock.findAllWithRelations)).toHaveBeenCalledTimes(1);
        const [, , options] = asMock(modelMock.findAllWithRelations).mock.calls[0] ?? [];
        expect((options as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(true);
    });

    it('forwards includeDeleted=undefined as-is when the caller does not set it', async () => {
        const service = createServiceTestInstance(NoRelationsService, modelMock);

        await callExecuteAdminSearch(service, buildParams(undefined));

        const [, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect(
            (options as { includeDeleted?: boolean } | undefined)?.includeDeleted
        ).toBeUndefined();
    });
});

describe('BaseCrudRead: adminList() — includeDeleted forwarding (HOS-274)', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.getTable).mockReturnValue({
            id: {},
            name: {},
            value: {},
            deletedAt: {},
            createdAt: {}
        } as never);
    });

    it('adminList({ includeDeleted: true }) reaches model.findAll options as true (trash view)', async () => {
        const service = createServiceTestInstance(NoRelationsServiceWithAdminSchema, modelMock);

        await service.adminList(mockAdminActor, {
            page: 1,
            pageSize: 20,
            sort: 'createdAt:desc',
            status: 'all',
            includeDeleted: true
        });

        const [where, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        // where.deletedAt must be ABSENT (not `null`) — that's exactly the case
        // where EventModel/PostModel's own default would otherwise kick in.
        expect(where as Record<string, unknown>).not.toHaveProperty('deletedAt');
        expect((options as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(true);
    });

    it('adminList({ includeDeleted: false }) sets where.deletedAt=null AND forwards includeDeleted=false', async () => {
        const service = createServiceTestInstance(NoRelationsServiceWithAdminSchema, modelMock);

        await service.adminList(mockAdminActor, {
            page: 1,
            pageSize: 20,
            sort: 'createdAt:desc',
            status: 'all',
            includeDeleted: false
        });

        const [where, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect((where as Record<string, unknown>).deletedAt).toBeNull();
        expect((options as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(false);
    });
});

describe('BaseCrudRead: list() — includeDeleted forwarding (HOS-274)', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.getTable).mockReturnValue({
            id: {},
            name: {},
            value: {},
            deletedAt: {},
            createdAt: {}
        } as never);
    });

    it('list({ includeDeleted: true }) leaves where.deletedAt absent AND forwards includeDeleted=true', async () => {
        const service = createServiceTestInstance(NoRelationsService, modelMock);

        await service.list(mockAdminActor, { includeDeleted: true });

        const [where, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect(where as Record<string, unknown>).not.toHaveProperty('deletedAt');
        expect((options as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(true);
    });

    it('list() with no includeDeleted sets where.deletedAt=null AND forwards includeDeleted=undefined', async () => {
        const service = createServiceTestInstance(NoRelationsService, modelMock);

        await service.list(mockAdminActor, {});

        const [where, options] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect((where as Record<string, unknown>).deletedAt).toBeNull();
        expect(
            (options as { includeDeleted?: boolean } | undefined)?.includeDeleted
        ).toBeUndefined();
    });
});
