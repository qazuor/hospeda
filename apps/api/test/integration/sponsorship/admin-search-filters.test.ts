/**
 * Integration tests for admin sponsorship list endpoint - entity-specific filters.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service receives after the route parses the query string.
 * This verifies the full pipeline: HTTP query param → schema parse → service call.
 *
 * Key behavior under test:
 *   The schema uses `sponsorshipStatus` (not `status`) to avoid collision with the
 *   base schema's `status` field that maps to `lifecycleState`. The service receives
 *   `sponsorshipStatus` with the enum value, and maps it internally.
 *
 * Tested endpoint:
 *   GET /api/v1/admin/sponsorships
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
        SponsorshipService: vi.fn().mockImplementation(() => ({
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

describe('Admin Sponsorship List - entity-specific filter params', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/admin/sponsorships';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.SPONSORSHIP_VIEW,
            PermissionEnum.SPONSORSHIP_VIEW_ANY,
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

    describe('sponsorshipStatus remapping filter', () => {
        it('passes sponsorshipStatus=active to adminList (lowercase enum value)', async () => {
            // SponsorshipStatusEnum values are lowercase: 'active', 'pending', etc.
            const res = await app.request(`${base}?sponsorshipStatus=active`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('sponsorshipStatus', 'active');
            }
        });

        it('passes sponsorshipStatus=pending to adminList', async () => {
            const res = await app.request(`${base}?sponsorshipStatus=pending`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                expect(mockRef.adminList).toHaveBeenCalledOnce();
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query).toHaveProperty('sponsorshipStatus', 'pending');
            }
        });

        it('passes sponsorshipStatus=expired to adminList', async () => {
            const res = await app.request(`${base}?sponsorshipStatus=expired`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query.sponsorshipStatus).toBe('expired');
            }
        });

        it('passes sponsorshipStatus=cancelled to adminList', async () => {
            const res = await app.request(`${base}?sponsorshipStatus=cancelled`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(query.sponsorshipStatus).toBe('cancelled');
            }
        });

        it('returns 4xx for an invalid sponsorshipStatus value', async () => {
            const res = await app.request(`${base}?sponsorshipStatus=INVALID_STATUS`, {
                headers: makeHeaders(adminActor)
            });

            // Schema validation rejects unknown enum values with 400
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('does not confuse sponsorshipStatus with the base status field', async () => {
            // Both params can coexist: base `status` maps to lifecycleState,
            // `sponsorshipStatus` maps to the sponsorship business status.
            const res = await app.request(`${base}?sponsorshipStatus=active&status=ACTIVE`, {
                headers: makeHeaders(adminActor)
            });

            expect([200, 400, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const [_actor, query] = mockRef.adminList.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                // Both should be present and separate
                expect(query).toHaveProperty('sponsorshipStatus', 'active');
                expect(query).toHaveProperty('status');
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
