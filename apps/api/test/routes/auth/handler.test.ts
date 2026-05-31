/**
 * @file handler.test.ts
 * @description Tests for the Better Auth handler wrapper — specifically the
 * SPEC-120 OAuth error observability layer.
 *
 * Covers two pure helpers that together implement the observation logic:
 *   1. `extractOAuthErrorFromCallback` — pattern match + parse.
 *   2. `maybeObserveOAuthFailure` — orchestration (Sentry + Location rewrite).
 *
 * Both are exported from `handler.ts` so the test can exercise the full
 * observation contract without bringing up the Hono app or Better Auth.
 *
 * @module test/routes/auth/handler
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCaptureMessage } = vi.hoisted(() => ({
    mockCaptureMessage: vi.fn().mockReturnValue('event-id-test')
}));

vi.mock('../../../src/lib/sentry', () => ({
    Sentry: {
        captureMessage: mockCaptureMessage
    }
}));

// Import AFTER mocks so the module picks them up.
import {
    extractOAuthErrorFromCallback,
    maybeObserveOAuthFailure
} from '../../../src/routes/auth/handler';

/**
 * Test helpers — build canonical fixtures matching the real traffic
 * captured in the SPEC-120 Phase 0 catalog (`.qtm/specs/SPEC-120-...`).
 */
function buildGoogleCancelFixture() {
    return {
        requestUrl: new URL(
            'https://staging-api.hospeda.com.ar/api/auth/callback/google?error=access_denied&state=AIM8S7JOQ'
        ),
        response: new Response(null, {
            status: 302,
            headers: {
                Location: 'https://staging.hospeda.com.ar/es/auth/signin/?error=access_denied',
                'x-request-id': 'req-google-1'
            }
        })
    };
}

function buildFacebookCancelFixture() {
    return {
        requestUrl: new URL(
            'https://staging-api.hospeda.com.ar/api/auth/callback/facebook?error=access_denied&error_code=200&error_description=Permissions+error&error_reason=user_denied&state=rvw81'
        ),
        response: new Response(null, {
            status: 302,
            headers: {
                Location:
                    'https://staging.hospeda.com.ar/es/auth/signin/?error=access_denied&error_description=Permissions+error',
                'x-request-id': 'req-fb-1'
            }
        })
    };
}

