/**
 * Tests for mustChangePasswordGate middleware (SPEC-239 T-041)
 *
 * Verifies:
 * 1. Gate blocks a protected route when the mock flag is set → 403 PASSWORD_CHANGE_REQUIRED
 * 2. Gate ALLOWS the change-password endpoint even when the flag is set
 * 3. Gate allows a normal protected route when the flag is absent
 *
 * These tests use the mock-actor infrastructure (`HOSPEDA_ALLOW_MOCK_ACTOR=true`
 * in .env.test) and the `x-mock-must-change-password` test header introduced in
 * mustChangePasswordGate.  All three required mock headers are sent so the actor
 * middleware resolves a real actor (and does not hit the guest fallback).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

/** A protected route that requires auth and carries no special gates */
const PROTECTED_ROUTE = '/api/v1/protected/auth/change-password';

/** Profile status endpoint — lightweight protected route, no billing gate */
const PROTECTED_ME = '/api/v1/protected/profile/status';

/** An admin route that should not be affected by this middleware */
const ADMIN_ROUTE = '/api/v1/admin/users';

const MOCK_ACTOR_ID = '11111111-1111-4111-a111-111111111111';
const MOCK_ACTOR_ROLE = 'USER';
const MOCK_ACTOR_PERMISSIONS_EMPTY = JSON.stringify([]);
const MOCK_ACTOR_PERMISSIONS_ADMIN = JSON.stringify(['access.panelAdmin', 'user.viewAll']);

/** Common headers for an authenticated mock actor */
function authHeaders(permissions: string = MOCK_ACTOR_PERMISSIONS_EMPTY): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        // HOSPEDA_DISABLE_AUTH=true means any 'Bearer *' is a valid token
        authorization: 'Bearer test-token',
        'x-mock-actor-id': MOCK_ACTOR_ID,
        'x-mock-actor-role': MOCK_ACTOR_ROLE,
        'x-mock-actor-permissions': permissions
    };
}

describe('mustChangePasswordGate middleware (SPEC-239 T-041)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // Gate blocks protected routes when flag is set
    // -------------------------------------------------------------------------

    describe('when x-mock-must-change-password: true', () => {
        it('blocks a generic protected route with 403 PASSWORD_CHANGE_REQUIRED', async () => {
            // Arrange
            const headers: Record<string, string> = {
                ...authHeaders(),
                'x-mock-must-change-password': 'true'
            };

            // Act — using a lightweight protected endpoint that exists
            const res = await app.request(PROTECTED_ME, {
                method: 'GET',
                headers
            });

            // Assert — gate must fire before the route handler
            expect(res.status).toBe(403);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).toBe('PASSWORD_CHANGE_REQUIRED');
        });

        it('allows the change-password endpoint (exempt path)', async () => {
            // Arrange — flag is set BUT endpoint is on the exempt list
            const headers: Record<string, string> = {
                ...authHeaders(),
                'x-mock-must-change-password': 'true',
                'content-type': 'application/json'
            };

            // Act — POST to the change-password endpoint; it will fail auth or
            // validation (no real body / credentials) but it must NOT fail with
            // 403 PASSWORD_CHANGE_REQUIRED from the gate.
            const res = await app.request(PROTECTED_ROUTE, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    currentPassword: 'OldPass123!',
                    newPassword: 'NewPass123!'
                })
            });

            // Assert — gate did NOT block; downstream handler may return 400/500
            // but never PASSWORD_CHANGE_REQUIRED from our gate.
            expect(res.status).not.toBe(404);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
        });
    });

    // -------------------------------------------------------------------------
    // Gate is transparent when flag is absent
    // -------------------------------------------------------------------------

    describe('when x-mock-must-change-password header is absent', () => {
        it('passes through to the handler (does not block)', async () => {
            // Arrange — no must-change-password header
            const headers = authHeaders();

            // Act
            const res = await app.request(PROTECTED_ME, {
                method: 'GET',
                headers
            });

            // Assert — gate did not fire; result is whatever the handler returns
            expect(res.status).not.toBe(404);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
        });
    });

    // -------------------------------------------------------------------------
    // Admin routes are NOT covered by this gate (it only applies to /protected/*)
    // -------------------------------------------------------------------------

    describe('admin routes', () => {
        it('does not apply the gate on admin routes (no 403 PASSWORD_CHANGE_REQUIRED)', async () => {
            // Arrange — even with mock flag, admin routes should not be gated
            const headers: Record<string, string> = {
                ...authHeaders(MOCK_ACTOR_PERMISSIONS_ADMIN),
                'x-mock-actor-role': 'SUPER_ADMIN',
                'x-mock-must-change-password': 'true'
            };

            const res = await app.request(ADMIN_ROUTE, {
                method: 'GET',
                headers
            });

            // Assert — admin gate fires, not our gate
            expect(res.status).not.toBe(404);
            const body = (await res.json()) as { error?: { code?: string } };
            expect(body.error?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
        });
    });
});
