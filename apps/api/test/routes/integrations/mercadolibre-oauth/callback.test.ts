import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { TEST_CLIENT_ID, TEST_REDIRECT_URI } = vi.hoisted(() => ({
    TEST_CLIENT_ID: 'test-ml-client-id',
    TEST_REDIRECT_URI: 'https://api.hospeda.com.ar/api/v1/admin/mercadolibre-oauth/callback'
}));

// Use importOriginal so every other export (validateApiEnv, getEnv, etc.) is
// preserved; only the two MercadoLibre OAuth env vars are overridden with
// deterministic test values, mirroring authorize.test.ts.
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

const { mockExchangeAuthorizationCode, mockUpsertMLCredential, MockMLOAuthClientError } =
    vi.hoisted(() => {
        class HoistedMockMLOAuthClientError extends Error {
            public readonly status: number;
            public readonly body?: Record<string, unknown>;

            constructor(message: string, status: number, body?: Record<string, unknown>) {
                super(message);
                this.name = 'MLOAuthClientError';
                this.status = status;
                this.body = body;
            }
        }

        return {
            mockExchangeAuthorizationCode: vi.fn(),
            mockUpsertMLCredential: vi.fn(),
            MockMLOAuthClientError: HoistedMockMLOAuthClientError
        };
    });

vi.mock('../../../../src/services/mercadolibre-oauth/ml-oauth-client.js', () => ({
    exchangeAuthorizationCode: mockExchangeAuthorizationCode,
    MLOAuthClientError: MockMLOAuthClientError
}));

vi.mock('../../../../src/services/mercadolibre-oauth/ml-credential.repository.js', () => ({
    upsertMLCredential: mockUpsertMLCredential
}));

import { initApp } from '../../../../src/app.js';
import { validateAndConsumeState } from '../../../../src/routes/integrations/mercadolibre-oauth/authorize.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const USER_ID = '44444444-4444-4444-8444-444444444444';

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

/** Obtains a freshly-generated, not-yet-consumed OAuth state by hitting the authorize route. */
async function issueFreshState(app: AppOpenAPI, actor: Actor): Promise<string> {
    const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
        method: 'GET',
        headers: actorHeaders(actor),
        redirect: 'manual'
    });
    const location = res.headers.get('location') as string;
    return new URL(location).searchParams.get('state') as string;
}

describe('MercadoLibre OAuth callback route (HOS-45 / SPEC-278 T-012)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/v1/admin/mercadolibre-oauth/callback', () => {
        it('returns 401 without authentication', async () => {
            const res = await app.request(
                '/api/v1/admin/mercadolibre-oauth/callback?code=some-code&state=some-state',
                {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                }
            );

            expect(res.status).toBe(401);
        });

        it('returns 403 for an admin actor without INTEGRATION_MERCADOLIBRE_MANAGE', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request(
                '/api/v1/admin/mercadolibre-oauth/callback?code=some-code&state=some-state',
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

            expect(res.status).toBe(403);
        });

        it('returns 400 for an invalid/unknown state and never attempts the token exchange', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);

            const res = await app.request(
                '/api/v1/admin/mercadolibre-oauth/callback?code=some-code&state=never-issued-state',
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

            expect(res.status).toBe(400);
            expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled();
            expect(mockUpsertMLCredential).not.toHaveBeenCalled();
        });

        it('returns 200 with no secrets on a successful exchange and persists the credential', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);
            const state = await issueFreshState(app, actor);

            const expiresIn = 21600; // 6 hours, in seconds
            mockExchangeAuthorizationCode.mockResolvedValueOnce({
                accessToken: 'secret-access-token',
                refreshToken: 'secret-refresh-token',
                expiresIn,
                tokenType: 'bearer'
            });
            mockUpsertMLCredential.mockResolvedValueOnce(undefined);

            const beforeCall = Date.now();
            const res = await app.request(
                `/api/v1/admin/mercadolibre-oauth/callback?code=auth-code-123&state=${state}`,
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

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
                code: 'auth-code-123',
                redirectUri: TEST_REDIRECT_URI
            });

            expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
            const upsertArg = mockUpsertMLCredential.mock.calls[0]?.[0];
            expect(upsertArg.accessToken).toBe('secret-access-token');
            expect(upsertArg.refreshToken).toBe('secret-refresh-token');
            expect(upsertArg.expiresAt).toBeInstanceOf(Date);

            const expectedExpiresAtMs = beforeCall + expiresIn * 1000;
            const toleranceMs = 5_000;
            expect(
                Math.abs(upsertArg.expiresAt.getTime() - expectedExpiresAtMs)
            ).toBeLessThanOrEqual(toleranceMs);

            // The state must have been consumed by the successful call too.
            expect(validateAndConsumeState(state)).toBe(false);
        });

        it('propagates the exchange error as a non-2xx response without persisting a credential', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);
            const state = await issueFreshState(app, actor);

            mockExchangeAuthorizationCode.mockRejectedValueOnce(
                new MockMLOAuthClientError(
                    'MercadoLibre OAuth token request failed with status 400',
                    400
                )
            );

            const res = await app.request(
                `/api/v1/admin/mercadolibre-oauth/callback?code=bad-code&state=${state}`,
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(mockUpsertMLCredential).not.toHaveBeenCalled();
        });

        it('returns 503 when HOSPEDA_MERCADOLIBRE_REDIRECT_URI is unset and never attempts the exchange', async () => {
            const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);
            const state = await issueFreshState(app, actor);

            const envModule = await import('../../../../src/utils/env.js');
            const originalRedirectUri = envModule.env.HOSPEDA_MERCADOLIBRE_REDIRECT_URI;
            envModule.env.HOSPEDA_MERCADOLIBRE_REDIRECT_URI = undefined;

            try {
                const res = await app.request(
                    `/api/v1/admin/mercadolibre-oauth/callback?code=some-code&state=${state}`,
                    {
                        method: 'GET',
                        headers: actorHeaders(actor)
                    }
                );

                expect(res.status).toBe(503);
                expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled();
                expect(mockUpsertMLCredential).not.toHaveBeenCalled();
            } finally {
                envModule.env.HOSPEDA_MERCADOLIBRE_REDIRECT_URI = originalRedirectUri;
            }
        });
    });
});