describe('extractOAuthErrorFromCallback', () => {
    it('returns null when the response is not a 302', () => {
        const result = extractOAuthErrorFromCallback({
            requestUrl: new URL('https://api/callback/google?error=access_denied'),
            response: new Response(null, { status: 200 })
        });
        expect(result).toBeNull();
    });

    it('returns null when the request path does not match /callback/<provider>', () => {
        const result = extractOAuthErrorFromCallback({
            requestUrl: new URL('https://api/sign-in/email'),
            response: new Response(null, {
                status: 302,
                headers: { Location: 'https://web/signin?error=foo' }
            })
        });
        expect(result).toBeNull();
    });

    it('returns null when the Location header is missing', () => {
        const result = extractOAuthErrorFromCallback({
            requestUrl: new URL('https://api/callback/google'),
            response: new Response(null, { status: 302 })
        });
        expect(result).toBeNull();
    });

    it('returns null when the Location header is malformed', () => {
        const result = extractOAuthErrorFromCallback({
            requestUrl: new URL('https://api/callback/google'),
            response: new Response(null, {
                status: 302,
                headers: { Location: 'not-a-valid-url' }
            })
        });
        expect(result).toBeNull();
    });

    it('returns null when the Location has no ?error= param (happy path)', () => {
        const result = extractOAuthErrorFromCallback({
            requestUrl: new URL('https://api/callback/google?code=abc&state=xyz'),
            response: new Response(null, {
                status: 302,
                headers: { Location: 'https://web/dashboard' }
            })
        });
        expect(result).toBeNull();
    });

    it('extracts Google access_denied with no error_description', () => {
        const result = extractOAuthErrorFromCallback(buildGoogleCancelFixture());
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('google');
        expect(result?.errorCode).toBe('access_denied');
        expect(result?.errorCodeRaw).toBe('access_denied');
        expect(result?.errorDescription).toBeUndefined();
    });

    it('extracts Facebook access_denied with error_description', () => {
        const result = extractOAuthErrorFromCallback(buildFacebookCancelFixture());
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('facebook');
        expect(result?.errorCode).toBe('access_denied');
        // URL-decoded from `Permissions+error` to `Permissions error`.
        expect(result?.errorDescription).toBe('Permissions error');
    });

    it('strips the `state` param from providerRawQuery (noise reduction)', () => {
        const result = extractOAuthErrorFromCallback(buildGoogleCancelFixture());
        expect(result?.providerRawQuery).toEqual({ error: 'access_denied' });
        expect(result?.providerRawQuery.state).toBeUndefined();
    });

    it('preserves provider-specific params (error_code, error_reason) in providerRawQuery', () => {
        const result = extractOAuthErrorFromCallback(buildFacebookCancelFixture());
        expect(result?.providerRawQuery).toMatchObject({
            error: 'access_denied',
            error_code: '200',
            error_description: 'Permissions error',
            error_reason: 'user_denied'
        });
        expect(result?.providerRawQuery.state).toBeUndefined();
    });

    it('captures the filtered redirect query (what Better Auth re-emits)', () => {
        const result = extractOAuthErrorFromCallback(buildFacebookCancelFixture());
        expect(result?.redirectQuery).toEqual({
            error: 'access_denied',
            error_description: 'Permissions error'
        });
    });

    it('sanitizes invalid error codes to "unknown"', () => {
        const result = extractOAuthErrorFromCallback({
            requestUrl: new URL('https://api/callback/google?error=%3Cscript%3E'),
            response: new Response(null, {
                status: 302,
                headers: {
                    Location: 'https://web/signin?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E'
                }
            })
        });
        expect(result?.errorCode).toBe('unknown');
        // The raw value is preserved (will not be used as a Sentry tag, only
        // as a forensic field in `extra`).
        expect(result?.errorCodeRaw).toBe('<script>alert(1)</script>');
    });

    it('accepts all standard RFC 6749 §4.1.2.1 codes (snake_case, lowercase)', () => {
        const codes = [
            'access_denied',
            'invalid_request',
            'unauthorized_client',
            'unsupported_response_type',
            'invalid_scope',
            'server_error',
            'temporarily_unavailable',
            'redirect_uri_mismatch'
        ];
        for (const code of codes) {
            const result = extractOAuthErrorFromCallback({
                requestUrl: new URL(`https://api/callback/google?error=${code}`),
                response: new Response(null, {
                    status: 302,
                    headers: { Location: `https://web/signin?error=${code}` }
                })
            });
            expect(result?.errorCode).toBe(code);
        }
    });
});

