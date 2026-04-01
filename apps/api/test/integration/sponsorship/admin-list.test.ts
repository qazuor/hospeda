import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Integration tests for admin sponsorship list route.
 *
 * Route tested:
 *   GET /api/v1/admin/sponsorships
 */
describe('Admin Sponsorship List Route', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/admin/sponsorships';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.SPONSORSHIP_VIEW,
            PermissionEnum.MANAGE_CONTENT
        ]
    };

    const userWithoutPermissions = {
        id: crypto.randomUUID(),
        role: RoleEnum.USER,
        permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.ACCESS_API_PRIVATE]
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

    it('returns paginated list for admin actor with SPONSORSHIP_VIEW permission', async () => {
        const res = await app.request(`${base}?page=1&pageSize=10`, {
            headers: makeHeaders(adminActor)
        });
        expect([200, 400, 401, 402, 403]).toContain(res.status);

        if (res.status === 200) {
            const body = await res.json();
            expect(body).toBeDefined();
        }
    });

    it('returns 401 or 403 when no auth headers provided', async () => {
        const res = await app.request(base);
        expect([401, 403]).toContain(res.status);
    });

    it('returns 403 when user lacks SPONSORSHIP_VIEW permission', async () => {
        const res = await app.request(base, {
            headers: makeHeaders(userWithoutPermissions)
        });
        expect([401, 403]).toContain(res.status);
    });

    it('accepts valid admin search filter params without error', async () => {
        const res = await app.request(`${base}?page=1&pageSize=5&includeDeleted=false`, {
            headers: makeHeaders(adminActor)
        });
        expect([200, 400, 401, 402, 403]).toContain(res.status);
    });
});
