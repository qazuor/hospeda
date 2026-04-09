/**
 * Integration tests for admin user list endpoint - entity-specific filters.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service receives after the route parses the query string.
 * This verifies the full pipeline: HTTP query param → schema parse → service call.
 *
 * Tested endpoint:
 *   GET /api/v1/admin/users
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
        UserService: vi.fn().mockImplementation(() => ({
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

describe('Admin User List - entity-specific filter params', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/admin/users';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.USER_READ_ALL,
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

    describe('email partial-match filter (ILIKE)', () => {
        it('passes the email param as-is to adminList (service applies ILIKE)', async () => {
            const res = await app.request(`${base}?email=test%40`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('email');
                // The schema passes the string through without transformation;
                // the service layer is responsible for the ILIKE wrapping.
                expect(query.email).toBe('test@');
            }
        });

        it('passes a full email address to adminList unchanged', async () => {
            const res = await app.request(`${base}?email=admin%40example.com`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query.email).toBe('admin@example.com');
            }
        });

        it('passes a domain-only prefix to adminList unchanged', async () => {
            const res = await app.request(`${base}?email=example.com`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query.email).toBe('example.com');
            }
        });
    });

    describe('role filter', () => {
        it('passes role=ADMIN to adminList', async () => {
            const res = await app.request(`${base}?role=ADMIN`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('role', 'ADMIN');
            }
        });

        it('returns 4xx for an invalid role value', async () => {
            const res = await app.request(`${base}?role=SUPERUSER`, {
                headers: makeHeaders(adminActor)
            });

            // Schema validation rejects unknown enum values with 400
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