describe('maybeObserveOAuthFailure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('captures Sentry warning for access_denied (user cancel)', () => {
        maybeObserveOAuthFailure({
            requestUrl: new URL(
                'https://api.example/api/auth/callback/google?error=access_denied&state=abc'
            ),
            userAgent: 'TestAgent/1.0',
            response: new Response(null, {
                status: 302,
                headers: {
                    Location: 'https://web.example/es/auth/signin/?error=access_denied',
                    'x-request-id': 'req-warn-1'
                }
            })
        });

        expect(mockCaptureMessage).toHaveBeenCalledOnce();
        const [message, options] = mockCaptureMessage.mock.calls[0] ?? [];
        expect(message).toBe('OAuth google signin failed: access_denied');
        expect(options?.level).toBe('warning');
        expect(options?.tags).toMatchObject({
            module: 'auth.oauth',
            provider: 'google',
            error_code: 'access_denied'
        });
        expect(options?.extra).toMatchObject({
            error_code_raw: 'access_denied',
            request_id: 'req-warn-1',
            user_agent: 'TestAgent/1.0'
        });
    });

    it('captures Sentry error level for non-cancel codes (e.g. server_error)', () => {
        maybeObserveOAuthFailure({
            requestUrl: new URL('https://api.example/api/auth/callback/google?error=server_error'),
            userAgent: undefined,
            response: new Response(null, {
                status: 302,
                headers: { Location: 'https://web.example/es/auth/signin/?error=server_error' }
            })
        });

        expect(mockCaptureMessage).toHaveBeenCalledOnce();
        const [, options] = mockCaptureMessage.mock.calls[0] ?? [];
        expect(options?.level).toBe('error');
    });

    it('rewrites the Location header to inject &provider=<name>', () => {
        const res = maybeObserveOAuthFailure({
            requestUrl: new URL(
                'https://api.example/api/auth/callback/facebook?error=access_denied'
            ),
            userAgent: undefined,
            response: new Response(null, {
                status: 302,
                headers: {
                    Location: 'https://web.example/es/auth/signin/?error=access_denied'
                }
            })
        });

        const location = res.headers.get('Location');
        expect(location).not.toBeNull();
        const url = new URL(location as string);
        expect(url.searchParams.get('provider')).toBe('facebook');
        // Other query params survive the rewrite.
        expect(url.searchParams.get('error')).toBe('access_denied');
    });

    it('is idempotent: does not double-stamp provider if already present', () => {
        const res = maybeObserveOAuthFailure({
            requestUrl: new URL('https://api.example/api/auth/callback/google?error=access_denied'),
            userAgent: undefined,
            response: new Response(null, {
                status: 302,
                headers: {
                    Location:
                        'https://web.example/es/auth/signin/?error=access_denied&provider=preset'
                }
            })
        });

        const location = res.headers.get('Location');
        const url = new URL(location as string);
        // The preset value wins — no clobber.
        expect(url.searchParams.get('provider')).toBe('preset');
        // And we only have one `provider` param, not two.
        const allProviders = url.searchParams.getAll('provider');
        expect(allProviders).toHaveLength(1);
    });

    it('passes successful (non-302) callback responses through unchanged', async () => {
        const originalBody = '{"ok":true}';
        const res = maybeObserveOAuthFailure({
            requestUrl: new URL('https://api.example/api/auth/callback/google?code=abc&state=xyz'),
            userAgent: undefined,
            response: new Response(originalBody, {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        });

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(originalBody);
        expect(mockCaptureMessage).not.toHaveBeenCalled();
    });

    it('does not capture or rewrite for non-callback paths', () => {
        const res = maybeObserveOAuthFailure({
            requestUrl: new URL('https://api.example/api/auth/sign-out'),
            userAgent: undefined,
            response: new Response(null, {
                status: 302,
                headers: { Location: 'https://web.example/some-other-redirect?error=foo' }
            })
        });

        expect(mockCaptureMessage).not.toHaveBeenCalled();
        // Returns the original response unchanged.
        expect(res.headers.get('Location')).toBe(
            'https://web.example/some-other-redirect?error=foo'
        );
    });

    it('includes provider_raw_query with all callback params except state', () => {
        maybeObserveOAuthFailure({
            requestUrl: new URL(
                'https://api.example/api/auth/callback/facebook?error=access_denied&error_code=200&error_description=Permissions+error&error_reason=user_denied&state=nonce'
            ),
            userAgent: 'TestAgent/2.0',
            response: new Response(null, {
                status: 302,
                headers: {
                    Location:
                        'https://web.example/es/auth/signin/?error=access_denied&error_description=Permissions+error'
                }
            })
        });

        const [, options] = mockCaptureMessage.mock.calls[0] ?? [];
        expect(options?.extra?.provider_raw_query).toMatchObject({
            error: 'access_denied',
            error_code: '200',
            error_description: 'Permissions error',
            error_reason: 'user_denied'
        });
        expect(options?.extra?.provider_raw_query?.state).toBeUndefined();
    });
});
