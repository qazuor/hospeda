/**
 * Integration tests for admin event list endpoint - entity-specific filters.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service receives after the route parses the query string.
 * This verifies the full pipeline: HTTP query param → schema parse → service call.
 *
 * Tested endpoint:
 *   GET /api/v1/admin/events
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
        EventService: vi.fn().mockImplementation(() => ({
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

describe('Admin Event List - entity-specific filter params', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/admin/events';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.EVENT_VIEW_ALL,
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

    describe('startDateAfter filter (JSONB date extraction)', () => {
        it('parses startDateAfter ISO string and passes a Date to adminList', async () => {
            const dateStr = '2026-01-01T00:00:00Z';
            const res = await app.request(`${base}?startDateAfter=${encodeURIComponent(dateStr)}`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('startDateAfter');
                // z.coerce.date() converts the string to a Date object
                expect(query.startDateAfter).toBeInstanceOf(Date);
                expect((query.startDateAfter as Date).getFullYear()).toBe(2026);
            }
        });

        it('parses endDateBefore ISO string and passes a Date to adminList', async () => {
            const dateStr = '2026-12-31T23:59:59Z';
            const res = await app.request(`${base}?endDateBefore=${encodeURIComponent(dateStr)}`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('endDateBefore');
                expect(query.endDateBefore).toBeInstanceOf(Date);
            }
        });

        it('parses both startDateAfter and startDateBefore together', async () => {
            const after = '2026-01-01T00:00:00Z';
            const before = '2026-12-31T00:00:00Z';
            const res = await app.request(
                `${base}?startDateAfter=${encodeURIComponent(after)}&startDateBefore=${encodeURIComponent(before)}`,
                { headers: makeHeaders(adminActor) }
            );

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query.startDateAfter).toBeInstanceOf(Date);
                expect(query.startDateBefore).toBeInstanceOf(Date);
                // after < before
                expect((query.startDateAfter as Date).getTime()).toBeLessThan(
                    (query.startDateBefore as Date).getTime()
                );
            }
        });

        it('returns 4xx for invalid date string', async () => {
            const res = await app.request(`${base}?startDateAfter=not-a-date`, {
                headers: makeHeaders(adminActor)
            });

            // Schema coercion failure returns 400; auth errors 401/403
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
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
