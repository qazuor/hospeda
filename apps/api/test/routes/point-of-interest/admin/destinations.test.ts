/**
 * Unit tests for the admin point-of-interest ↔ destination relation routes
 * (HOS-143 T-011).
 *
 * Pattern: mock `createAdminRoute` to capture each route's config (including
 * `requiredPermissions` and the raw `handler`), then invoke the handler
 * directly — avoids booting the full Hono app and middleware chain (mirrors
 * `test/routes/destination/admin/moderate.test.ts` and
 * `test/routes/content-moderation/admin-permissions.test.ts`).
 *
 * Covers:
 *  - AC-7: each route declares the correct `POINT_OF_INTEREST_*` permission.
 *  - AC-3: POST duplicate destination pair → ALREADY_EXISTS passthrough.
 *  - AC-4: PATCH a non-existent relation row → NOT_FOUND passthrough (never
 *    creates the row).
 *  - GET happy path: relation kind resolved per destination via the reverse
 *    lookup (`getPointsOfInterestForDestination` with `relation: 'ALL'`).
 *  - DELETE happy path.
 *
 * @module test/routes/point-of-interest/admin/destinations
 * @see HOS-143 T-011
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

const {
    mockGetDestinationsByPointOfInterest,
    mockGetPointsOfInterestForDestination,
    mockAddPointOfInterestToDestination,
    mockUpdatePointOfInterestDestinationRelation,
    mockRemovePointOfInterestFromDestination
} = vi.hoisted(() => ({
    mockGetDestinationsByPointOfInterest: vi.fn(),
    mockGetPointsOfInterestForDestination: vi.fn(),
    mockAddPointOfInterestToDestination: vi.fn(),
    mockUpdatePointOfInterestDestinationRelation: vi.fn(),
    mockRemovePointOfInterestFromDestination: vi.fn()
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
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    PointOfInterestService: vi.fn(function () {
        return {
            getDestinationsByPointOfInterest: mockGetDestinationsByPointOfInterest,
            getPointsOfInterestForDestination: mockGetPointsOfInterestForDestination,
            addPointOfInterestToDestination: mockAddPointOfInterestToDestination,
            updatePointOfInterestDestinationRelation: mockUpdatePointOfInterestDestinationRelation,
            removePointOfInterestFromDestination: mockRemovePointOfInterestFromDestination
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

import {
    PermissionEnum,
    PointOfInterestDestinationRelationEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

await import('../../../../src/routes/point-of-interest/admin/destinations');

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
        PermissionEnum.POINT_OF_INTEREST_DELETE
    ]
} as Actor;

const POI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DESTINATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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

describe('point-of-interest admin destination routes (HOS-143 T-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // AC-7: per-route permission declarations
    // -------------------------------------------------------------------
    describe('AC-7: permission gating', () => {
        it('GET /{id}/destinations requires POINT_OF_INTEREST_VIEW', () => {
            expect(getRequiredPermissions('GET /{id}/destinations')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_VIEW
            ]);
        });

        it('POST /{id}/destinations requires POINT_OF_INTEREST_CREATE', () => {
            expect(getRequiredPermissions('POST /{id}/destinations')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_CREATE
            ]);
        });

        it('PATCH /{id}/destinations/{destinationId} requires POINT_OF_INTEREST_UPDATE', () => {
            expect(getRequiredPermissions('PATCH /{id}/destinations/{destinationId}')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_UPDATE
            ]);
        });

        it('DELETE /{id}/destinations/{destinationId} requires POINT_OF_INTEREST_DELETE', () => {
            expect(getRequiredPermissions('DELETE /{id}/destinations/{destinationId}')).toEqual([
                PermissionEnum.POINT_OF_INTEREST_DELETE
            ]);
        });
    });

    // -------------------------------------------------------------------
    // GET /{id}/destinations
    // -------------------------------------------------------------------
    describe('GET /{id}/destinations', () => {
        it('resolves the relation kind per destination via the reverse lookup', async () => {
            mockGetDestinationsByPointOfInterest.mockResolvedValue({
                data: {
                    destinations: [{ id: DESTINATION_ID, name: 'Colón', slug: 'colon' }]
                }
            });
            mockGetPointsOfInterestForDestination.mockResolvedValue({
                data: {
                    pointsOfInterest: [
                        { id: POI_ID, relation: PointOfInterestDestinationRelationEnum.NEARBY }
                    ]
                }
            });

            const handler = getHandler('GET /{id}/destinations');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(result).toEqual([
                {
                    destinationId: DESTINATION_ID,
                    destinationName: 'Colón',
                    destinationSlug: 'colon',
                    relation: PointOfInterestDestinationRelationEnum.NEARBY
                }
            ]);
        });

        it('returns an empty array when the POI has no destinations', async () => {
            mockGetDestinationsByPointOfInterest.mockResolvedValue({
                data: { destinations: [] }
            });

            const handler = getHandler('GET /{id}/destinations');
            const result = await handler(buildMockContext(), { id: POI_ID }, {});

            expect(result).toEqual([]);
            expect(mockGetPointsOfInterestForDestination).not.toHaveBeenCalled();
        });

        it('throws ServiceError when the POI does not exist (NOT_FOUND)', async () => {
            mockGetDestinationsByPointOfInterest.mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Point of interest not found' }
            });

            const handler = getHandler('GET /{id}/destinations');

            await expect(handler(buildMockContext(), { id: POI_ID }, {})).rejects.toThrow(
                /not found/i
            );
        });
    });

    // -------------------------------------------------------------------
    // POST /{id}/destinations — AC-3
    // -------------------------------------------------------------------
    describe('POST /{id}/destinations — AC-3', () => {
        it('passes the destinationId/relation from body plus pointOfInterestId from path', async () => {
            mockAddPointOfInterestToDestination.mockResolvedValue({
                data: {
                    relation: {
                        destinationId: DESTINATION_ID,
                        pointOfInterestId: POI_ID,
                        relation: PointOfInterestDestinationRelationEnum.PRIMARY
                    }
                }
            });

            const handler = getHandler('POST /{id}/destinations');
            const result = await handler(
                buildMockContext(),
                { id: POI_ID },
                {
                    destinationId: DESTINATION_ID,
                    relation: PointOfInterestDestinationRelationEnum.PRIMARY
                }
            );

            expect(mockAddPointOfInterestToDestination).toHaveBeenCalledWith(ADMIN_ACTOR, {
                pointOfInterestId: POI_ID,
                destinationId: DESTINATION_ID,
                relation: PointOfInterestDestinationRelationEnum.PRIMARY
            });
            expect(result).toEqual({
                relation: {
                    destinationId: DESTINATION_ID,
                    pointOfInterestId: POI_ID,
                    relation: PointOfInterestDestinationRelationEnum.PRIMARY
                }
            });
        });

        it('throws ServiceError with ALREADY_EXISTS when the pair is already linked', async () => {
            mockAddPointOfInterestToDestination.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message: 'Point of interest already added to destination'
                }
            });

            const handler = getHandler('POST /{id}/destinations');

            await expect(
                handler(buildMockContext(), { id: POI_ID }, { destinationId: DESTINATION_ID })
            ).rejects.toMatchObject({ code: ServiceErrorCode.ALREADY_EXISTS });
        });
    });

    // -------------------------------------------------------------------
    // PATCH /{id}/destinations/{destinationId} — AC-4
    // -------------------------------------------------------------------
    describe('PATCH /{id}/destinations/{destinationId} — AC-4', () => {
        it('updates an existing relation', async () => {
            mockUpdatePointOfInterestDestinationRelation.mockResolvedValue({
                data: {
                    relation: {
                        destinationId: DESTINATION_ID,
                        pointOfInterestId: POI_ID,
                        relation: PointOfInterestDestinationRelationEnum.NEARBY
                    }
                }
            });

            const handler = getHandler('PATCH /{id}/destinations/{destinationId}');
            const result = await handler(
                buildMockContext(),
                { id: POI_ID, destinationId: DESTINATION_ID },
                { relation: PointOfInterestDestinationRelationEnum.NEARBY }
            );

            expect(mockUpdatePointOfInterestDestinationRelation).toHaveBeenCalledWith(ADMIN_ACTOR, {
                pointOfInterestId: POI_ID,
                destinationId: DESTINATION_ID,
                relation: PointOfInterestDestinationRelationEnum.NEARBY
            });
            expect(result).toEqual({
                relation: {
                    destinationId: DESTINATION_ID,
                    pointOfInterestId: POI_ID,
                    relation: PointOfInterestDestinationRelationEnum.NEARBY
                }
            });
        });

        it('throws ServiceError with NOT_FOUND when the relation does not exist (never creates it)', async () => {
            mockUpdatePointOfInterestDestinationRelation.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Point of interest relation not found for this destination'
                }
            });

            const handler = getHandler('PATCH /{id}/destinations/{destinationId}');

            await expect(
                handler(
                    buildMockContext(),
                    { id: POI_ID, destinationId: DESTINATION_ID },
                    { relation: PointOfInterestDestinationRelationEnum.NEARBY }
                )
            ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });

            expect(mockAddPointOfInterestToDestination).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------
    // DELETE /{id}/destinations/{destinationId}
    // -------------------------------------------------------------------
    describe('DELETE /{id}/destinations/{destinationId}', () => {
        it('returns { deleted: true } on success', async () => {
            mockRemovePointOfInterestFromDestination.mockResolvedValue({
                data: {
                    relation: { destinationId: DESTINATION_ID, pointOfInterestId: POI_ID }
                }
            });

            const handler = getHandler('DELETE /{id}/destinations/{destinationId}');
            const result = await handler(
                buildMockContext(),
                { id: POI_ID, destinationId: DESTINATION_ID },
                {}
            );

            expect(result).toEqual({ deleted: true });
        });

        it('throws ServiceError with NOT_FOUND when the relation does not exist', async () => {
            mockRemovePointOfInterestFromDestination.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Point of interest relation not found for this destination'
                }
            });

            const handler = getHandler('DELETE /{id}/destinations/{destinationId}');

            await expect(
                handler(buildMockContext(), { id: POI_ID, destinationId: DESTINATION_ID }, {})
            ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        });
    });
});
