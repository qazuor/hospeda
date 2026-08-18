/**
 * MercadoLibre OAuth Client Tests (HOS-45 T-006)
 *
 * Unit tests for `exchangeAuthorizationCode` and `refreshAccessToken`.
 *
 * Mocked collaborators:
 * - `../../src/utils/env` — controlled `env.HOSPEDA_MERCADOLIBRE_CLIENT_ID` / `_CLIENT_SECRET`
 * - `global.fetch` — outbound HTTP call to `https://api.mercadolibre.com/oauth/token`
 *
 * Scenarios covered (AAA pattern):
 * 1. exchangeAuthorizationCode success: correct URL/method/body/headers, camelCase mapping.
 * 2. refreshAccessToken success: correct URL/method/body/headers, camelCase mapping.
 * 3. Non-2xx (400) response throws MLOAuthClientError with status + parsed body.
 * 4. 5xx response throws MLOAuthClientError with status.
 * 5. client_secret never appears in a thrown error's message (security regression).
 *
 * @module test/services/mercadolibre-oauth/ml-oauth-client
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    exchangeAuthorizationCode,
    MLOAuthClientError,
    refreshAccessToken
} from '../../../src/services/mercadolibre-oauth/ml-oauth-client.js';

// ---------------------------------------------------------------------------
// Controlled env mock
// ---------------------------------------------------------------------------

// Hoisted, like the fetch mock below, because the vi.mock() factory that
// consumes it is itself hoisted above every import. As a plain `const` this
// threw "Cannot access 'mockEnv' before initialization" the moment the module
// under test was imported statically — the previous `await import()` inside a
// hook only hid that by deferring evaluation until after this line had run.
const { mockEnv } = vi.hoisted(() => ({
    mockEnv: {
        HOSPEDA_MERCADOLIBRE_CLIENT_ID: 'test-client-id',
        HOSPEDA_MERCADOLIBRE_CLIENT_SECRET: 'super-secret-value-should-never-leak',
        NODE_ENV: 'test'
    } as Record<string, string | undefined>
}));

vi.mock('../../../src/utils/env.js', () => ({
    env: mockEnv
}));

// ---------------------------------------------------------------------------
// Hoisted fetch mock
// ---------------------------------------------------------------------------

const { mockFetch } = vi.hoisted(() => ({
    mockFetch: vi.fn()
}));

describe('ml-oauth-client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
    });

    const jsonResponse = (
        body: unknown,
        init?: { status?: number; ok?: boolean }
    ): Partial<Response> => ({
        ok: init?.ok ?? true,
        status: init?.status ?? 200,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body))
    });

    const SUCCESS_RAW_TOKEN = {
        access_token: 'APP_USR-access-token-123',
        refresh_token: 'TG-refresh-token-456',
        expires_in: 21600,
        token_type: 'bearer'
    };

    // -------------------------------------------------------------------------
    // exchangeAuthorizationCode
    // -------------------------------------------------------------------------

    describe('exchangeAuthorizationCode', () => {
        it('should POST form-encoded body with authorization_code grant and map response to camelCase', async () => {
            // Arrange
            mockFetch.mockResolvedValue(jsonResponse(SUCCESS_RAW_TOKEN));

            // Act
            const result = await exchangeAuthorizationCode({
                code: 'TG-auth-code-abc',
                redirectUri: 'https://api.hospeda.com.ar/callback'
            });

            // Assert
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://api.mercadolibre.com/oauth/token');
            expect(requestInit.method).toBe('POST');
            expect(requestInit.headers).toMatchObject({
                'Content-Type': 'application/x-www-form-urlencoded'
            });

            const sentBody = new URLSearchParams(requestInit.body as string);
            expect(sentBody.get('grant_type')).toBe('authorization_code');
            expect(sentBody.get('client_id')).toBe('test-client-id');
            expect(sentBody.get('client_secret')).toBe('super-secret-value-should-never-leak');
            expect(sentBody.get('code')).toBe('TG-auth-code-abc');
            expect(sentBody.get('redirect_uri')).toBe('https://api.hospeda.com.ar/callback');

            expect(result).toEqual({
                accessToken: 'APP_USR-access-token-123',
                refreshToken: 'TG-refresh-token-456',
                expiresIn: 21600,
                tokenType: 'bearer'
            });
        });
    });

    // -------------------------------------------------------------------------
    // refreshAccessToken
    // -------------------------------------------------------------------------

    describe('refreshAccessToken', () => {
        it('should POST form-encoded body with refresh_token grant and map response to camelCase', async () => {
            // Arrange
            mockFetch.mockResolvedValue(jsonResponse(SUCCESS_RAW_TOKEN));

            // Act
            const result = await refreshAccessToken({ refreshToken: 'TG-old-refresh-token' });

            // Assert
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://api.mercadolibre.com/oauth/token');
            expect(requestInit.method).toBe('POST');

            const sentBody = new URLSearchParams(requestInit.body as string);
            expect(sentBody.get('grant_type')).toBe('refresh_token');
            expect(sentBody.get('client_id')).toBe('test-client-id');
            expect(sentBody.get('client_secret')).toBe('super-secret-value-should-never-leak');
            expect(sentBody.get('refresh_token')).toBe('TG-old-refresh-token');

            expect(result).toEqual({
                accessToken: 'APP_USR-access-token-123',
                refreshToken: 'TG-refresh-token-456',
                expiresIn: 21600,
                tokenType: 'bearer'
            });
        });
    });

    // -------------------------------------------------------------------------
    // Error handling
    // -------------------------------------------------------------------------

    describe('error handling', () => {
        it('should throw MLOAuthClientError with status and parsed body on a 400 response', async () => {
            // Arrange
            const errorBody = { error: 'invalid_grant', error_description: 'expired code' };
            mockFetch.mockResolvedValue(jsonResponse(errorBody, { ok: false, status: 400 }));

            // Act & Assert
            await expect(
                exchangeAuthorizationCode({ code: 'bad-code', redirectUri: 'https://x.test' })
            ).rejects.toMatchObject({
                name: 'MLOAuthClientError',
                status: 400,
                body: errorBody
            });
        });

        it('should throw MLOAuthClientError on a 5xx response', async () => {
            // Arrange
            mockFetch.mockResolvedValue(
                jsonResponse({ error: 'internal_error' }, { ok: false, status: 502 })
            );

            // Act & Assert
            await expect(
                refreshAccessToken({ refreshToken: 'some-refresh-token' })
            ).rejects.toMatchObject({
                name: 'MLOAuthClientError',
                status: 502
            });
        });

        it('should be an instance of MLOAuthClientError', async () => {
            // Arrange
            mockFetch.mockResolvedValue(
                jsonResponse({ error: 'invalid_grant' }, { ok: false, status: 400 })
            );

            // Act
            let caught: unknown;
            try {
                await exchangeAuthorizationCode({
                    code: 'bad-code',
                    redirectUri: 'https://x.test'
                });
            } catch (error) {
                caught = error;
            }

            // Assert
            expect(caught).toBeInstanceOf(MLOAuthClientError);
        });

        it('should never leak client_secret in the thrown error message', async () => {
            // Arrange
            const secret = mockEnv.HOSPEDA_MERCADOLIBRE_CLIENT_SECRET as string;
            mockFetch.mockResolvedValue(
                jsonResponse({ error: 'invalid_client' }, { ok: false, status: 401 })
            );

            // Act
            let caught: unknown;
            try {
                await exchangeAuthorizationCode({
                    code: 'any-code',
                    redirectUri: 'https://x.test'
                });
            } catch (error) {
                caught = error;
            }

            // Assert
            expect(caught).toBeInstanceOf(Error);
            expect((caught as Error).message).not.toContain(secret);
        });
    });
});
