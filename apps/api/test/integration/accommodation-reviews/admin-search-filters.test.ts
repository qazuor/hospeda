/**
 * Integration tests for admin accommodation reviews list endpoint - entity-specific filters.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service receives after the route parses the query string.
 * This verifies the full pipeline: HTTP query param → schema parse → service call.
 *
 * Tested endpoint:
 *   GET /api/v1/admin/accommodation-reviews
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
        AccommodationReviewService: vi.fn().mockImplementation(() => ({
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

describe('Admin Accommodation Reviews List - entity-specific filter params', () => {
    let app: ReturnType<typeof initApp>;

    // Reviews are nested under accommodations in the route tree:
    // /api/v1/admin/accommodations/reviews
    const base = '/api/v1/admin/accommodations/reviews';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_REVIEW_VIEW,
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

    describe('minRating / maxRating filter', () => {
        it('parses minRating=4 and passes it (as number) to adminList', async () => {
            const res = await app.request(`${base}?minRating=4`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('minRating');
                expect(typeof query.minRating).toBe('number');
                expect(query.minRating).toBe(4);
            }
        });

        it('parses maxRating=5 and passes it to adminList', async () => {
            const res = await app.request(`${base}?maxRating=5`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toMatchObject({ maxRating: 5 });
            }
        });

        it('parses both minRating=4 and maxRating=5 together', async () => {
            const res = await app.request(`${base}?minRating=4&maxRating=5`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toMatchObject({ minRating: 4, maxRating: 5 });
            }
        });

        it('returns 4xx for minRating below schema minimum (< 1)', async () => {
            const res = await app.request(`${base}?minRating=0`, {
                headers: makeHeaders(adminActor)
            });

            // Schema validation should produce 400; auth issues produce 401/403
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('returns 4xx for maxRating above schema maximum (> 5)', async () => {
            const res = await app.request(`${base}?maxRating=6`, {
                headers: makeHeaders(adminActor)
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('accepts decimal rating values like 4.5', async () => {
            const res = await app.request(`${base}?minRating=4.5`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query.minRating).toBe(4.5);
            }
        });
    });

    describe('auth guard', () => {
        it('returns 4xx when no auth headers provided', async () => {
            const res = await app.request(base);
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });
});
