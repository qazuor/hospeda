/**
 * End-to-end integration test spanning BOTH MercadoLibre OAuth routes
 * together (HOS-45 / SPEC-278 T-016): `authorize` → follow the redirect's
 * `state` → `callback`.
 *
 * Unlike `authorize.test.ts` (T-011) and `callback.test.ts` (T-012), which
 * each test their own route in isolation, this file exercises the real
 * state-sharing mechanism (`validateAndConsumeState`) UNMOCKED across both
 * routes in the same request lifecycle: issuing a state via `authorize` and
 * consuming it via `callback`, including the one-time-use replay guarantee.
 *
 * Only the real outbound HTTP boundary (`exchangeAuthorizationCode`) and the
 * credential persistence layer (`ml-credential.repository.ts`) are mocked.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { TEST_CLIENT_ID, TEST_REDIRECT_URI } = vi.hoisted(() => ({
    TEST_CLIENT_ID: 'test-ml-client-id',
    TEST_REDIRECT_URI: 'https://api.hospeda.com.ar/api/v1/admin/mercadolibre-oauth/callback'
}));

// Use importOriginal so every other export (validateApiEnv, getEnv, etc.) is
// preserved; only the two MercadoLibre OAuth env vars are overridden with
// deterministic test values, mirroring authorize.test.ts / callback.test.ts.
vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../../src/utils/env')>();
    original.validateApiEnv();
    return {
        ...original,
        env: {
            ...original.env,
            HOSPEDA_MERCADOLIBRE_CLIENT_ID: TEST_CLIENT_ID,
            HOSPEDA_MERCADOLIBRE_REDIRECT_URI: TEST_REDIRECT_URI
        }
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { mockExchangeAuthorizationCode, mockUpsertMLCredential, mockGetActiveMLCredential } =
    vi.hoisted(() => ({
        mockExchangeAuthorizationCode: vi.fn(),
        mockUpsertMLCredential: vi.fn(),
        mockGetActiveMLCredential: vi.fn()
    }));

// The only real outbound HTTP boundary in this flow — mocked so no real
// network call to MercadoLibre is ever attempted.
vi.mock('../../../../src/services/mercadolibre-oauth/ml-oauth-client.js', () => ({
    exchangeAuthorizationCode: mockExchangeAuthorizationCode
}));

// Credential persistence — mocked so this test never touches the real DB.
vi.mock('../../../../src/services/mercadolibre-oauth/ml-credential.repository.js', () => ({
    upsertMLCredential: mockUpsertMLCredential,
    getActiveMLCredential: mockGetActiveMLCredential
}));

// Deliberately NOT mocked: `validateAndConsumeState` (imported directly, not
// mocked) is the real state-sharing mechanism between the two routes and is
// exactly what this end-to-end test needs to exercise for real.
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const USER_ID = '55555555-5555-4555-8555-555555555555';

/** Builds an admin actor with the base admin-access permissions plus any extras. */
function buildAdminActor(permissions: PermissionEnum[]): Actor {
    return {
        id: USER_ID,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            ...permissions
        ]
    };
}

/** Builds request headers that the test-only mock-actor middleware reads. */
function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

/** Hits the real `authorize` route and extracts the freshly generated `state` param. */
async function callAuthorize(
    app: AppOpenAPI,
    actor: Actor
): Promise<{ status: number; state: string | null }> {
    const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
        method: 'GET',
        headers: actorHeaders(actor),
        redirect: 'manual'
    });
    const location = res.headers.get('location');
    const state = location ? new URL(location).searchParams.get('state') : null;
    return { status: res.status, state };
}

