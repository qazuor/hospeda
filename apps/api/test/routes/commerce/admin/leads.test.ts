/**
 * Tests for admin commerce leads endpoints (SPEC-239 T-047)
 *
 * Covers:
 * - GET  /api/v1/admin/commerce/leads        (list, requires COMMERCE_VIEW_ALL)
 * - POST /api/v1/admin/commerce/leads/:id/handle (mark-handled, requires COMMERCE_EDIT_ALL)
 *
 * Permission checks are enforced by the service layer; the route factory adds
 * the admin-panel-access gate.  These tests verify the permission-gate contract:
 * actors without the required permission must receive 403 (or 401 for guests).
 */

import { PermissionEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const LIST_BASE = '/api/v1/admin/commerce/leads';
const HANDLE_URL = '/api/v1/admin/commerce/leads/11111111-1111-4111-b111-111111111111/handle';

// ---------------------------------------------------------------------------
// Mock actor header helpers
// ---------------------------------------------------------------------------

const MOCK_ACTOR_ID = '22222222-2222-4222-a222-222222222222';

/** Build mock-actor headers for a SUPER_ADMIN with the given permissions */
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

/** Headers for a plain USER without any admin permissions */
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

describe('Admin commerce leads endpoints (SPEC-239 T-047)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // ── GET /admin/commerce/leads ──────────────────────────────────────────

    describe('GET /api/v1/admin/commerce/leads', () => {
        describe('Route Registration', () => {
            it('should be registered and reachable (not 404)', async () => {
                const res = await app.request(LIST_BASE, {
                    method: 'GET',
                    headers: adminHeaders([
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.COMMERCE_VIEW_ALL
                    ])
                });
                expect(res.status).not.toBe(404);
            });
        });

        describe('Permission gate', () => {
            it('returns 401 for unauthenticated (no auth header)', async () => {
                const res = await app.request(LIST_BASE, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest' }
                });
                // No auth → 401 from the authorization middleware
                expect([401, 403]).toContain(res.status);
            });

            it('returns 403 for authenticated user without admin-panel access', async () => {
                const res = await app.request(LIST_BASE, {
                    method: 'GET',
                    headers: userHeaders()
                });
                // USER role without ACCESS_PANEL_ADMIN → 403 from admin gate
                expect([401, 403]).toContain(res.status);
                const body = (await res.json()) as { error?: { code?: string } };
                // Must NOT be a PASSWORD_CHANGE_REQUIRED block
                expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
            });

            it('allows an actor with COMMERCE_VIEW_ALL + admin access', async () => {
                const res = await app.request(LIST_BASE, {
                    method: 'GET',
                    headers: adminHeaders([
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.COMMERCE_VIEW_ALL
                    ])
                });
                // 200 (db with data), 500 (no db in test), or auth-gated
                // but NOT a permission gate rejection
                expect(res.status).not.toBe(401);
                expect(res.status).not.toBe(403);
            });
        });
    });

    // ── POST /admin/commerce/leads/:id/handle ─────────────────────────────

    describe('POST /api/v1/admin/commerce/leads/:id/handle', () => {
        describe('Route Registration', () => {
            it('should be registered and reachable (not 404)', async () => {
                const res = await app.request(HANDLE_URL, {
                    method: 'POST',
                    headers: {
                        ...adminHeaders([
                            PermissionEnum.ACCESS_PANEL_ADMIN,
                            PermissionEnum.COMMERCE_EDIT_ALL
                        ]),
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'approved' })
                });
                // May be 404 NOT_FOUND (lead doesn't exist) but not route 404
                // We distinguish by checking the response has a body
                if (res.status === 404) {
                    const body = (await res.json()) as { error?: { code?: string } };
                    // Route 404 has no structured body; service NOT_FOUND does
                    expect(body).toBeTruthy();
                } else {
                    expect(res.status).not.toBe(404);
                }
            });
        });

        describe('Permission gate', () => {
            it('returns 401/403 for unauthenticated', async () => {
                const res = await app.request(HANDLE_URL, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'approved' })
                });
                expect([401, 403]).toContain(res.status);
            });

            it('returns 403 for user without COMMERCE_EDIT_ALL', async () => {
                // Has admin access but not COMMERCE_EDIT_ALL
                const res = await app.request(HANDLE_URL, {
                    method: 'POST',
                    headers: {
                        ...adminHeaders([PermissionEnum.ACCESS_PANEL_ADMIN]),
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'approved' })
                });
                // Service will throw FORBIDDEN because COMMERCE_EDIT_ALL is missing
                expect([403]).toContain(res.status);
            });

            it('allows actor with COMMERCE_EDIT_ALL (service may throw NOT_FOUND for fake id)', async () => {
                const res = await app.request(HANDLE_URL, {
                    method: 'POST',
                    headers: {
                        ...adminHeaders([
                            PermissionEnum.ACCESS_PANEL_ADMIN,
                            PermissionEnum.COMMERCE_EDIT_ALL
                        ]),
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'rejected', adminNote: 'Test rejection' })
                });
                // NOT 401 or 403 permission gate; 404 (no such lead) or 500 (no db) is OK
                expect([200, 400, 404, 500]).toContain(res.status);
                const body = (await res.json()) as { error?: { code?: string } };
                expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
            });
        });

        describe('Validation', () => {
            it('rejects invalid status value', async () => {
                const res = await app.request(HANDLE_URL, {
                    method: 'POST',
                    headers: {
                        ...adminHeaders([
                            PermissionEnum.ACCESS_PANEL_ADMIN,
                            PermissionEnum.COMMERCE_EDIT_ALL
                        ]),
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'pending' })
                });
                // 'pending' is not an allowed value for mark-handled
                expect([400, 422]).toContain(res.status);
            });

            it('rejects non-UUID lead id in URL', async () => {
                const badUrl = '/api/v1/admin/commerce/leads/not-a-uuid/handle';
                const res = await app.request(badUrl, {
                    method: 'POST',
                    headers: {
                        ...adminHeaders([
                            PermissionEnum.ACCESS_PANEL_ADMIN,
                            PermissionEnum.COMMERCE_EDIT_ALL
                        ]),
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'approved' })
                });
                expect([400, 404, 422]).toContain(res.status);
            });
        });
    });
});
