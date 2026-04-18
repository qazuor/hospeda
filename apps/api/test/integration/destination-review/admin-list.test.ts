/**
 * Integration tests for admin destination-review list endpoint — lifecycleState filter.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service receives after the route parses the query string.
 * This verifies the full pipeline: HTTP query param → schema parse → service call.
 *
 * Covers AC-001-04: admin list filter `status=DRAFT|ACTIVE|ARCHIVED` is accepted
 * by the admin-search schema and reaches the service, which internally maps
 * `status → lifecycleState` via AdminSearchBaseSchema conventions (post T-034 which
 * removed the prior z.unknown().transform workaround).
 *
 * Tested endpoint:
 *   GET /api/v1/admin/destinations/reviews
 *
 * Note: the endpoint lives at `/admin/destinations/reviews` (nested under the
 * destinations admin router — see `apps/api/src/routes/destination/admin/index.ts:34`).
 * JSDoc comments in several admin route files say `/admin/destination-reviews/*` —
 * those are stale. The route-registration file is the ground truth.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable reference that holds the captured mock for adminList.
 * Using a plain object avoids the temporal-dead-zone issue caused by `vi.mock()`
 * hoisting: the factory runs before the outer `const` declarations are
 * initialized, so we cannot reference a `const adminListMock` from inside
 * the factory. Instead, we store the mock on `mockRef` and read it in tests.
 */
const mockRef: { adminList: ReturnType<typeof vi.fn> } = {
    adminList: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        DestinationReviewService: vi.fn().mockImplementation(() => ({
            adminList: (...args: unknown[]) => mockRef.adminList(...args)
        })),
        ServiceError: class ServiceError extends Error {
            constructor(
                public readonly code: string,
                message: string
            ) {
                super(message);
            }
        }
    };
});

import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Admin DestinationReview List — lifecycleState filter (AC-001-04)', () => {
    let app: ReturnType<typeof initApp>;

    // Trailing slash required: the admin destination router mounts reviews at
    // `/reviews` with inner `path: '/'`, so Hono resolves the full path as
    // `/reviews/`. Without the trailing slash, the request can collapse into
    // the sibling `/` list route (adminListDestinationsRoute) which demands
    // `DESTINATION_VIEW_ALL` and rejects the actor.
    const base = '/api/v1/admin/destinations/reviews/';

    // The admin destinations router mounts reviews as a sub-router alongside
    // sibling routes registered at `/` (list, create, batch, getById, update,
    // patch, delete, hardDelete, restore, children, descendants, ancestors).
    // Hono evaluates all matching route middlewares for the resolved path and
    // applies their `requiredPermissions` as a pipeline gate. To keep this
    // test focused on AC-001-04 (lifecycleState filter behavior) rather than
    // on router-collision resolution, grant the actor the full admin
    // destination permission set — which mirrors the real admin role shape.
    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MANAGE_CONTENT,
            // Destination review permission set
            PermissionEnum.DESTINATION_REVIEW_VIEW,
            PermissionEnum.DESTINATION_REVIEW_MODERATE,
            PermissionEnum.DESTINATION_REVIEW_DELETE,
            PermissionEnum.DESTINATION_REVIEW_RESTORE,
            PermissionEnum.DESTINATION_REVIEW_HARD_DELETE,
            // Parent destination permissions (sibling routes under /admin/destinations)
            PermissionEnum.DESTINATION_VIEW_ALL,
            PermissionEnum.DESTINATION_VIEW_PRIVATE,
            PermissionEnum.DESTINATION_VIEW_DRAFT,
            PermissionEnum.DESTINATION_CREATE,
            PermissionEnum.DESTINATION_UPDATE,
            PermissionEnum.DESTINATION_DELETE,
            PermissionEnum.DESTINATION_RESTORE,
            PermissionEnum.DESTINATION_HARD_DELETE
        ]
    };

    /**
     * Builds mock auth headers for a test actor.
     */
    function makeHeaders(
        actor: { id: string; role: string; permissions: string[] },
        extra: Record<string, string> = {}
    ): Record<string, string> {
        return {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': actor.id,
            'x-mock-actor-role': actor.role,
            'x-mock-actor-permissions': JSON.stringify(actor.permissions),
            ...extra
        };
    }

    beforeAll(() => {
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(() => {
        mockRef.adminList = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    });

    describe('status filter (maps to lifecycleState via base schema)', () => {
        it('accepts status=DRAFT and passes it to adminList', async () => {
            // Arrange / Act
            const res = await app.request(`${base}?status=DRAFT`, {
                headers: makeHeaders(adminActor)
            });

            // Assert — with correct permissions, handler MUST execute (200).
            // Any other status indicates a middleware block upstream of the
            // route handler and invalidates this AC-001-04 coverage.
            expect(res.status).toBe(200);
            expect(mockRef.adminList).toHaveBeenCalledOnce();
            const [, query] = mockRef.adminList.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(query).toHaveProperty('status', 'DRAFT');
        });

        it('accepts status=ACTIVE and passes it to adminList', async () => {
            // Arrange / Act
            const res = await app.request(`${base}?status=ACTIVE`, {
                headers: makeHeaders(adminActor)
            });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRef.adminList).toHaveBeenCalledOnce();
            const [, query] = mockRef.adminList.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(query).toHaveProperty('status', 'ACTIVE');
        });

        it('accepts status=ARCHIVED and passes it to adminList', async () => {
            // Arrange / Act
            const res = await app.request(`${base}?status=ARCHIVED`, {
                headers: makeHeaders(adminActor)
            });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRef.adminList).toHaveBeenCalledOnce();
            const [, query] = mockRef.adminList.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(query).toHaveProperty('status', 'ARCHIVED');
        });

        it('rejects invalid status value with validation error', async () => {
            // Arrange / Act
            const res = await app.request(`${base}?status=INVALID_STATE`, {
                headers: makeHeaders(adminActor)
            });

            // Assert — validation layer must reject before reaching handler.
            // Accept either 400 (ResponseFactory.validationError) or 422
            // (zValidator default) depending on middleware ordering.
            expect([400, 422]).toContain(res.status);
            expect(mockRef.adminList).not.toHaveBeenCalled();
        });

        it('defaults to status="all" when not specified', async () => {
            // Arrange / Act
            const res = await app.request(base, {
                headers: makeHeaders(adminActor)
            });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRef.adminList).toHaveBeenCalledOnce();
            const [, query] = mockRef.adminList.mock.calls[0] as [unknown, Record<string, unknown>];
            // AdminSearchBaseSchema defaults status to 'all' — service then
            // bypasses the lifecycleState filter to return rows in any state.
            expect(query).toHaveProperty('status', 'all');
        });
    });
});
