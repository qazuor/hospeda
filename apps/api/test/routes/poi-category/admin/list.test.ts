/**
 * Unit tests for the admin POI-category catalog list route (HOS-144 NG-1).
 *
 * Pattern: mock `createAdminListRoute` to capture the route's config
 * (including `requiredPermissions` and the raw `handler`), then invoke the
 * handler directly — mirrors
 * `test/routes/point-of-interest/admin/crud.test.ts`'s `GET / (list)` block.
 *
 * Covers:
 *  - Permission gating: the route declares `POI_CATEGORY_VIEW` as required.
 *  - Happy path: a valid actor gets a paginated envelope built from the
 *    service's `search()` result.
 *  - Pagination param handling: `page`/`pageSize` from the query flow through
 *    to the pagination envelope.
 *  - Unauthorized actor rejected: a service-layer FORBIDDEN (simulating an
 *    actor without `POI_CATEGORY_VIEW`) surfaces as a thrown ServiceError,
 *    never a partial-success payload.
 *
 * @module test/routes/poi-category/admin/list
 * @see HOS-144
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

const { mockSearch } = vi.hoisted(() => ({
    mockSearch: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
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
    PointOfInterestCategoryService: vi.fn(function () {
        return {
            search: mockSearch
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

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Importing the route module registers its config into `capturedConfigs`
// via the mocked factory above.
await import('../../../../src/routes/poi-category/admin/list');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: 'ADMIN',
    permissions: [PermissionEnum.POI_CATEGORY_VIEW]
} as Actor;

const UNAUTHORIZED_ACTOR: Actor = {
    id: 'no-permission-actor-id',
    role: 'USER',
    permissions: []
} as Actor;

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

describe('poi-category admin list route (HOS-144 NG-1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // Permission gating
    // -------------------------------------------------------------------
    it('GET / requires POI_CATEGORY_VIEW', () => {
        expect(getRequiredPermissions('GET /')).toEqual([PermissionEnum.POI_CATEGORY_VIEW]);
    });

    // -------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------
    it('returns a paginated envelope built from the service search() result', async () => {
        const items = [{ id: CATEGORY_ID, slug: 'museum', nameI18n: {}, icon: 'museum-icon' }];
        mockSearch.mockResolvedValue({ data: { items, total: 1 } });

        const handler = getHandler('GET /');
        const result = await handler(buildMockContext(), {}, {}, { page: 1, pageSize: 20 });

        expect(mockSearch).toHaveBeenCalledWith(ADMIN_ACTOR, { page: 1, pageSize: 20 });
        expect(result).toEqual({
            items,
            pagination: expect.objectContaining({ page: 1, pageSize: 20, total: 1 })
        });
    });

    it('forwards a free-text q filter to search() unmodified', async () => {
        mockSearch.mockResolvedValue({ data: { items: [], total: 0 } });

        const handler = getHandler('GET /');
        const query = { page: 1, pageSize: 20, q: 'museo' };
        await handler(buildMockContext(), {}, {}, query);

        expect(mockSearch).toHaveBeenCalledWith(ADMIN_ACTOR, query);
    });

    // -------------------------------------------------------------------
    // Pagination param handling
    // -------------------------------------------------------------------
    it('honors a pageSize up to 100 and reflects it in the pagination envelope', async () => {
        const items = Array.from({ length: 50 }, (_, i) => ({
            id: `id-${i}`,
            slug: `category-${i}`
        }));
        mockSearch.mockResolvedValue({ data: { items, total: 120 } });

        const handler = getHandler('GET /');
        const result = await handler(buildMockContext(), {}, {}, { page: 2, pageSize: 100 });

        expect(mockSearch).toHaveBeenCalledWith(ADMIN_ACTOR, { page: 2, pageSize: 100 });
        expect(result).toMatchObject({
            items,
            pagination: expect.objectContaining({ page: 2, pageSize: 100, total: 120 })
        });
    });

    it('defaults page/pageSize when the query omits them', async () => {
        mockSearch.mockResolvedValue({ data: { items: [], total: 0 } });

        const handler = getHandler('GET /');
        const result = await handler(buildMockContext(), {}, {}, {});

        expect(result).toMatchObject({
            pagination: expect.objectContaining({ page: 1, total: 0 })
        });
    });

    // -------------------------------------------------------------------
    // Unauthorized actor rejected
    // -------------------------------------------------------------------
    it('throws ServiceError (FORBIDDEN) when the service rejects an unauthorized actor', async () => {
        mockGetActorFromContext.mockReturnValue(UNAUTHORIZED_ACTOR);
        mockSearch.mockResolvedValue({
            error: {
                code: ServiceErrorCode.FORBIDDEN,
                message: 'FORBIDDEN: Permission denied to list POI categories'
            }
        });

        const handler = getHandler('GET /');

        await expect(handler(buildMockContext(), {}, {}, {})).rejects.toMatchObject({
            code: ServiceErrorCode.FORBIDDEN
        });
        expect(mockSearch).toHaveBeenCalledWith(UNAUTHORIZED_ACTOR, { page: 1, pageSize: 20 });
    });
});
