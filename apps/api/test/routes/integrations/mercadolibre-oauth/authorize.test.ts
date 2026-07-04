import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { TEST_CLIENT_ID, TEST_REDIRECT_URI } = vi.hoisted(() => ({
    TEST_CLIENT_ID: 'test-ml-client-id',
    TEST_REDIRECT_URI: 'https://api.hospeda.com.ar/api/v1/admin/mercadolibre-oauth/callback'
}));

// Use importOriginal so every other export (validateApiEnv, getEnv, etc.) is
// preserved; only the two MercadoLibre OAuth env vars are overridden with
// deterministic test values. `env` is populated lazily by `validateApiEnv()`
// (called as a side effect elsewhere in the app graph), so it may still be
// `undefined` at factory-eval time — force validation here first so the
// spread below picks up the full env (NODE_ENV, HOSPEDA_ALLOW_MOCK_ACTOR,
// etc. set by test/setup.ts) instead of only the two overridden keys.
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

import { initApp } from '../../../../src/app.js';
import { validateAndConsumeState } from '../../../../src/routes/integrations/mercadolibre-oauth/authorize.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';

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

describe('MercadoLibre OAuth authorize route (HOS-45 / SPEC-278 T-011)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/v1/admin/mercadolibre-oauth/authorize', () => {
        it('returns 401 without authentication', async () => {
            const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' },
                redirect: 'manual'
            });

            expect(res.status).toBe(401);
        });

        it('returns 403 for an admin actor without INTEGRATION_MERCADOLIBRE_MANAGE', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
                method: 'GET',
                headers: actorHeaders(actor),
                redirect: 'manual'
            });

            expect(res.status).toBe(403);
        });

        it('302-redirects to MercadoLibre with client_id, redirect_uri, and a state param', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);

            const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
                method: 'GET',
                headers: actorHeaders(actor),
                redirect: 'manual'
            });

            expect(res.status).toBe(302);

            const location = res.headers.get('location');
            expect(location).toBeTruthy();

            const redirectUrl = new URL(location as string);
            expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(
                'https://auth.mercadolibre.com.ar/authorization'
            );
            expect(redirectUrl.searchParams.get('response_type')).toBe('code');
            expect(redirectUrl.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
            expect(redirectUrl.searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);

            const state = redirectUrl.searchParams.get('state');
            expect(state).toBeTruthy();
            expect((state as string).length).toBeGreaterThanOrEqual(32);
        });
    });

    describe('validateAndConsumeState', () => {
        it('returns true for a freshly generated state and false when replayed', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);

            const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
                method: 'GET',
                headers: actorHeaders(actor),
                redirect: 'manual'
            });
            const location = res.headers.get('location') as string;
            const state = new URL(location).searchParams.get('state') as string;

            expect(validateAndConsumeState(state)).toBe(true);
            // One-time use: replaying the same state must fail.
            expect(validateAndConsumeState(state)).toBe(false);
        });

        it('returns false for an unknown state', () => {
            expect(validateAndConsumeState('never-issued-state-value')).toBe(false);
        });

        it('returns false for an expired state', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);

            const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
                method: 'GET',
                headers: actorHeaders(actor),
                redirect: 'manual'
            });
            const location = res.headers.get('location') as string;
            const state = new URL(location).searchParams.get('state') as string;

            // Advance the clock past the 5-minute TTL without mocking Hono's own
            // timer usage (only Date.now is stubbed, not the full fake-timer suite).
            const nowSpy = vi
                .spyOn(Date, 'now')
                .mockReturnValue(Date.now() + 5 * 60 * 1000 + 1_000);
            try {
                expect(validateAndConsumeState(state)).toBe(false);
            } finally {
                nowSpy.mockRestore();
            }
        });
    });
});
