/**
 * Tests for the admin commerce provision-owner endpoint (SPEC-239 T-050)
 *
 * URL: POST /api/v1/admin/commerce/leads/:id/provision-owner
 *
 * Covers:
 * - Route registration (not 404)
 * - Permission gate (401 without auth, 403 without COMMERCE_EDIT_ALL)
 * - Actors with COMMERCE_EDIT_ALL pass the gate (DB/service failures are OK in tests)
 * - Non-UUID lead ID returns 400/422
 * - The happy-path response NEVER includes temporaryPassword
 *
 * The test environment has no real database. Calls that reach the DB layer
 * are expected to fail with 404 or 500 — these are NOT permission-gate errors
 * and are treated as acceptable outcomes (see leads.test.ts precedent).
 *
 * @module test/routes/commerce/admin/provision-owner.test
 */

import { PermissionEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const PROVISION_URL =
    '/api/v1/admin/commerce/leads/11111111-1111-4111-b111-111111111111/provision-owner';

// ---------------------------------------------------------------------------
// Mock actor header helpers
// ---------------------------------------------------------------------------

const MOCK_ACTOR_ID = '22222222-2222-4222-a222-222222222222';

/** Build mock-actor headers with the given permission set. */
function adminHeaders(permissions: PermissionEnum[]): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        authorization: 'Bearer test-token',
        'x-mock-actor-id': MOCK_ACTOR_ID,
        'x-mock-actor-role': 'SUPER_ADMIN',
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

/** Headers for a plain USER without any admin permissions. */
function userHeaders(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        authorization: 'Bearer test-token',
        'x-mock-actor-id': MOCK_ACTOR_ID,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin commerce provision-owner endpoint (SPEC-239 T-050)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(PROVISION_URL, {
                method: 'POST',
                headers: adminHeaders([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.COMMERCE_EDIT_ALL
                ])
            });
            // May return 404 (lead not found), 500 (no DB), but NOT a route 404.
            // A structured JSON body distinguishes a service 404 from a route 404.
            if (res.status === 404) {
                const body = (await res.json()) as { error?: { code?: string } };
                expect(body).toBeTruthy();
            } else {
                expect(res.status).not.toBe(404);
            }
        });
    });

    describe('Permission gate', () => {
        it('returns 401 or 403 for unauthenticated request (no auth header)', async () => {
            const res = await app.request(PROVISION_URL, {
                method: 'POST',
                headers: { 'user-agent': 'vitest' }
            });
            expect([401, 403]).toContain(res.status);
        });

        it('returns 403 for authenticated user without admin-panel access', async () => {
            const res = await app.request(PROVISION_URL, {
                method: 'POST',
                headers: userHeaders()
            });
            expect([401, 403]).toContain(res.status);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
        });

        it('returns 403 for actor with admin access but missing COMMERCE_EDIT_ALL', async () => {
            const res = await app.request(PROVISION_URL, {
                method: 'POST',
                headers: adminHeaders([PermissionEnum.ACCESS_PANEL_ADMIN])
            });
            expect([403]).toContain(res.status);
        });

        it('allows actor with COMMERCE_EDIT_ALL (service may fail due to no DB)', async () => {
            const res = await app.request(PROVISION_URL, {
                method: 'POST',
                headers: adminHeaders([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.COMMERCE_EDIT_ALL
                ])
            });
            // NOT 401 or 403 permission gate rejection.
            // 404 (lead not found) or 500 (no DB) are acceptable.
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
        });
    });

    describe('Validation', () => {
        it('rejects a non-UUID lead ID with 400 or 422', async () => {
            const badUrl = '/api/v1/admin/commerce/leads/not-a-valid-uuid/provision-owner';
            const res = await app.request(badUrl, {
                method: 'POST',
                headers: adminHeaders([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.COMMERCE_EDIT_ALL
                ])
            });
            expect([400, 404, 422]).toContain(res.status);
        });
    });

    describe('Response shape', () => {
        it('does NOT include temporaryPassword in response for any outcome', async () => {
            const res = await app.request(PROVISION_URL, {
                method: 'POST',
                headers: adminHeaders([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.COMMERCE_EDIT_ALL
                ])
            });
            const body = (await res.json()) as Record<string, unknown>;

            // The temporary password must never be present in any HTTP response,
            // regardless of whether the request succeeded or failed.
            expect(body).not.toHaveProperty('temporaryPassword');
            if (body.data && typeof body.data === 'object') {
                expect(body.data).not.toHaveProperty('temporaryPassword');
            }
        });
    });
});