/** Hits the real `callback` route with the given `code`/`state` query params. */
async function callCallback(
    app: AppOpenAPI,
    actor: Actor,
    { code, state }: { code: string; state: string }
) {
    return app.request(
        `/api/v1/admin/mercadolibre-oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
        {
            method: 'GET',
            headers: actorHeaders(actor)
        }
    );
}

describe('MercadoLibre OAuth end-to-end flow (HOS-45 / SPEC-278 T-016)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('completes the full authorize -> callback happy-path flow', async () => {
        // Arrange
        const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);
        const expiresIn = 21600; // 6 hours, in seconds
        mockExchangeAuthorizationCode.mockResolvedValueOnce({
            accessToken: 'secret-access-token',
            refreshToken: 'secret-refresh-token',
            expiresIn,
            tokenType: 'bearer'
        });
        mockUpsertMLCredential.mockResolvedValueOnce(undefined);

        // Act: start the flow and extract the state MercadoLibre would echo back
        const { status: authorizeStatus, state } = await callAuthorize(app, actor);
        expect(authorizeStatus).toBe(302);
        expect(state).toBeTruthy();

        // Act: complete the flow with the same state
        const beforeCall = Date.now();
        const res = await callCallback(app, actor, {
            code: 'auth-code-e2e',
            state: state as string
        });

        // Assert
        expect(res.status).toBe(200);

        const body = await res.json();
        const bodyText = JSON.stringify(body);
        expect(bodyText).not.toContain('secret-access-token');
        expect(bodyText).not.toContain('secret-refresh-token');
        expect(body.data ?? body).toMatchObject({
            success: true,
            provider: 'mercadolibre'
        });

        expect(mockExchangeAuthorizationCode).toHaveBeenCalledTimes(1);
        expect(mockExchangeAuthorizationCode).toHaveBeenCalledWith({
            code: 'auth-code-e2e',
            redirectUri: TEST_REDIRECT_URI
        });

        expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
        const upsertArg = mockUpsertMLCredential.mock.calls[0]?.[0];
        expect(upsertArg.accessToken).toBe('secret-access-token');
        expect(upsertArg.refreshToken).toBe('secret-refresh-token');
        expect(upsertArg.expiresAt).toBeInstanceOf(Date);

        const expectedExpiresAtMs = beforeCall + expiresIn * 1000;
        const toleranceMs = 5_000;
        expect(Math.abs(upsertArg.expiresAt.getTime() - expectedExpiresAtMs)).toBeLessThanOrEqual(
            toleranceMs
        );
    });

    it('rejects a callback with a state that was never issued by authorize', async () => {
        // Arrange: skip the authorize call entirely, use an unknown state
        const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);

        // Act
        const res = await callCallback(app, actor, {
            code: 'auth-code-invalid-state',
            state: 'never-issued-by-authorize-state-value'
        });

        // Assert
        expect(res.status).toBe(400);
        expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled();
        expect(mockUpsertMLCredential).not.toHaveBeenCalled();
    });

    it('rejects a replayed state on a second callback call after a successful flow', async () => {
        // Arrange: run the full happy-path flow once so the state is consumed
        const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);
        mockExchangeAuthorizationCode.mockResolvedValueOnce({
            accessToken: 'secret-access-token',
            refreshToken: 'secret-refresh-token',
            expiresIn: 21600,
            tokenType: 'bearer'
        });
        mockUpsertMLCredential.mockResolvedValueOnce(undefined);

        const { state } = await callAuthorize(app, actor);
        expect(state).toBeTruthy();

        const firstRes = await callCallback(app, actor, {
            code: 'auth-code-first-use',
            state: state as string
        });
        expect(firstRes.status).toBe(200);
        expect(mockExchangeAuthorizationCode).toHaveBeenCalledTimes(1);
        expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);

        // Act: replay the exact same (now-consumed) state with a fresh code
        const replayRes = await callCallback(app, actor, {
            code: 'auth-code-replay-attempt',
            state: state as string
        });

        // Assert: one-time-use state rejects the replay before any new exchange/persist
        expect(replayRes.status).toBe(400);
        expect(mockExchangeAuthorizationCode).toHaveBeenCalledTimes(1);
        expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for an admin actor without INTEGRATION_MERCADOLIBRE_MANAGE on authorize', async () => {
        // Arrange
        const actor = buildAdminActor([]);

        // Act
        const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
            method: 'GET',
            headers: actorHeaders(actor),
            redirect: 'manual'
        });

        // Assert
        expect(res.status).toBe(403);
        expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled();
        expect(mockUpsertMLCredential).not.toHaveBeenCalled();
    });
});
