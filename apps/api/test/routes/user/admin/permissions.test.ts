/**
 * Tests for the admin per-user permission override routes (SPEC-170 / T-018).
 *
 * These are ROUTE-GATE tests: they verify the permission middleware and route
 * resolution, not the service logic (the service is exercised by the unit tests
 * in `@repo/service-core`). The service is NOT mocked here, so once the gate
 * passes the handler runs against the mocked `@repo/db` and returns 404/500 —
 * irrelevant to the gate assertions, which only check whether the request was
 * blocked (403) or allowed through (not 403) by the authorization middleware.
 *
 * Each request carries the `authorization` + `user-agent` headers the admin
 * validation layer requires (without them every request 400s on
 * MISSING_REQUIRED_HEADER before the permission gate is reached).
 *
 * Gating model under test: the routes require the permission-management trio.
 * We assert the security boundary (admin WITHOUT the trio is blocked; admin WITH
 * the full trio — i.e. a SUPER_ADMIN-equivalent, the only holder per T-011 — is
 * allowed). NOTE: GET and POST share the `/:id/permissions` path, so their
 * route-level auth middleware stacks (a known route-factory behavior, also
 * present on the sibling `/:id` GET/PUT/PATCH/DELETE routes); in practice only
 * SUPER_ADMIN holds the trio, so the per-method distinction is moot today.
 *
 * Routing is validated implicitly: the trio does NOT include USER_READ_ALL
 * (required by the sibling `GET /:id` getById route). An actor holding only the
 * trio that is NOT blocked on `GET /:id/permissions` proves the request reached
 * the permissions route, not the bare `/:id` route.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('Admin user permission override routes (SPEC-170 gate + routing)', () => {
    let app: AppOpenAPI;

    const USER_ID = '11111111-1111-4111-8111-111111111111';
    const PERMISSION = 'post.create';
    const base = `/api/v1/admin/users/${USER_ID}/permissions`;
    const deletePath = `${base}/${PERMISSION}`;

    /** Permission-management trio (held by SUPER_ADMIN per SPEC-170 T-011). */
    const MANAGE_TRIO = ['permission.view', 'permission.assign', 'permission.revoke'] as const;

    /** Admin-panel actor headers plus the given granular permissions. */
    const headers = (perms: readonly string[]): Record<string, string> => ({
        authorization: 'Bearer mock-token',
        'user-agent': 'vitest',
        'x-mock-actor-id': USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...perms])
    });

    const jsonHeaders = (perms: readonly string[]): Record<string, string> => ({
        ...headers(perms),
        'content-type': 'application/json'
    });

    const statusOf = async (
        method: string,
        path: string,
        opts: { headers?: Record<string, string>; body?: unknown } = {}
    ): Promise<number> => {
        const init: RequestInit = { method };
        if (opts.headers) init.headers = opts.headers;
        if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
        try {
            const res = await app.request(path, init);
            return res.status;
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                return (error as { status: number }).status;
            }
            throw error;
        }
    };

    beforeAll(() => {
        app = initApp();
    });

    describe('GET /:id/permissions', () => {
        it('rejects an unauthenticated guest', async () => {
            expect([400, 401, 403]).toContain(await statusOf('GET', base));
        });

        it('blocks an admin without the permission trio (403)', async () => {
            expect(await statusOf('GET', base, { headers: headers([]) })).toBe(403);
        });

        it('lets a trio-holding admin through the gate (not 403) — and routes to permissions, not /:id', async () => {
            const status = await statusOf('GET', base, { headers: headers(MANAGE_TRIO) });
            expect(status).not.toBe(401);
            expect(status).not.toBe(403);
        });
    });

    describe('POST /:id/permissions', () => {
        const body = { permission: PERMISSION, effect: 'grant' };

        it('rejects an unauthenticated guest', async () => {
            expect([400, 401, 403]).toContain(
                await statusOf('POST', base, {
                    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                    body
                })
            );
        });

        it('blocks an admin without the permission trio (403)', async () => {
            expect(await statusOf('POST', base, { headers: jsonHeaders([]), body })).toBe(403);
        });

        it('lets a trio-holding admin through the gate (not 403)', async () => {
            const status = await statusOf('POST', base, {
                headers: jsonHeaders(MANAGE_TRIO),
                body
            });
            expect(status).not.toBe(401);
            expect(status).not.toBe(403);
        });
    });

    describe('DELETE /:id/permissions/:permission', () => {
        it('rejects an unauthenticated guest', async () => {
            expect([400, 401, 403]).toContain(await statusOf('DELETE', deletePath));
        });

        it('blocks an admin without the permission trio (403)', async () => {
            expect(await statusOf('DELETE', deletePath, { headers: headers([]) })).toBe(403);
        });

        it('lets a trio-holding admin through the gate (not 403)', async () => {
            const status = await statusOf('DELETE', deletePath, {
                headers: headers(MANAGE_TRIO)
            });
            expect(status).not.toBe(401);
            expect(status).not.toBe(403);
        });
    });
});
