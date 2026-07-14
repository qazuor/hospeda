/**
 * Unit tests for the admin point-of-interest ↔ POI-category assignment
 * routes (HOS-143 T-012).
 *
 * Pattern: mock `createAdminRoute` to capture each route's config (including
 * `requiredPermissions` and the raw `handler`), then invoke the handler
 * directly — mirrors `test/routes/destination/admin/moderate.test.ts` and
 * `test/routes/point-of-interest/admin/destinations.test.ts`.
 *
 * Covers:
 *  - AC-7 (permission decision): PUT declares `POI_CATEGORY_UPDATE` (the
 *    documented deviation from the spec's nominal `POINT_OF_INTEREST_UPDATE`
 *    — see the deviation comment on the route itself).
 *  - AC-5: `primaryCategoryId` not in `categoryIds` is rejected by the body
 *    schema's `.refine()` — tested directly against the exported schema,
 *    since the route-factory mock bypasses the real zValidator pipeline.
 *  - AC-6 (route-level slice): a service-reported NOT_FOUND (bad category
 *    id) surfaces as a thrown ServiceError, never a partial success payload.
 *
 * @module test/routes/point-of-interest/admin/categories
 * @see HOS-143 T-012
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
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }
    >()
}));

const { mockGetCategoriesForPointOfInterest, mockSetCategoriesForPointOfInterest } = vi.hoisted(
    () => ({
        mockGetCategoriesForPointOfInterest: vi.fn(),
        mockSetCategoriesForPointOfInterest: vi.fn()
    })
);

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
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    PointOfInterestCategoryService: vi.fn(function () {
        return {
            getCategoriesForPointOfInterest: mockGetCategoriesForPointOfInterest,
            setCategoriesForPointOfInterest: mockSetCategoriesForPointOfInterest
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

const { AdminSetPointOfInterestCategoriesBodySchema } = await import(
    '../../../../src/routes/point-of-interest/admin/categories'
);

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: 'ADMIN',
    permissions: [PermissionEnum.POINT_OF_INTEREST_VIEW, PermissionEnum.POI_CATEGORY_UPDATE]
} as Actor;

const POI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATEGORY_ID_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CATEGORY_ID_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function buildMockContext(): Context {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() } as unknown as Context;
}

function getHandler(
    methodAndPath: string
): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
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

describe('point-of-interest admin category routes (HOS-143 T-012)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // AC-7: permission declarations
    // -------------------------------------------------------------------
    describe('AC-7: permission gating', () => {
        it('GET /{id}/categories requires POINT_OF_INTEREST_VIEW', () => {
            expect(getRequiredPermissions('GET /{id}/categories')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_VIEW
            ]);
        });

        it('PUT /{id}/categories requires POI_CATEGORY_UPDATE (documented deviation)', () => {
            // Deviation from spec §7.5's nominal POINT_OF_INTEREST_UPDATE: the
            // service hook (_canSetCategoriesForPointOfInterest) enforces
            // POI_CATEGORY_UPDATE, and createAdminRoute's requiredPermissions
            // gate runs BEFORE the handler/service — so both layers must
            // agree on the same permission. See the deviation comment on
            // adminSetPointOfInterestCategoriesRoute for the full rationale.
            expect(getRequiredPermissions('PUT /{id}/categories')).toEqual([
                PermissionEnum.POI_CATEGORY_UPDATE
            ]);
        });
    });

    // -------------------------------------------------------------------
    // GET /{id}/categories
    // -------------------------------------------------------------------
    describe('GET /{id}/categories', () => {
        it('returns the categories assigned to the point of interest', async () => {
            const categories = [{ id: CATEGORY_ID_1, slug: 'restaurant', displayWeight: 80 }];
            mockGetCategoriesForPointOfInterest.mockResolvedValue({ data: { categories } });

            const handler = getHandler('GET /{id}/categories');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(result).toEqual(categories);
            expect(mockGetCategoriesForPointOfInterest).toHaveBeenCalledWith(
                ADMIN_ACTOR,
                expect.objectContaining({ pointOfInterestId: POI_ID })
            );
        });

        it('returns an empty array when the POI has no categories assigned', async () => {
            mockGetCategoriesForPointOfInterest.mockResolvedValue({ data: { categories: [] } });

            const handler = getHandler('GET /{id}/categories');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(result).toEqual([]);
        });

        it('throws ServiceError when the POI does not exist (NOT_FOUND)', async () => {
            mockGetCategoriesForPointOfInterest.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('GET /{id}/categories');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toThrow(
                /not found/i
            );
        });
    });

    // -------------------------------------------------------------------
    // AC-5: body schema refinement (primaryCategoryId must be in categoryIds)
    // -------------------------------------------------------------------
    describe('AC-5: AdminSetPointOfInterestCategoriesBodySchema validation', () => {
        it('rejects when primaryCategoryId is NOT one of categoryIds', () => {
            const result = AdminSetPointOfInterestCategoriesBodySchema.safeParse({
                categoryIds: [CATEGORY_ID_1],
                primaryCategoryId: CATEGORY_ID_2
            });

            expect(result.success).toBe(false);
        });

        it('accepts when primaryCategoryId IS one of categoryIds', () => {
            const result = AdminSetPointOfInterestCategoriesBodySchema.safeParse({
                categoryIds: [CATEGORY_ID_1, CATEGORY_ID_2],
                primaryCategoryId: CATEGORY_ID_2
            });

            expect(result.success).toBe(true);
        });

        it('rejects an empty categoryIds array', () => {
            const result = AdminSetPointOfInterestCategoriesBodySchema.safeParse({
                categoryIds: [],
                primaryCategoryId: CATEGORY_ID_1
            });

            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------
    // PUT /{id}/categories
    // -------------------------------------------------------------------
    describe('PUT /{id}/categories', () => {
        it('replaces the category set and returns the full assignment list', async () => {
            const categories = [
                { id: CATEGORY_ID_2, slug: 'museum', nameI18n: {}, icon: null, isPrimary: true },
                {
                    id: CATEGORY_ID_1,
                    slug: 'restaurant',
                    nameI18n: {},
                    icon: null,
                    isPrimary: false
                }
            ];
            mockSetCategoriesForPointOfInterest.mockResolvedValue({ data: { categories } });

            const handler = getHandler('PUT /{id}/categories');
            const result = await handler(
                buildMockContext(),
                { id: POI_ID },
                { categoryIds: [CATEGORY_ID_1, CATEGORY_ID_2], primaryCategoryId: CATEGORY_ID_2 }
            );

            expect(mockSetCategoriesForPointOfInterest).toHaveBeenCalledWith(ADMIN_ACTOR, {
                pointOfInterestId: POI_ID,
                categoryIds: [CATEGORY_ID_1, CATEGORY_ID_2],
                primaryCategoryId: CATEGORY_ID_2
            });
            expect(result).toEqual({ categories });
        });

        // AC-6 (route-level slice): the transactional rollback itself lives in
        // setCategoriesForPointOfInterest (service-core, already tested there).
        // At the route layer, a bad-id NOT_FOUND from the service must surface
        // as a thrown error — never a partial-success payload.
        it('AC-6: throws ServiceError (no partial success) when a categoryId does not exist', async () => {
            mockSetCategoriesForPointOfInterest.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `POI category not found: ${CATEGORY_ID_2}`
                }
            });

            const handler = getHandler('PUT /{id}/categories');

            await expect(
                handler(
                    buildMockContext(),
                    { id: POI_ID },
                    {
                        categoryIds: [CATEGORY_ID_1, CATEGORY_ID_2],
                        primaryCategoryId: CATEGORY_ID_1
                    }
                )
            ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });

            expect(mockSetCategoriesForPointOfInterest).toHaveBeenCalledTimes(1);
        });
    });
});
