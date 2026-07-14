/**
 * Google Calendar OAuth Client Tests (HOS-157 Phase 2 — Layer 2)
 *
 * Unit tests for `exchangeAuthorizationCode` and `refreshAccessToken`.
 *
 * Mocked collaborators:
 * - `../../../src/utils/env.js` — controlled `env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID` / `_CLIENT_SECRET`
 * - `global.fetch` — outbound HTTP call to `https://oauth2.googleapis.com/token`
 *
 * Scenarios covered (AAA pattern):
 * 1. exchangeAuthorizationCode success: correct URL/method/body/headers, camelCase
 *    mapping including refreshToken + scope.
 * 2. refreshAccessToken success: correct URL/method/body/headers; the response
 *    OMITS refresh_token (Google-specific) so the mapped result has no refreshToken.
 * 3. Non-2xx (400) response throws GoogleOAuthClientError with status + parsed body.
 * 4. 5xx response throws GoogleOAuthClientError with status.
 * 5. client_secret never appears in a thrown error's message (security regression).
 *
 * @module test/services/google-calendar/google-oauth-client
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Controlled env mock
// ---------------------------------------------------------------------------

const mockEnv: Record<string, string | undefined> = {
    HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID: 'test-google-client-id',
    HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET: 'super-secret-google-value-should-never-leak',
    NODE_ENV: 'test'
};

vi.mock('../../../src/utils/env.js', () => ({
    env: mockEnv
}));

// ---------------------------------------------------------------------------
// Hoisted fetch mock
// ---------------------------------------------------------------------------

const { mockFetch } = vi.hoisted(() => ({
    mockFetch: vi.fn()
}));

describe('google-oauth-client', () => {
    let exchangeAuthorizationCode: typeof import('../../../src/services/google-calendar/google-oauth-client.js').exchangeAuthorizationCode;
    let refreshAccessToken: typeof import('../../../src/services/google-calendar/google-oauth-client.js').refreshAccessToken;
    let GoogleOAuthClientError: typeof import('../../../src/services/google-calendar/google-oauth-client.js').GoogleOAuthClientError;

    beforeEach(async () => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        ({ exchangeAuthorizationCode, refreshAccessToken, GoogleOAuthClientError } = await import(
            '../../../src/services/google-calendar/google-oauth-client.js'
        ));
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

    const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

    const EXCHANGE_RAW_TOKEN = {
        access_token: 'ya29.access-token-123',
        refresh_token: '1//refresh-token-456',
        expires_in: 3599,
        token_type: 'Bearer',
        scope: CALENDAR_SCOPE
    };

    // Google's refresh grant response deliberately OMITS refresh_token.
    const REFRESH_RAW_TOKEN = {
        access_token: 'ya29.new-access-token-789',
        expires_in: 3599,
        token_type: 'Bearer',
        scope: CALENDAR_SCOPE
    };

    // -------------------------------------------------------------------------
    // exchangeAuthorizationCode
    // -------------------------------------------------------------------------

    describe('exchangeAuthorizationCode', () => {
        it('should POST form-encoded body with authorization_code grant and map response to camelCase including refreshToken and scope', async () => {
            // Arrange
            mockFetch.mockResolvedValue(jsonResponse(EXCHANGE_RAW_TOKEN));

            // Act
            const result = await exchangeAuthorizationCode({
                code: '4/0Ab-auth-code',
                redirectUri: 'https://api.hospeda.com.ar/callback'
            });

            // Assert
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://oauth2.googleapis.com/token');
            expect(requestInit.method).toBe('POST');
            expect(requestInit.headers).toMatchObject({
                'Content-Type': 'application/x-www-form-urlencoded'
            });

            const sentBody = new URLSearchParams(requestInit.body as string);
            expect(sentBody.get('grant_type')).toBe('authorization_code');
            expect(sentBody.get('client_id')).toBe('test-google-client-id');
            expect(sentBody.get('client_secret')).toBe(
                'super-secret-google-value-should-never-leak'
            );
            expect(sentBody.get('code')).toBe('4/0Ab-auth-code');
            expect(sentBody.get('redirect_uri')).toBe('https://api.hospeda.com.ar/callback');

            expect(result).toEqual({
                accessToken: 'ya29.access-token-123',
                refreshToken: '1//refresh-token-456',
                expiresIn: 3599,
                tokenType: 'Bearer',
                scope: CALENDAR_SCOPE
            });
        });
    });

    // -------------------------------------------------------------------------
    // refreshAccessToken
    // -------------------------------------------------------------------------

    describe('refreshAccessToken', () => {
        it('should POST refresh_token grant and map response WITHOUT a refreshToken (Google omits it)', async () => {
            // Arrange
            mockFetch.mockResolvedValue(jsonResponse(REFRESH_RAW_TOKEN));

            // Act
            const result = await refreshAccessToken({ refreshToken: '1//old-refresh-token' });

            // Assert
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://oauth2.googleapis.com/token');
            expect(requestInit.method).toBe('POST');

            const sentBody = new URLSearchParams(requestInit.body as string);
            expect(sentBody.get('grant_type')).toBe('refresh_token');
            expect(sentBody.get('client_id')).toBe('test-google-client-id');
            expect(sentBody.get('client_secret')).toBe(
                'super-secret-google-value-should-never-leak'
            );
            expect(sentBody.get('refresh_token')).toBe('1//old-refresh-token');

            expect(result).toEqual({
                accessToken: 'ya29.new-access-token-789',
                expiresIn: 3599,
                tokenType: 'Bearer',
                scope: CALENDAR_SCOPE
            });
            // Explicit: the refresh grant carries no refresh token.
            expect(result.refreshToken).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // Error handling
    // -------------------------------------------------------------------------

    describe('error handling', () => {
        it('should throw GoogleOAuthClientError with status and parsed body on a 400 response', async () => {
            // Arrange
            const errorBody = { error: 'invalid_grant', error_description: 'expired code' };
            mockFetch.mockResolvedValue(jsonResponse(errorBody, { ok: false, status: 400 }));

            // Act & Assert
            await expect(
                exchangeAuthorizationCode({ code: 'bad-code', redirectUri: 'https://x.test' })
            ).rejects.toMatchObject({
                name: 'GoogleOAuthClientError',
                status: 400,
                body: errorBody
            });
        });

        it('should throw GoogleOAuthClientError on a 5xx response', async () => {
            // Arrange
            mockFetch.mockResolvedValue(
                jsonResponse({ error: 'internal_error' }, { ok: false, status: 502 })
            );

            // Act & Assert
            await expect(
                refreshAccessToken({ refreshToken: 'some-refresh-token' })
            ).rejects.toMatchObject({
                name: 'GoogleOAuthClientError',
                status: 502
            });
        });

        it('should be an instance of GoogleOAuthClientError', async () => {
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
            expect(caught).toBeInstanceOf(GoogleOAuthClientError);
        });

        it('should never leak client_secret in the thrown error message', async () => {
            // Arrange
            const secret = mockEnv.HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET as string;
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
