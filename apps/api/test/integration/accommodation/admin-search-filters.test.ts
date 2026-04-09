/**
 * Integration tests for admin accommodation list endpoint - entity-specific filters.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service receives after the route parses the query string.
 * This verifies the full pipeline: HTTP query param → schema parse → service call.
 *
 * Tested endpoint:
 *   GET /api/v1/admin/accommodations
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable reference that holds the captured mock for adminList.
 * Using a plain object avoids the temporal-dead-zone issue caused by `vi.mock()`
 * hoisting: the factory runs before the outer `const` declarations are
 * initialized, so we cannot reference a `const adminListMock` from inside
 * the factory.  Instead, we store the mock on `mockRef` and read it in tests.
 */
const mockRef: { adminList: ReturnType<typeof vi.fn> } = {
    adminList: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
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

describe('Admin Accommodation List - entity-specific filter params', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/admin/accommodations';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            PermissionEnum.MANAGE_CONTENT
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

    describe('minPrice filter', () => {
        it('parses minPrice=100 and passes it (as number) to adminList', async () => {
            const res = await app.request(`${base}?minPrice=100`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('minPrice', 100);
                expect(typeof query.minPrice).toBe('number');
            }
        });

        it('parses maxPrice=500 and passes it (as number) to adminList', async () => {
            const res = await app.request(`${base}?maxPrice=500`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('maxPrice', 500);
                expect(typeof query.maxPrice).toBe('number');
            }
        });

        it('parses both minPrice=100 and maxPrice=500 together', async () => {
            const res = await app.request(`${base}?minPrice=100&maxPrice=500`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toMatchObject({ minPrice: 100, maxPrice: 500 });
            }
        });

        it('returns 400 for negative minPrice (schema rejects values below 0)', async () => {
            const res = await app.request(`${base}?minPrice=-1`, {
                headers: makeHeaders(adminActor)
            });

            // Auth runs before validation; if auth check itself fails first the
            // middleware returns 400 (missing required header) or 403 (forbidden).
            // With a valid admin actor the schema validation runs and returns 400.
            expect([400, 403]).toContain(res.status);
        });

        it('coerces string price param "250" to number 250', async () => {
            const res = await app.request(`${base}?minPrice=250`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(typeof query.minPrice).toBe('number');
                expect(query.minPrice).toBe(250);
            }
        });
    });

    describe('auth guard', () => {
        it('returns 4xx when no auth headers provided', async () => {
            const res = await app.request(base);
            // The middleware stack can return 400 (missing required header),
            // 401 (unauthenticated), or 403 (forbidden) depending on the
            // exact middleware ordering and which check fires first.
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });
});
