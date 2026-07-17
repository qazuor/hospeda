/**
 * Unit tests for the public POI-category catalog list route (HOS-147).
 *
 * Pattern: mock `createPublicRoute` to capture the route's config (including
 * the raw `handler`), then invoke the handler directly — mirrors
 * `test/routes/poi-category/admin/list.test.ts`.
 *
 * Covers:
 *  - Happy path: the handler returns the bare `categories` array from the
 *    service's `listPublicCategories()` result (no pagination envelope).
 *  - Guest actor: a permission-less actor is passed straight through to the
 *    service (the public read gate lives service-side, not on the route).
 *  - Service error: a service-layer error surfaces as a thrown ServiceError,
 *    never a partial-success payload.
 *
 * @module test/routes/poi-category/public/list
 * @see HOS-147
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedConfigs } = vi.hoisted(() => ({
    capturedConfigs: new Map<
        string,
        {
            handler: (ctx: unknown) => Promise<unknown>;
        }
    >()
}));

const { mockListPublicCategories } = vi.hoisted(() => ({
    mockListPublicCategories: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: vi.fn(
        (config: { method: string; path: string; handler: (ctx: unknown) => Promise<unknown> }) => {
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
            listPublicCategories: mockListPublicCategories
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

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Importing the route module registers its config into `capturedConfigs`.
await import('../../../../src/routes/poi-category/public/list');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const GUEST_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000000',
    role: 'GUEST',
    permissions: ['access.api.public']
} as unknown as Actor;

function buildMockContext(): Context {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() } as unknown as Context;
}

function getHandler(methodAndPath: string): (ctx: unknown) => Promise<unknown> {
    const config = capturedConfigs.get(methodAndPath);
    if (!config) {
        throw new Error(`No route captured for: ${methodAndPath}`);
    }
    return config.handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('poi-category public list route (HOS-147)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(GUEST_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the bare categories array from listPublicCategories (no pagination)', async () => {
        const categories = [
            {
                id: 'id-1',
                slug: 'termas',
                nameI18n: { es: 'Termas' },
                icon: 'hot-spring',
                displayWeight: 80
            },
            {
                id: 'id-2',
                slug: 'museos',
                nameI18n: { es: 'Museos' },
                icon: 'museum',
                displayWeight: 50
            }
        ];
        mockListPublicCategories.mockResolvedValue({ data: { categories } });

        const handler = getHandler('GET /');
        const result = await handler(buildMockContext());

        expect(mockListPublicCategories).toHaveBeenCalledWith(GUEST_ACTOR);
        expect(result).toEqual(categories);
    });

    it('passes a guest actor straight through (public read, gate is service-side)', async () => {
        mockListPublicCategories.mockResolvedValue({ data: { categories: [] } });

        const handler = getHandler('GET /');
        const result = await handler(buildMockContext());

        expect(mockListPublicCategories).toHaveBeenCalledWith(GUEST_ACTOR);
        expect(result).toEqual([]);
    });

    it('returns an empty array when the service result has no categories', async () => {
        mockListPublicCategories.mockResolvedValue({ data: undefined });

        const handler = getHandler('GET /');
        const result = await handler(buildMockContext());

        expect(result).toEqual([]);
    });

    it('throws ServiceError when the service returns an error', async () => {
        mockListPublicCategories.mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
        });

        const handler = getHandler('GET /');

        await expect(handler(buildMockContext())).rejects.toMatchObject({
            code: ServiceErrorCode.INTERNAL_ERROR
        });
    });
});
