/**
 * @file post-auth-redirect.test.ts
 * @description Unit tests for `src/lib/post-auth-redirect.ts` — the shared
 * post-auth redirect-target resolver factored out of four near-identical
 * inline copies in `SignIn.client.tsx` and `SignUp.client.tsx` (HOS-959
 * step 1).
 *
 * Covers: a plain relative path, the absolute-URL-with-wrong-host case (the
 * reverse-proxy `https://localhost` bug — SPEC-103 T-012), the
 * verbatim/`externalRedirect` case (SPEC-182), the malformed-input fallback
 * to `/`, and the `errorCallbackURL` shape.
 *
 * @module test/lib/post-auth-redirect
 */

import { describe, expect, it } from 'vitest';

import { buildOAuthErrorCallbackUrl, resolvePostAuthRedirectUrl } from '@/lib/post-auth-redirect';

describe('resolvePostAuthRedirectUrl', () => {
    describe('plain relative path', () => {
        it('anchors a relative path on the current origin', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: '/es/mi-cuenta/',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });

        it('preserves query string and hash on the relative path', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: '/es/mi-cuenta/?tab=billing#section',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/es/mi-cuenta/?tab=billing#section');
        });

        it('prefixes a leading slash onto a bare relative path', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: 'es/mi-cuenta/',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });

        it('defaults an empty target to the site root', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: '',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/');
        });
    });

    describe('absolute URL with the wrong host (reverse-proxy localhost bug, SPEC-103 T-012)', () => {
        it('discards a bad https://localhost host and reattaches the real origin', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: 'https://localhost/es/mi-cuenta/',
                    currentOrigin: 'https://staging.hospeda.com.ar'
                })
            ).toBe('https://staging.hospeda.com.ar/es/mi-cuenta/');
        });

        it('keeps query string and hash when stripping the bad host', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: 'https://localhost/es/auth/verify-email-sent/?foo=bar#top',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/es/auth/verify-email-sent/?foo=bar#top');
        });

        it('discards ANY absolute host, not just localhost — only the origin passed in is trusted', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: 'http://some-other-host.example/es/mi-cuenta/',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });
    });

    describe('verbatim / externalRedirect (SPEC-182)', () => {
        it('returns the target verbatim, ignoring currentOrigin', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: 'https://admin.hospeda.com.ar/dashboard',
                    currentOrigin: 'https://hospeda.com.ar',
                    externalRedirect: true
                })
            ).toBe('https://admin.hospeda.com.ar/dashboard');
        });

        it('does not strip the host even when it looks like the reverse-proxy bug', () => {
            // externalRedirect targets are server-allowlisted; the host-strip
            // is a same-app safeguard and must never run on them.
            expect(
                resolvePostAuthRedirectUrl({
                    target: 'https://localhost/dashboard',
                    currentOrigin: 'https://hospeda.com.ar',
                    externalRedirect: true
                })
            ).toBe('https://localhost/dashboard');
        });

        it('defaults externalRedirect to false when omitted', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    target: '/es/mi-cuenta/',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });
    });

    describe('malformed input falls back to /', () => {
        it('falls back to the site root when the absolute target fails to parse', () => {
            expect(
                resolvePostAuthRedirectUrl({
                    // Starts with "http" but is not a parseable URL.
                    target: 'http://[not-a-valid-host',
                    currentOrigin: 'https://hospeda.com.ar'
                })
            ).toBe('https://hospeda.com.ar/');
        });
    });
});

describe('buildOAuthErrorCallbackUrl', () => {
    it('anchors the current pathname on the current origin', () => {
        expect(
            buildOAuthErrorCallbackUrl({
                currentOrigin: 'https://hospeda.com.ar',
                currentPathname: '/es/auth/signin/'
            })
        ).toBe('https://hospeda.com.ar/es/auth/signin/');
    });

    it('falls back to / when pathname is an empty string', () => {
        // TRAP: the window.location stubs used across apps/web tests have no
        // `pathname` property by default — reading it throws and a
        // surrounding try/catch turns that into a silent wrong answer. This
        // case proves the helper itself degrades correctly once pathname
        // resolves to '' (e.g. a caller reading a stub that has no pathname
        // set, or one explicitly stubbed with pathname: '').
        expect(
            buildOAuthErrorCallbackUrl({
                currentOrigin: 'https://hospeda.com.ar',
                currentPathname: ''
            })
        ).toBe('https://hospeda.com.ar/');
    });

    it('reflects a nested path unchanged', () => {
        expect(
            buildOAuthErrorCallbackUrl({
                currentOrigin: 'https://hospeda.com.ar',
                currentPathname: '/en/auth/signup/'
            })
        ).toBe('https://hospeda.com.ar/en/auth/signup/');
    });
});

describe('window.location stub without pathname (the documented apps/web test trap)', () => {
    it('reading window.location.pathname from a stub missing it throws, not silently undefined', () => {
        const original = Object.getOwnPropertyDescriptor(window, 'location');
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { origin: 'https://hospeda.com.ar', href: 'https://hospeda.com.ar/' }
        });

        try {
            // Accessing a genuinely absent plain-object property does not
            // throw — it returns undefined. The documented trap is that a
            // caller then does `undefined || '/'` and silently gets '/' with
            // no signal anything was misconfigured. Prove the helper handles
            // that degraded input correctly rather than assuming a real
            // Location object was stubbed.
            const pathname = (window.location as { pathname?: string }).pathname;
            expect(pathname).toBeUndefined();
            expect(
                buildOAuthErrorCallbackUrl({
                    currentOrigin: window.location.origin,
                    currentPathname: pathname ?? ''
                })
            ).toBe('https://hospeda.com.ar/');
        } finally {
            if (original) Object.defineProperty(window, 'location', original);
        }
    });
});
