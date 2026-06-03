/**
 * @file auth-callback.test.ts
 * @description Unit tests for the callbackUrl allowlist validator (SPEC-182 T-002).
 *
 * Security-critical: these tests pin down the open-redirect protection. The
 * validator MUST reject any URL whose real host is not an allowed Hospeda
 * origin, including the classic bypass shapes (suffix host, embedded path,
 * userinfo `@` trick, alternate protocols, protocol-relative URLs).
 */

import { describe, expect, it } from 'vitest';
import { validateCallbackUrl } from '../../src/lib/auth-callback';

const PROD = {
    siteUrl: 'https://hospeda.com.ar',
    adminUrl: 'https://admin.hospeda.com.ar',
    isProduction: true
} as const;

const DEV = {
    siteUrl: 'http://localhost:4321',
    adminUrl: 'http://localhost:3000',
    isProduction: false
} as const;

describe('validateCallbackUrl — allowed cases', () => {
    it('accepts the admin app origin (exact match)', () => {
        const url = 'https://admin.hospeda.com.ar/dashboard';
        expect(validateCallbackUrl({ url, ...PROD })).toBe(url);
    });

    it('accepts the site origin (exact match)', () => {
        const url = 'https://hospeda.com.ar/es/mi-cuenta/';
        expect(validateCallbackUrl({ url, ...PROD })).toBe(url);
    });

    it('accepts the apex hospeda.com.ar host', () => {
        const url = 'https://hospeda.com.ar';
        expect(validateCallbackUrl({ url, ...PROD })).toBe(url);
    });

    it('accepts any subdomain of hospeda.com.ar (e.g. staging)', () => {
        const url = 'https://staging.hospeda.com.ar/some/path';
        expect(validateCallbackUrl({ url, ...PROD })).toBe(url);
    });

    it('preserves query string and fragment of an allowed URL', () => {
        const url = 'https://admin.hospeda.com.ar/dashboard?tab=2#section';
        expect(validateCallbackUrl({ url, ...PROD })).toBe(url);
    });

    it('accepts localhost in development', () => {
        const url = 'http://localhost:3000/dashboard';
        expect(validateCallbackUrl({ url, ...DEV })).toBe(url);
    });

    it('accepts *.hospeda.local in development', () => {
        const url = 'http://admin.hospeda.local:3000/dashboard';
        expect(validateCallbackUrl({ url, ...DEV })).toBe(url);
    });

    it('accepts the apex hospeda.local in development', () => {
        const url = 'http://hospeda.local:4321/es/';
        expect(validateCallbackUrl({ url, ...DEV })).toBe(url);
    });
});

describe('validateCallbackUrl — blocked cases (open-redirect protection)', () => {
    it('rejects an arbitrary external domain', () => {
        expect(validateCallbackUrl({ url: 'https://evil.example.com/steal', ...PROD })).toBeNull();
    });

    it('rejects a suffix-host attack (hospeda.com.ar.evil.com)', () => {
        expect(
            validateCallbackUrl({ url: 'https://hospeda.com.ar.evil.com/', ...PROD })
        ).toBeNull();
    });

    it('rejects an embedded-domain-in-path attack', () => {
        expect(validateCallbackUrl({ url: 'https://evil.com/hospeda.com.ar', ...PROD })).toBeNull();
    });

    it('rejects a userinfo @ attack where the real host is external', () => {
        expect(
            validateCallbackUrl({ url: 'https://hospeda.com.ar@evil.com/', ...PROD })
        ).toBeNull();
    });

    it('rejects a non-http(s) protocol (javascript:)', () => {
        expect(validateCallbackUrl({ url: 'javascript:alert(1)', ...PROD })).toBeNull();
    });

    it('rejects a data: URL', () => {
        expect(
            validateCallbackUrl({ url: 'data:text/html,<script>1</script>', ...PROD })
        ).toBeNull();
    });

    it('rejects a relative path (callbackUrl must be absolute)', () => {
        expect(validateCallbackUrl({ url: '/es/mi-cuenta/', ...PROD })).toBeNull();
    });

    it('rejects a protocol-relative URL', () => {
        expect(validateCallbackUrl({ url: '//evil.com/x', ...PROD })).toBeNull();
    });

    it('rejects an empty string', () => {
        expect(validateCallbackUrl({ url: '', ...PROD })).toBeNull();
    });

    it('rejects whitespace', () => {
        expect(validateCallbackUrl({ url: '   ', ...PROD })).toBeNull();
    });

    it('rejects garbage that is not a URL', () => {
        expect(validateCallbackUrl({ url: 'not a url', ...PROD })).toBeNull();
    });
});

describe('validateCallbackUrl — environment gating', () => {
    it('rejects localhost in production (dev hosts only allowed in dev)', () => {
        expect(validateCallbackUrl({ url: 'http://localhost:3000/dashboard', ...PROD })).toBeNull();
    });

    it('rejects *.hospeda.local in production', () => {
        expect(
            validateCallbackUrl({ url: 'http://admin.hospeda.local:3000/', ...PROD })
        ).toBeNull();
    });

    it('rejects an external hospeda.com.ar lookalike in development too', () => {
        expect(validateCallbackUrl({ url: 'https://hospeda.com.ar.evil.com/', ...DEV })).toBeNull();
    });

    it('still accepts the configured site origin even when adminUrl is undefined', () => {
        const url = 'http://localhost:4321/es/';
        expect(
            validateCallbackUrl({
                url,
                siteUrl: 'http://localhost:4321',
                adminUrl: undefined,
                isProduction: false
            })
        ).toBe(url);
    });
});
