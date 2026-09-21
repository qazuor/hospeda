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
import {
    exchangeAuthorizationCode,
    GoogleOAuthClientError,
    refreshAccessToken,
    revokeToken
} from '../../../src/services/google-calendar/google-oauth-client.js';

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
        HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID: 'test-google-client-id',
        HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET: 'super-secret-google-value-should-never-leak',
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

describe('google-oauth-client', () => {
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

    // -------------------------------------------------------------------------
    // revokeToken (HOS-663)
    //
    // This is the function that actually ends the platform's access to a host's
    // calendar, and nothing exercised it: the adapter's own tests mock it away,
    // so they verify WHICH token it is handed and nothing about what it does
    // with it. A mutation moving the token onto the query string with a GET
    // passed the whole suite.
    //
    // Two properties are pinned here, because they are the two a refactor gets
    // wrong:
    //   - the token travels in the POST body, NEVER in the URL. A refresh token
    //     in a URL lands in undici's access log, in any outbound proxy, and in
    //     a Sentry breadcrumb the moment somebody instruments fetch.
    //   - ANY non-2xx is a failure. A 403 is Google refusing; counting it as
    //     success because it is not a 5xx reports a wide-open grant as closed.
    // -------------------------------------------------------------------------

    describe('revokeToken', () => {
        const REFRESH_TOKEN = '1//refresh-token-to-revoke';

        /** Google answers 200 with an empty body on a successful revocation. */
        const emptyOkResponse = (): Partial<Response> => ({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('')
        });

        it('should POST the token in the form-encoded BODY and never in the URL', async () => {
            // Arrange
            mockFetch.mockResolvedValue(emptyOkResponse());

            // Act
            await revokeToken({ token: REFRESH_TOKEN });

            // Assert
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];

            expect(url).toBe('https://oauth2.googleapis.com/revoke');
            // Asserted against the raw string so a `?token=` anywhere fails,
            // not only a well-formed one.
            expect(url).not.toContain('?');
            expect(url).not.toContain(REFRESH_TOKEN);
            expect(url).not.toContain(encodeURIComponent(REFRESH_TOKEN));

            expect(requestInit.method).toBe('POST');
            expect((requestInit.headers as Record<string, string>)['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(requestInit.body).toBe(`token=${encodeURIComponent(REFRESH_TOKEN)}`);
        });

        it('should bound the request with an abort signal', async () => {
            // A revocation sits on the synchronous path of a user's DELETE; an
            // unbounded fetch to a half-dead Google becomes a Cloudflare 524.
            // Arrange
            mockFetch.mockResolvedValue(emptyOkResponse());

            // Act
            await revokeToken({ token: REFRESH_TOKEN });

            // Assert
            const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(requestInit.signal).toBeInstanceOf(AbortSignal);
        });

        it('should resolve when Google answers 200', async () => {
            // Arrange
            mockFetch.mockResolvedValue(emptyOkResponse());

            // Act + Assert
            await expect(revokeToken({ token: REFRESH_TOKEN })).resolves.toBeUndefined();
        });

        it.each([
            [400, { error: 'invalid_token' }],
            [401, { error: 'invalid_client' }],
            [403, { error: 'forbidden' }],
            [429, { error: 'rate_limit_exceeded' }],
            [500, { error: 'internal' }],
            [503, { error: 'unavailable' }]
        ])('should throw GoogleOAuthClientError on %i', async (status, body) => {
            // Arrange
            mockFetch.mockResolvedValue(jsonResponse(body, { ok: false, status }));

            // Act
            let caught: unknown;
            try {
                await revokeToken({ token: REFRESH_TOKEN });
            } catch (error) {
                caught = error;
            }

            // Assert
            expect(caught).toBeInstanceOf(GoogleOAuthClientError);
            expect((caught as GoogleOAuthClientError).status).toBe(status);
            expect((caught as GoogleOAuthClientError).body).toEqual(body);
        });

        it('should attach the parsed body so the caller can recognise invalid_token', async () => {
            // The adapter maps `invalid_token` to "already closed"; that mapping
            // is only possible if the body survives the throw.
            // Arrange
            mockFetch.mockResolvedValue(
                jsonResponse({ error: 'invalid_token' }, { ok: false, status: 400 })
            );

            // Act
            let caught: unknown;
            try {
                await revokeToken({ token: REFRESH_TOKEN });
            } catch (error) {
                caught = error;
            }

            // Assert
            expect((caught as GoogleOAuthClientError).body?.error).toBe('invalid_token');
        });

        it('should never leak the token into the thrown error message', async () => {
            // Arrange
            mockFetch.mockResolvedValue(
                jsonResponse({ error: 'invalid_token' }, { ok: false, status: 400 })
            );

            // Act
            let caught: unknown;
            try {
                await revokeToken({ token: REFRESH_TOKEN });
            } catch (error) {
                caught = error;
            }

            // Assert
            expect((caught as Error).message).not.toContain(REFRESH_TOKEN);
            expect((caught as Error).message).toContain('400');
        });

        it('should not send client credentials — the token identifies the grant', async () => {
            // Arrange
            mockFetch.mockResolvedValue(emptyOkResponse());

            // Act
            await revokeToken({ token: REFRESH_TOKEN });

            // Assert
            const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
            const body = requestInit.body as string;
            expect(body).not.toContain('client_secret');
            expect(body).not.toContain(mockEnv.HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET as string);
        });
    });
});
