/**
 * Unit tests for the standard CRUD admin point-of-interest routes (HOS-143 T-010).
 *
 * Pattern: mock `createAdminRoute`/`createAdminListRoute` to capture each
 * route's config (including `requiredPermissions` and the raw `handler`),
 * then invoke the handler directly — mirrors
 * `test/routes/point-of-interest/admin/destinations.test.ts` and
 * `test/routes/point-of-interest/admin/categories.test.ts`.
 *
 * Covers:
 *  - AC-1 (permission table, §6.1): each of the 9 standard CRUD routes
 *    (list/getById/create/update/patch/delete/hardDelete/restore/batch)
 *    declares the documented `POINT_OF_INTEREST_*` permission.
 *  - Happy-path handler invocation for each route, asserting the service is
 *    called with the expected arguments and the handler returns the expected
 *    shape.
 *  - ServiceError propagation (no partial success) for the routes that
 *    surface a service-layer error.
 *  - AC-2: the list route accepts `destinationId` + `categoryId` together
 *    (AND semantics) — asserted at the schema level via `.safeParse()` and at
 *    the handler level by asserting both filters are forwarded unmodified to
 *    `adminList`. The actual AND-filtering logic is unit-tested in
 *    service-core; this only proves the API layer doesn't drop/override
 *    either filter.
 *
 * @module test/routes/point-of-interest/admin/crud
 * @see HOS-143 T-010
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedConfigs } = vi.hoisted(() => ({
    capturedConfigs: new Map<
        string,
        {
            requiredPermissions?: string[];
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }
    >()
}));

const {
    mockAdminList,
    mockGetById,
    mockCreate,
    mockUpdate,
    mockSoftDelete,
    mockHardDelete,
    mockRestore
} = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockGetById: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockHardDelete: vi.fn(),
    mockRestore: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            method: string;
            path: string;
            requiredPermissions?: string[];
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedConfigs.set(`${config.method.toUpperCase()} ${config.path}`, config);
            return config.handler;
        }
    ),
    createAdminListRoute: vi.fn(
        (config: {
            method: string;
            path: string;
            requiredPermissions?: string[];
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            capturedConfigs.set(`${config.method.toUpperCase()} ${config.path}`, config);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    PointOfInterestService: vi.fn(function () {
        return {
            adminList: mockAdminList,
            getById: mockGetById,
            create: mockCreate,
            update: mockUpdate,
            softDelete: mockSoftDelete,
            hardDelete: mockHardDelete,
            restore: mockRestore
        };
    }),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, PointOfInterestAdminSearchSchema, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Importing each route module registers its config into `capturedConfigs`
// via the mocked factory above.
await import('../../../../src/routes/point-of-interest/admin/list');
await import('../../../../src/routes/point-of-interest/admin/getById');
await import('../../../../src/routes/point-of-interest/admin/create');
await import('../../../../src/routes/point-of-interest/admin/update');
await import('../../../../src/routes/point-of-interest/admin/patch');
await import('../../../../src/routes/point-of-interest/admin/delete');
await import('../../../../src/routes/point-of-interest/admin/hardDelete');
await import('../../../../src/routes/point-of-interest/admin/restore');
await import('../../../../src/routes/point-of-interest/admin/batch');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: 'ADMIN',
    permissions: [
        PermissionEnum.POINT_OF_INTEREST_VIEW,
        PermissionEnum.POINT_OF_INTEREST_CREATE,
        PermissionEnum.POINT_OF_INTEREST_UPDATE,
        PermissionEnum.POINT_OF_INTEREST_DELETE,
        PermissionEnum.POINT_OF_INTEREST_HARD_DELETE,
        PermissionEnum.POINT_OF_INTEREST_RESTORE
    ]
} as Actor;

const POI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const POI_ID_2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DESTINATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function buildMockContext(): Context {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() } as unknown as Context;
}

function getHandler(
    methodAndPath: string
): (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown> {
    const config = capturedConfigs.get(methodAndPath);
    if (!config) {
        throw new Error(`No route captured for: ${methodAndPath}`);
    }
    return config.handler;
}

function getRequiredPermissions(methodAndPath: string): string[] | undefined {
    return capturedConfigs.get(methodAndPath)?.requiredPermissions;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('point-of-interest admin CRUD routes (HOS-143 T-010)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // AC-1: permission table (§6.1)
    // -------------------------------------------------------------------
    describe('AC-1: permission gating', () => {
        it('GET / (list) requires POINT_OF_INTEREST_VIEW', () => {
            expect(getRequiredPermissions('GET /')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_VIEW
            ]);
        });

        it('GET /{id} (getById) requires POINT_OF_INTEREST_VIEW', () => {
            expect(getRequiredPermissions('GET /{id}')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_VIEW
            ]);
        });

        it('POST / (create) requires POINT_OF_INTEREST_CREATE', () => {
            expect(getRequiredPermissions('POST /')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_CREATE
            ]);
        });

        it('PUT /{id} (update) requires POINT_OF_INTEREST_UPDATE', () => {
            expect(getRequiredPermissions('PUT /{id}')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_UPDATE
            ]);
        });

        it('PATCH /{id} (patch) requires POINT_OF_INTEREST_UPDATE', () => {
            expect(getRequiredPermissions('PATCH /{id}')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_UPDATE
            ]);
        });

        it('DELETE /{id} (delete) requires POINT_OF_INTEREST_DELETE', () => {
            expect(getRequiredPermissions('DELETE /{id}')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_DELETE
            ]);
        });

        it('DELETE /{id}/hard (hardDelete) requires POINT_OF_INTEREST_HARD_DELETE', () => {
            expect(getRequiredPermissions('DELETE /{id}/hard')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_HARD_DELETE
            ]);
        });

        it('POST /{id}/restore (restore) requires POINT_OF_INTEREST_RESTORE', () => {
            expect(getRequiredPermissions('POST /{id}/restore')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_RESTORE
            ]);
        });

        it('POST /batch (batch) requires POINT_OF_INTEREST_VIEW', () => {
            expect(getRequiredPermissions('POST /batch')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_VIEW
            ]);
        });
    });

    // -------------------------------------------------------------------
    // GET / — list
    // -------------------------------------------------------------------
    describe('GET / (list)', () => {
        it('returns a paginated envelope built from the service result', async () => {
            const items = [{ id: POI_ID, slug: 'plaza-central' }];
            mockAdminList.mockResolvedValue({ data: { items, total: 1 } });

            const handler = getHandler('GET /');
            const result = await handler(buildMockContext(), {}, {}, { page: 1, pageSize: 20 });

            expect(mockAdminList).toHaveBeenCalledWith(ADMIN_ACTOR, { page: 1, pageSize: 20 });
            expect(result).toEqual({
                items,
                pagination: expect.objectContaining({ page: 1, pageSize: 20, total: 1 })
            });
        });

        it('throws ServiceError when the service reports an error', async () => {
            mockAdminList.mockResolvedValue({
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
            });

            const handler = getHandler('GET /');

            await expect(handler(buildMockContext(), {}, {}, {})).rejects.toMatchObject({
                code: ServiceErrorCode.INTERNAL_ERROR
            });
        });

        // -----------------------------------------------------------------
        // AC-2: destinationId + categoryId combine with AND semantics
        // -----------------------------------------------------------------
        describe('AC-2: destinationId + categoryId combined filters', () => {
            it('schema accepts both filters simultaneously', () => {
                const result = PointOfInterestAdminSearchSchema.safeParse({
                    destinationId: DESTINATION_ID,
                    categoryId: CATEGORY_ID
                });

                expect(result.success).toBe(true);
            });

            it('forwards both filters to adminList unmodified (neither is dropped)', async () => {
                mockAdminList.mockResolvedValue({ data: { items: [], total: 0 } });

                const handler = getHandler('GET /');
                const query = {
                    page: 1,
                    pageSize: 20,
                    destinationId: DESTINATION_ID,
                    categoryId: CATEGORY_ID
                };
                await handler(buildMockContext(), {}, {}, query);

                expect(mockAdminList).toHaveBeenCalledWith(ADMIN_ACTOR, query);
            });
        });
    });

    // -------------------------------------------------------------------
    // GET /{id} — getById
    // -------------------------------------------------------------------
    describe('GET /{id} (getById)', () => {
        it('returns the point of interest', async () => {
            const poi = { id: POI_ID, slug: 'plaza-central' };
            mockGetById.mockResolvedValue({ data: poi });

            const handler = getHandler('GET /{id}');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(mockGetById).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID);
            expect(result).toEqual(poi);
        });

        it('throws ServiceError with NOT_FOUND when the POI does not exist', async () => {
            mockGetById.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('GET /{id}');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toMatchObject({
                code: ServiceErrorCode.NOT_FOUND
            });
        });
    });

    // -------------------------------------------------------------------
    // POST / — create
    // -------------------------------------------------------------------
    describe('POST / (create)', () => {
        const createBody = {
            slug: 'nueva-plaza',
            type: 'PLAZA',
            lat: -32.48,
            long: -58.23
        };

        it('creates the point of interest and returns it', async () => {
            const created = { id: POI_ID, ...createBody };
            mockCreate.mockResolvedValue({ data: created });

            const handler = getHandler('POST /');
            const result = await handler(buildMockContext(), {}, createBody);

            expect(mockCreate).toHaveBeenCalledWith(ADMIN_ACTOR, createBody);
            expect(result).toEqual(created);
        });

        it('throws ServiceError when creation fails validation', async () => {
            mockCreate.mockResolvedValue({
                error: { code: ServiceErrorCode.VALIDATION_ERROR, message: 'Invalid slug' }
            });

            const handler = getHandler('POST /');

            await expect(handler(buildMockContext(), {}, createBody)).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR
            });
        });
    });

    // -------------------------------------------------------------------
    // PUT /{id} — update
    // -------------------------------------------------------------------
    describe('PUT /{id} (update)', () => {
        const updateBody = { slug: 'plaza-renovada' };

        it('updates the point of interest and returns it', async () => {
            const updated = { id: POI_ID, ...updateBody };
            mockUpdate.mockResolvedValue({ data: updated });

            const handler = getHandler('PUT /{id}');
            const result = await handler(buildMockContext(), { id: POI_ID }, updateBody);

            expect(mockUpdate).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID, updateBody);
            expect(result).toEqual(updated);
        });

        it('throws ServiceError with NOT_FOUND when the POI does not exist', async () => {
            mockUpdate.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('PUT /{id}');

            await expect(
                handler(buildMockContext(), { id: POI_ID }, updateBody)
            ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        });
    });

    // -------------------------------------------------------------------
    // PATCH /{id} — patch
    // -------------------------------------------------------------------
    describe('PATCH /{id} (patch)', () => {
        it('transforms the body and delegates to update()', async () => {
            const patchBody = { isFeatured: true };
            const patched = { id: POI_ID, isFeatured: true };
            mockUpdate.mockResolvedValue({ data: patched });

            const handler = getHandler('PATCH /{id}');
            const result = await handler(buildMockContext(), { id: POI_ID }, patchBody);

            expect(mockUpdate).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID, patchBody);
            expect(result).toEqual(patched);
        });

        it('throws ServiceError when update fails', async () => {
            mockUpdate.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('PATCH /{id}');

            await expect(
                handler(buildMockContext(), { id: POI_ID }, { isFeatured: true })
            ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        });
    });

    // -------------------------------------------------------------------
    // DELETE /{id} — soft delete
    // -------------------------------------------------------------------
    describe('DELETE /{id} (delete)', () => {
        it('soft-deletes the point of interest and returns { deleted: true, id }', async () => {
            mockSoftDelete.mockResolvedValue({ data: { count: 1 } });

            const handler = getHandler('DELETE /{id}');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(mockSoftDelete).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID);
            expect(result).toEqual({ deleted: true, id: POI_ID });
        });

        it('returns { deleted: false, id } when the service reports zero affected rows', async () => {
            mockSoftDelete.mockResolvedValue({ data: { count: 0 } });

            const handler = getHandler('DELETE /{id}');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(result).toEqual({ deleted: false, id: POI_ID });
        });

        it('throws ServiceError with NOT_FOUND when the POI does not exist', async () => {
            mockSoftDelete.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('DELETE /{id}');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toMatchObject({
                code: ServiceErrorCode.NOT_FOUND
            });
        });
    });

    // -------------------------------------------------------------------
    // DELETE /{id}/hard — hard delete
    // -------------------------------------------------------------------
    describe('DELETE /{id}/hard (hardDelete)', () => {
        it('permanently deletes the point of interest', async () => {
            mockHardDelete.mockResolvedValue({ data: { count: 1 } });

            const handler = getHandler('DELETE /{id}/hard');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(mockHardDelete).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID);
            expect(result).toEqual({
                success: true,
                message: 'Point of interest permanently deleted'
            });
        });

        it('throws ServiceError with NOT_FOUND when the POI does not exist', async () => {
            mockHardDelete.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('DELETE /{id}/hard');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toMatchObject({
                code: ServiceErrorCode.NOT_FOUND
            });
        });
    });

    // -------------------------------------------------------------------
    // POST /{id}/restore — restore
    // -------------------------------------------------------------------
    describe('POST /{id}/restore (restore)', () => {
        it('restores the point of interest and returns the refetched entity', async () => {
            const restored = { id: POI_ID, slug: 'plaza-central', deletedAt: null };
            mockRestore.mockResolvedValue({ data: { count: 1 } });
            mockGetById.mockResolvedValue({ data: restored });

            const handler = getHandler('POST /{id}/restore');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(mockRestore).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID);
            expect(mockGetById).toHaveBeenCalledWith(ADMIN_ACTOR, POI_ID);
            expect(result).toEqual(restored);
        });

        it('throws ServiceError when the restore step fails (never calls getById)', async () => {
            mockRestore.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('POST /{id}/restore');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toMatchObject({
                code: ServiceErrorCode.NOT_FOUND
            });
            expect(mockGetById).not.toHaveBeenCalled();
        });

        it('throws ServiceError when the post-restore refetch fails', async () => {
            mockRestore.mockResolvedValue({ data: { count: 1 } });
            mockGetById.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('POST /{id}/restore');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toMatchObject({
                code: ServiceErrorCode.NOT_FOUND
            });
        });
    });

    // -------------------------------------------------------------------
    // POST /batch — batch
    // -------------------------------------------------------------------
    describe('POST /batch (batch)', () => {
        it('returns each requested point of interest in order', async () => {
            const poi1 = { id: POI_ID, slug: 'plaza-central' };
            const poi2 = { id: POI_ID_2, slug: 'museo-historico' };
            mockGetById.mockImplementation(async (_actor: unknown, id: string) => {
                if (id === POI_ID) return { data: poi1 };
                if (id === POI_ID_2) return { data: poi2 };
                return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' } };
            });

            const handler = getHandler('POST /batch');
            const result = await handler(buildMockContext(), {}, { ids: [POI_ID, POI_ID_2] });

            expect(result).toEqual([poi1, poi2]);
        });

        it('returns null for ids that are not found (no partial-success throw)', async () => {
            const poi1 = { id: POI_ID, slug: 'plaza-central' };
            mockGetById.mockImplementation(async (_actor: unknown, id: string) => {
                if (id === POI_ID) return { data: poi1 };
                return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' } };
            });

            const handler = getHandler('POST /batch');
            const result = await handler(buildMockContext(), {}, { ids: [POI_ID, POI_ID_2] });

            expect(result).toEqual([poi1, null]);
        });

        it('filters returned fields to the requested subset, always including id and slug', async () => {
            const poi1 = { id: POI_ID, slug: 'plaza-central', isFeatured: true, type: 'PLAZA' };
            mockGetById.mockResolvedValue({ data: poi1 });

            const handler = getHandler('POST /batch');
            const result = await handler(
                buildMockContext(),
                {},
                {
                    ids: [POI_ID],
                    fields: ['isFeatured']
                }
            );

            expect(result).toEqual([{ id: POI_ID, slug: 'plaza-central', isFeatured: true }]);
        });
    });
});
