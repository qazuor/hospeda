/**
 * @file auth-redirect.test.ts
 * @description Unit tests for `src/lib/auth-redirect.ts`.
 *
 * `resolveSafeReturnPath` is the open-redirect guard both `/auth/signin/` and
 * (since HOS-810) `/auth/signup/` run every attacker-controlled `returnUrl`
 * through before handing it to `Astro.redirect`. It used to be four inline
 * lines inside signin.astro, where nothing could execute it — an Astro page
 * cannot be rendered in vitest, so the only assertion the page test could make
 * was that the string `isSafeRelativePath` appeared in the source. That is a
 * spelling check, not a security test. Lifting the predicate into a module is
 * what makes the cases below runnable at all.
 *
 * @module test/lib/auth-redirect
 */

import { describe, expect, it } from 'vitest';

import { buildLoginRedirect, resolveSafeReturnPath } from '@/lib/auth-redirect';

describe('buildLoginRedirect', () => {
    it('points at signin and carries the current path url-encoded', () => {
        expect(buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' })).toBe(
            '/es/auth/signin/?returnUrl=%2Fes%2Fmi-cuenta%2Fperfil%2F'
        );
    });

    it('keeps the locale it was given', () => {
        expect(buildLoginRedirect({ locale: 'pt', currentUrl: '/pt/mi-cuenta/' })).toBe(
            '/pt/auth/signin/?returnUrl=%2Fpt%2Fmi-cuenta%2F'
        );
    });
});

describe('resolveSafeReturnPath', () => {
    describe('accepts a same-origin relative path', () => {
        it('returns the commerce create form verbatim (HOS-810)', () => {
            expect(
                resolveSafeReturnPath({
                    rawReturn: '/es/mi-cuenta/comercio/nuevo/experience/',
                    locale: 'es'
                })
            ).toBe('/es/mi-cuenta/comercio/nuevo/experience/');
        });

        it('preserves a query string on the destination', () => {
            expect(
                resolveSafeReturnPath({ rawReturn: '/en/mi-cuenta/?tab=billing', locale: 'en' })
            ).toBe('/en/mi-cuenta/?tab=billing');
        });
    });

    describe('falls back to the account dashboard', () => {
        // Each row is a shape that `new URL(raw, origin)` would resolve to
        // something OFF this origin, which is the whole point of the guard.
        const rejected: ReadonlyArray<{ readonly label: string; readonly raw: string }> = [
            { label: 'empty (no param supplied)', raw: '' },
            { label: 'protocol-relative //evil.com', raw: '//evil.com' },
            { label: 'protocol-relative with a path', raw: '//evil.com/es/mi-cuenta/' },
            { label: 'backslash variant /\\evil.com', raw: '/\\evil.com' },
            { label: 'absolute https URL', raw: 'https://evil.com/es/' },
            { label: 'javascript: scheme', raw: 'javascript:alert(1)' },
            { label: 'bare relative path with no leading slash', raw: 'es/mi-cuenta/' },
            // HOS-1170: the WHATWG URL parser strips tab/LF/CR anywhere in the
            // string, so a control character placed right after the leading
            // slash lets `/\t/evil.com` slip past the three prefix checks above
            // and later collapse to `//evil.com` when the caller does
            // `new URL(result, origin)`. Same family for \r and \n, and it still
            // triggers with more than one control char in a row.
            { label: 'tab before the second slash (/\\t/evil.com)', raw: '/\t/evil.com' },
            { label: 'CR before the second slash (/\\r/evil.com)', raw: '/\r/evil.com' },
            { label: 'LF before the second slash (/\\n/evil.com)', raw: '/\n/evil.com' },
            { label: 'two tabs before the second slash (/\\t\\t/evil.com)', raw: '/\t\t/evil.com' },
            // The same payload as it actually arrives from the query string
            // (`?returnUrl=%2F%09%2Fevil.com`), decoded the way the caller does
            // before handing it to this function.
            {
                label: 'decoded query-param form of the tab payload',
                raw: decodeURIComponent('%2F%09%2Fevil.com')
            },
            // A control char that does NOT produce a second slash (no `//`
            // after WHATWG stripping) must still be rejected — the guard is
            // "no control chars at all", not "no control chars that happen to
            // form `//`".
            { label: 'tab with no second slash (/\\tevil.com)', raw: '/\tevil.com' }
        ];

        for (const { label, raw } of rejected) {
            it(`rejects ${label}`, () => {
                expect(resolveSafeReturnPath({ rawReturn: raw, locale: 'es' })).toBe(
                    '/es/mi-cuenta/'
                );
            });
        }

        it('builds the fallback in the caller locale, not a hard-coded one', () => {
            expect(resolveSafeReturnPath({ rawReturn: '//evil.com', locale: 'pt' })).toBe(
                '/pt/mi-cuenta/'
            );
        });

        it('never lets the WHATWG URL parser resolve the result off-origin (HOS-1170)', () => {
            // This is the assertion that actually proves the exploit is closed:
            // pass the function's OWN output through the same `new URL()` call
            // a consumer (e.g. Astro.redirect) would perform, and confirm the
            // origin stays the site's own.
            const controlCharPayloads = ['/\t/evil.com', '/\r/evil.com', '/\n/evil.com'];

            for (const raw of controlCharPayloads) {
                const result = resolveSafeReturnPath({ rawReturn: raw, locale: 'es' });
                const resolved = new URL(result, 'https://hospeda.com.ar');
                expect(resolved.origin).toBe('https://hospeda.com.ar');
            }
        });
    });
});
