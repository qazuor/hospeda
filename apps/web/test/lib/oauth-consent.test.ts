/**
 * @file oauth-consent.test.ts
 * @description Tests for the OAuth consent helpers (HOS-2184 T-027).
 */

import { describe, expect, it } from 'vitest';
import {
    buildConsentResumePath,
    buildConsentSigninUrl,
    buildSignedOAuthQuery,
    isFollowableRedirectUrl,
    isSignedOAuthRequest,
    parseConsentRequest,
    toKnownOAuthScope,
    toSafeHttpsUrl
} from '@/lib/oauth-consent';

/** Query the API appends: signed parameters plus noise that is not signed. */
const SIGNED_SEARCH =
    '?client_id=abc&scope=openid+email+offline_access&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb' +
    '&state=xyz&exp=1900000000&ba_iat=1&ba_param=client_id&ba_param=scope&ba_param=redirect_uri' +
    '&ba_param=state&ba_param=exp&ba_param=ba_iat&ba_param=ba_param&sig=SIGNATURE&utm_source=x';

describe('buildSignedOAuthQuery', () => {
    it('keeps the signature, the name list and exactly the signed parameters', () => {
        // Arrange / Act
        const query = buildSignedOAuthQuery({ search: SIGNED_SEARCH });
        const params = new URLSearchParams(query ?? '');

        // Assert
        expect(params.get('sig')).toBe('SIGNATURE');
        expect(params.get('client_id')).toBe('abc');
        expect(params.get('utm_source')).toBeNull();
        expect(params.getAll('ba_param')).toHaveLength(7);
    });

    it('returns null when the request has no signature or no signed-name list', () => {
        expect(buildSignedOAuthQuery({ search: '?client_id=abc' })).toBeNull();
        expect(buildSignedOAuthQuery({ search: '?client_id=abc&sig=s' })).toBeNull();
    });
});

describe('parseConsentRequest', () => {
    it('returns client id, de-duplicated scopes and the signed query', () => {
        // Arrange / Act
        const parsed = parseConsentRequest({ search: `${SIGNED_SEARCH}&scope=openid` });

        // Assert
        expect(parsed?.clientId).toBe('abc');
        expect(parsed?.oauthQuery).toContain('sig=SIGNATURE');
    });

    it('splits the scope parameter on whitespace', () => {
        expect(parseConsentRequest({ search: SIGNED_SEARCH })?.scopes).toEqual([
            'openid',
            'email',
            'offline_access'
        ]);
    });

    it('returns null without client_id or without a signed request', () => {
        expect(parseConsentRequest({ search: '' })).toBeNull();
        expect(parseConsentRequest({ search: '?scope=openid' })).toBeNull();
        expect(parseConsentRequest({ search: '?client_id=abc' })).toBeNull();
    });
});

describe('isSignedOAuthRequest', () => {
    it('is true only for the shape the provider appends', () => {
        expect(isSignedOAuthRequest({ search: SIGNED_SEARCH })).toBe(true);
        expect(isSignedOAuthRequest({ search: '?returnUrl=/es/mi-cuenta/' })).toBe(false);
        expect(isSignedOAuthRequest({ search: '?client_id=abc&sig=s' })).toBe(false);
    });
});

describe('buildConsentResumePath / buildConsentSigninUrl', () => {
    it('points at the consent page of the locale with the query intact', () => {
        expect(buildConsentResumePath({ locale: 'es', search: '?client_id=abc&sig=s' })).toBe(
            '/es/auth/consent/?client_id=abc&sig=s'
        );
    });

    it('wraps the resume path in an encoded returnUrl on the sign-in page', () => {
        // Arrange / Act
        const url = buildConsentSigninUrl({ locale: 'en', search: '?client_id=abc&sig=s' });

        // Assert
        expect(url.startsWith('/en/auth/signin/?returnUrl=')).toBe(true);
        const returnUrl = new URL(url, 'https://hospeda.test').searchParams.get('returnUrl');
        expect(returnUrl).toBe('/en/auth/consent/?client_id=abc&sig=s');
    });
});

describe('toSafeHttpsUrl', () => {
    it('accepts a plain https URL', () => {
        expect(toSafeHttpsUrl({ raw: 'https://claude.ai/logo.png' })).toBe(
            'https://claude.ai/logo.png'
        );
    });

    it.each([
        'http://claude.ai/logo.png',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        'https://user:pass@claude.ai/',
        'not a url',
        ''
    ])('rejects %s', (raw) => {
        expect(toSafeHttpsUrl({ raw })).toBeNull();
    });

    it('rejects non-string values', () => {
        expect(toSafeHttpsUrl({ raw: undefined })).toBeNull();
        expect(toSafeHttpsUrl({ raw: 42 })).toBeNull();
    });
});

describe('isFollowableRedirectUrl', () => {
    it('allows http(s) and loopback targets', () => {
        expect(isFollowableRedirectUrl({ raw: 'https://claude.ai/cb?code=1' })).toBe(true);
        expect(isFollowableRedirectUrl({ raw: 'http://127.0.0.1:5000/cb?code=1' })).toBe(true);
    });

    it.each([
        'javascript:alert(1)',
        'data:text/html,x',
        'vbscript:x',
        '',
        undefined
    ])('blocks %s', (raw) => {
        expect(isFollowableRedirectUrl({ raw })).toBe(false);
    });
});

describe('toKnownOAuthScope', () => {
    it('knows the four provider scopes and nothing else', () => {
        expect(toKnownOAuthScope({ scope: 'offline_access' })).toBe('offline_access');
        expect(toKnownOAuthScope({ scope: 'admin' })).toBeNull();
    });
});
