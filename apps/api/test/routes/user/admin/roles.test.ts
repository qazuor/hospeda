/**
 * Tests for the admin multi-role endpoints (HOS-296 §7).
 *
 * Three things are worth pinning here, and only one of them is the happy path:
 *
 * 1. **The gate.** Both mutations require `USER_UPDATE_ROLES` — the exact
 *    permission the retired single-select needed. An admin without it must be
 *    blocked, or the cut would silently widen who can change a user's hats.
 * 2. **The audit records the REAL actor.** `grantRole`/`revokeRole` write the
 *    `user_role_audit` row themselves, so the route's contribution to AC-6 is
 *    passing the authenticated operator's id as `grantedBy`/`revokedBy` and
 *    forwarding their `reason`. A route that passed `null` would compile, work,
 *    and produce an audit trail that cannot attribute anything.
 * 3. **Revoking the last role is a 400, not a 500.** `revokeRole` rejects it
 *    with `VALIDATION_ERROR` (AC-5); the route must surface that as a client
 *    error. Letting it escape as a 500 would read as an outage and hide a
 *    deliberate, documented refusal.
 *
 * The role primitives are mocked so the assertions are about the ROUTE — the
 * primitives' own behaviour (idempotence, the `FOR UPDATE` lock, the audit
 * insert) is covered by `packages/service-core`'s `user-role.service.test.ts`.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.hoisted` because the `vi.mock` factory below is lifted above every
// import — a plain `const` here would still be in its temporal dead zone when
// `actorMiddleware` (which imports `getUserRoles`) is first evaluated.
const { mockGrantRole, mockRevokeRole, mockGetUserRoles, mockGetUserRoleGrants } = vi.hoisted(
    () => ({
        mockGrantRole: vi.fn(),
        mockRevokeRole: vi.fn(),
        mockGetUserRoles: vi.fn(),
        mockGetUserRoleGrants: vi.fn()
    })
);

// The global `test/setup.ts` mock of `@repo/service-core` spreads the real
// module and overrides only the service CLASSES, so the role primitives would
// otherwise resolve to the real implementations and hit the database. This
// file-level mock takes precedence and stubs exactly those four functions,
// keeping every other export (including the setup file's own class mocks,
// which are re-applied below by spreading the actual module) intact.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        grantRole: mockGrantRole,
        revokeRole: mockRevokeRole,
        getUserRoles: mockGetUserRoles,
        getUserRoleGrants: mockGetUserRoleGrants
    };
});

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('Admin user role routes (HOS-296)', () => {
    let app: AppOpenAPI;

    const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
    const TARGET_ID = '22222222-2222-4222-8222-222222222222';
    const base = `/api/v1/admin/users/${TARGET_ID}/roles`;

    /**
     * The permission pair a real role-managing operator holds. Both are needed
     * on the shared `/{id}/roles` path — see the stacking note on the route
     * module and the dedicated test below.
     */
    const ROLE_ADMIN_PERMS = ['user.read.all', 'user.update.roles'] as const;

    /** Headers for an admin-panel actor carrying the given granular permissions. */
    const headers = (perms: readonly string[]): Record<string, string> => ({
        authorization: 'Bearer mock-token',
        'user-agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...perms])
    });

    const jsonHeaders = (perms: readonly string[]): Record<string, string> => ({
        ...headers(perms),
        'content-type': 'application/json'
    });

    const request = async (
        method: string,
        path: string,
        opts: { headers?: Record<string, string>; body?: unknown } = {}
    ): Promise<Response> => {
        const init: RequestInit = { method };
        if (opts.headers) init.headers = opts.headers;
        if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
        return app.request(path, init);
    };

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        mockGrantRole.mockReset();
        mockRevokeRole.mockReset();
        mockGetUserRoles.mockReset();
        mockGetUserRoleGrants.mockReset();

        mockGrantRole.mockResolvedValue({ data: undefined });
        mockRevokeRole.mockResolvedValue({ data: undefined });
        mockGetUserRoles.mockResolvedValue(['USER', 'HOST']);
        mockGetUserRoleGrants.mockResolvedValue([]);
    });

    // ---- Gate -----------------------------------------------------------

    describe('permission gate', () => {
        it('rejects an unauthenticated guest on every verb', async () => {
            const guestHeaders = { 'user-agent': 'vitest', 'content-type': 'application/json' };

            expect([400, 401, 403]).toContain(
                (await request('GET', base, { headers: guestHeaders })).status
            );
            expect([400, 401, 403]).toContain(
                (await request('POST', base, { headers: guestHeaders, body: { role: 'HOST' } }))
                    .status
            );
            expect([400, 401, 403]).toContain(
                (await request('DELETE', `${base}/HOST`, { headers: guestHeaders })).status
            );
        });

        it('blocks an admin WITHOUT user.update.roles from granting (403)', async () => {
            const res = await request('POST', base, {
                headers: jsonHeaders(['user.read.all']),
                body: { role: 'HOST' }
            });

            expect(res.status).toBe(403);
            expect(mockGrantRole).not.toHaveBeenCalled();
        });

        it('blocks an admin WITHOUT user.update.roles from revoking (403)', async () => {
            const res = await request('DELETE', `${base}/HOST`, {
                headers: headers(['user.read.all'])
            });

            expect(res.status).toBe(403);
            expect(mockRevokeRole).not.toHaveBeenCalled();
        });

        it('requires BOTH permissions on the shared /roles path (route-factory stacking)', async () => {
            // GET and POST share `/{id}/roles` and the factory applies route
            // middlewares per PATH, not per method, so each route's gate also
            // guards the other's verb. Documented rather than worked around:
            // the same stacking exists on `/{id}/permissions`, and every
            // seeded holder of `user.update.roles` also holds `user.read.all`.
            const readOnly = await request('GET', base, {
                headers: headers(['user.update.roles'])
            });
            expect(readOnly.status).toBe(403);
            expect(mockGetUserRoleGrants).not.toHaveBeenCalled();

            const writeOnly = await request('POST', base, {
                headers: jsonHeaders(['user.update.roles']),
                body: { role: 'HOST' }
            });
            expect(writeOnly.status).toBe(403);
            expect(mockGrantRole).not.toHaveBeenCalled();

            // …and the pair a real operator holds gets through.
            const both = await request('POST', base, {
                headers: jsonHeaders(ROLE_ADMIN_PERMS),
                body: { role: 'HOST' }
            });
            expect(both.status).not.toBe(403);
        });
    });

    // ---- GET -------------------------------------------------------------

    describe('GET /:id/roles', () => {
        it('returns each held role with when it was granted and by whom', async () => {
            mockGetUserRoleGrants.mockResolvedValue([
                {
                    role: 'USER',
                    grantedAt: new Date('2026-01-01T00:00:00.000Z'),
                    grantedBy: null,
                    grantedByName: null,
                    grantReason: 'signup'
                },
                {
                    role: 'HOST',
                    grantedAt: new Date('2026-02-01T00:00:00.000Z'),
                    grantedBy: ACTOR_ID,
                    grantedByName: 'Ada Admin',
                    grantReason: 'manual grant'
                }
            ]);

            const res = await request('GET', base, { headers: headers(['user.read.all']) });
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data: {
                    userId: string;
                    roles: readonly {
                        role: string;
                        grantedBy: string | null;
                        grantedByName: string | null;
                        grantReason: string | null;
                    }[];
                };
            };

            expect(mockGetUserRoleGrants).toHaveBeenCalledWith({ userId: TARGET_ID });
            expect(body.data.userId).toBe(TARGET_ID);
            expect(body.data.roles.map((entry) => entry.role)).toEqual(['USER', 'HOST']);
            // The provenance is the whole point of this endpoint (R-1): an
            // automatic grant is distinguishable from an operator's.
            expect(body.data.roles[0]).toMatchObject({
                grantedBy: null,
                grantedByName: null,
                grantReason: 'signup'
            });
            expect(body.data.roles[1]).toMatchObject({
                grantedBy: ACTOR_ID,
                grantedByName: 'Ada Admin'
            });
        });
    });

    // ---- POST ------------------------------------------------------------

    describe('POST /:id/roles', () => {
        it('grants with the REAL actor as grantedBy and forwards the reason (AC-6)', async () => {
            const res = await request('POST', base, {
                headers: jsonHeaders(ROLE_ADMIN_PERMS),
                body: { role: 'HOST', reason: 'took over an accommodation' }
            });

            expect(res.status).not.toBe(403);
            expect(res.status).toBeLessThan(400);
            expect(mockGrantRole).toHaveBeenCalledTimes(1);
            expect(mockGrantRole).toHaveBeenCalledWith({
                userId: TARGET_ID,
                role: 'HOST',
                grantedBy: ACTOR_ID,
                reason: 'took over an accommodation'
            });
        });

        it('passes a null reason rather than inventing one when the operator omits it', async () => {
            await request('POST', base, {
                headers: jsonHeaders(ROLE_ADMIN_PERMS),
                body: { role: 'SPONSOR' }
            });

            expect(mockGrantRole).toHaveBeenCalledWith(
                expect.objectContaining({ grantedBy: ACTOR_ID, reason: null })
            );
        });

        it('returns the post-mutation role SET, not a bare acknowledgement', async () => {
            mockGetUserRoles.mockResolvedValue(['USER', 'HOST', 'SPONSOR']);

            const res = await request('POST', base, {
                headers: jsonHeaders(ROLE_ADMIN_PERMS),
                body: { role: 'SPONSOR' }
            });

            const body = (await res.json()) as {
                data: { userId: string; role: string; roles: readonly string[] };
            };
            expect(body.data).toEqual({
                userId: TARGET_ID,
                role: 'SPONSOR',
                roles: ['USER', 'HOST', 'SPONSOR']
            });
        });

        it('rejects a role outside RoleEnum without reaching the primitive', async () => {
            const res = await request('POST', base, {
                headers: jsonHeaders(ROLE_ADMIN_PERMS),
                body: { role: 'WIZARD' }
            });

            expect(res.status).toBe(400);
            expect(mockGrantRole).not.toHaveBeenCalled();
        });
    });

    // ---- DELETE ----------------------------------------------------------

    describe('DELETE /:id/roles/:role', () => {
        it('revokes with the REAL actor as revokedBy and the reason from the query', async () => {
            const res = await request('DELETE', `${base}/HOST?reason=no+longer+a+host`, {
                headers: headers(['user.update.roles'])
            });

            expect(res.status).not.toBe(403);
            expect(res.status).toBeLessThan(400);
            expect(mockRevokeRole).toHaveBeenCalledWith({
                userId: TARGET_ID,
                role: 'HOST',
                revokedBy: ACTOR_ID,
                reason: 'no longer a host'
            });
        });

        it('passes a null reason when the query parameter is absent', async () => {
            await request('DELETE', `${base}/HOST`, { headers: headers(['user.update.roles']) });

            expect(mockRevokeRole).toHaveBeenCalledWith(
                expect.objectContaining({ revokedBy: ACTOR_ID, reason: null })
            );
        });

        it('maps the last-role refusal to 400, NOT 500 (AC-5)', async () => {
            mockRevokeRole.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Cannot revoke role 'USER': it is the last role held by user '${TARGET_ID}'.`
                }
            });

            const res = await request('DELETE', `${base}/USER`, {
                headers: headers(['user.update.roles'])
            });

            expect(res.status).toBe(400);
            expect(res.status).not.toBe(500);

            const body = (await res.json()) as { error?: { code?: string; message?: string } };
            expect(body.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(body.error?.message).toContain('last role');
        });

        it('maps an unknown user to 404, not 500', async () => {
            mockRevokeRole.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `User '${TARGET_ID}' not found.`
                }
            });

            const res = await request('DELETE', `${base}/HOST`, {
                headers: headers(['user.update.roles'])
            });

            expect(res.status).toBe(404);
        });

        it('rejects a role outside RoleEnum without reaching the primitive', async () => {
            const res = await request('DELETE', `${base}/WIZARD`, {
                headers: headers(['user.update.roles'])
            });

            expect(res.status).toBe(400);
            expect(mockRevokeRole).not.toHaveBeenCalled();
        });
    });
});
