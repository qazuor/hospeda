/**
 * @file auth-tabs-config.test.ts
 * @description Behavioral tests for `resolveAuthTabsRedirectConfig`
 * (HOS-959) — the shared post-auth redirect-target computation extracted
 * from `signin.astro`/`signup.astro`'s previously hand-copied
 * `returnUrl`/`redirect`/`callbackUrl` handling.
 *
 * Deep validation of `resolveSafeReturnPath` (open-redirect guard) and
 * `validateCallbackUrl` (SPEC-182 allowlist) themselves already lives in
 * `auth-redirect.test.ts` and `auth-callback.test.ts` — this file only
 * covers how THIS helper composes them into `signInConfig`/`signUpConfig`,
 * including the HOS-959 deliberate behavior addition: OAuth registration
 * now honors `callbackUrl` exactly like sign-in, while password
 * registration still never does (HOS-838).
 */

import { describe, expect, it } from 'vitest';
import { resolveAuthTabsRedirectConfig } from '@/lib/auth-tabs-config';

const SITE_URL = 'https://hospeda.com.ar';
const ADMIN_URL = 'https://admin.hospeda.com.ar';

function urlFor(pathAndQuery: string): URL {
    return new URL(pathAndQuery, SITE_URL);
}

describe('resolveAuthTabsRedirectConfig', () => {
    describe('plain returnUrl / redirect (no callbackUrl)', () => {
        it('anchors a safe returnUrl on the request origin for both tabs redirectTo/oauthRedirectTo', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signin/?returnUrl=/es/mi-cuenta/favoritos/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.returnPath).toBe('/es/mi-cuenta/favoritos/');
            expect(result.validatedCallbackUrl).toBeNull();
            expect(result.signInConfig).toEqual({
                redirectTo: 'https://hospeda.com.ar/es/mi-cuenta/favoritos/',
                externalRedirect: false
            });
            expect(result.signUpConfig.oauthRedirectTo).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/favoritos/'
            );
            expect(result.signUpConfig.oauthExternalRedirect).toBe(false);
        });

        it('falls back to /es/mi-cuenta/ when no returnUrl/redirect is present', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signin/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.returnPath).toBe('/es/mi-cuenta/');
            expect(result.signInConfig.redirectTo).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });

        it('accepts the legacy `redirect` alias when returnUrl is absent', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signin/?redirect=/es/mi-cuenta/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.returnPath).toBe('/es/mi-cuenta/');
        });

        it('prefers returnUrl over redirect when both are present', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    '/es/auth/signin/?returnUrl=/es/mi-cuenta/favoritos/&redirect=/es/mi-cuenta/'
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.returnPath).toBe('/es/mi-cuenta/favoritos/');
        });

        it('rejects an unsafe absolute returnUrl and falls back to /es/mi-cuenta/ (open-redirect guard)', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signin/?returnUrl=${encodeURIComponent('https://evil.example.com/')}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.returnPath).toBe('/es/mi-cuenta/');
            expect(result.signInConfig.redirectTo).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });
    });

    describe('validated callbackUrl (SPEC-182)', () => {
        it('takes precedence over returnPath and marks externalRedirect on the sign-in tab', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signin/?returnUrl=/es/mi-cuenta/&callbackUrl=${encodeURIComponent(`${ADMIN_URL}/dashboard`)}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.validatedCallbackUrl).toBe(`${ADMIN_URL}/dashboard`);
            expect(result.signInConfig).toEqual({
                redirectTo: `${ADMIN_URL}/dashboard`,
                externalRedirect: true
            });
        });

        // HOS-959: the deliberate behavior ADDITION — OAuth registration now
        // shares the exact same destination as sign-in, callbackUrl
        // included. Before this, signup.astro ignored callbackUrl entirely.
        it('also becomes the sign-up tab OAuth destination, marked external', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signup/?callbackUrl=${encodeURIComponent(`${ADMIN_URL}/dashboard`)}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.signUpConfig.oauthRedirectTo).toBe(`${ADMIN_URL}/dashboard`);
            expect(result.signUpConfig.oauthExternalRedirect).toBe(true);
        });

        it('rejects a callbackUrl outside the allowlist and falls back to returnPath', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signin/?callbackUrl=${encodeURIComponent('https://evil.example.com/steal')}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.validatedCallbackUrl).toBeNull();
            expect(result.signInConfig.externalRedirect).toBe(false);
            expect(result.signInConfig.redirectTo).toBe('https://hospeda.com.ar/es/mi-cuenta/');
        });
    });

    describe('sign-up password-registration browser destination', () => {
        it('always points at /auth/verify-email-sent/, ignoring returnUrl', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signup/?returnUrl=/es/mi-cuenta/favoritos/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.signUpConfig.redirectTo).toBe(
                'https://hospeda.com.ar/es/auth/verify-email-sent/'
            );
        });

        it('always points at /auth/verify-email-sent/, ignoring a validated callbackUrl too', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signup/?callbackUrl=${encodeURIComponent(`${ADMIN_URL}/dashboard`)}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.signUpConfig.redirectTo).toBe(
                'https://hospeda.com.ar/es/auth/verify-email-sent/'
            );
            // ...while the OAuth destination on the SAME response DOES honor it.
            expect(result.signUpConfig.oauthRedirectTo).toBe(`${ADMIN_URL}/dashboard`);
        });

        it('builds the verify-email-sent URL for the requested locale', () => {
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: new URL('/en/auth/signup/', SITE_URL),
                locale: 'en',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            expect(result.signUpConfig.redirectTo).toBe(
                'https://hospeda.com.ar/en/auth/verify-email-sent/'
            );
        });
    });

    describe('HOS-838: the destination rides in the verification email', () => {
        it('carries a requested returnUrl as the verification callback', () => {
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signup/?returnUrl=/es/mi-cuenta/comercios/nuevo/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/comercios/nuevo/'
            );
        });

        it('is ABSOLUTE, because a relative one resolves against the API host', () => {
            // The verification link is followed from an inbox and handled by
            // the API origin, which serves no pages.
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signup/?returnUrl=/es/mi-cuenta/favoritos/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toMatch(/^https:\/\//);
        });

        it('falls back to the account dashboard when nothing was requested', () => {
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signup/'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/'
            );
        });

        it('honours a validated cross-origin callbackUrl', () => {
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signup/?callbackUrl=${encodeURIComponent(`${ADMIN_URL}/dashboard`)}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(`${ADMIN_URL}/dashboard`);
        });

        it('does NOT let an off-site returnUrl through', () => {
            // The value is attacker-controlled and ends up inside an email we
            // send, so a hostile one would be a phishing vector with our
            // domain on the envelope.
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signup/?returnUrl=https://evil.example/phish'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/'
            );
            expect(result.signUpConfig.verificationCallbackUrl).not.toContain('evil.example');
        });

        it('does NOT let a protocol-relative returnUrl through', () => {
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor('/es/auth/signup/?returnUrl=//evil.example/phish'),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).not.toContain('evil.example');
        });

        it('carries the destination on a non-Spanish locale', () => {
            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: new URL('/en/auth/signup/?returnUrl=/en/mi-cuenta/favoritos/', SITE_URL),
                locale: 'en',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/en/mi-cuenta/favoritos/'
            );
        });
    });

    // HOS-1207. Every other case in this file builds `astroUrl` with
    // `urlFor()`, i.e. on SITE_URL — so `astroUrl.origin === siteUrl` in all
    // of them and the suite is structurally blind to which of the two the
    // implementation reads. That is exactly the difference that broke
    // password sign-up in staging, so these cases pull the two apart.
    describe('HOS-1207: the request origin is not the configured site origin', () => {
        // What the VPS actually hands Astro: TLS ends at Cloudflare and the
        // internal proxy request is plain HTTP, which Astro reports verbatim.
        const PROXIED_URL = 'http://staging.hospeda.com.ar';
        const CONFIGURED_SITE = 'https://staging.hospeda.com.ar';

        it('emits an https verificationCallbackUrl even though the request arrived over http', () => {
            // Arrange: the exact shape that returned 403 and created no account.
            const astroUrl = new URL('/es/auth/signup/', PROXIED_URL);

            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl,
                locale: 'es',
                siteUrl: CONFIGURED_SITE,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert: this is the value Better Auth checks against
            // `trustedOrigins`; an http:// one rejects the whole sign-up.
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://staging.hospeda.com.ar/es/mi-cuenta/'
            );
        });

        it('carries a requested returnUrl on the configured origin, not the proxied one', () => {
            // Arrange
            const astroUrl = new URL(
                '/es/auth/signup/?returnUrl=/es/publicar/experiencias/',
                PROXIED_URL
            );

            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl,
                locale: 'es',
                siteUrl: CONFIGURED_SITE,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://staging.hospeda.com.ar/es/publicar/experiencias/'
            );
        });

        it('anchors the sign-in redirect on the configured origin too', () => {
            // Arrange
            const astroUrl = new URL(
                '/es/auth/signin/?returnUrl=/es/mi-cuenta/favoritos/',
                PROXIED_URL
            );

            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl,
                locale: 'es',
                siteUrl: CONFIGURED_SITE,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signInConfig.redirectTo).toBe(
                'https://staging.hospeda.com.ar/es/mi-cuenta/favoritos/'
            );
        });

        it('anchors the verify-email-sent browser destination on the configured origin too', () => {
            // Arrange
            const astroUrl = new URL('/es/auth/signup/', PROXIED_URL);

            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl,
                locale: 'es',
                siteUrl: CONFIGURED_SITE,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.redirectTo).toBe(
                'https://staging.hospeda.com.ar/es/auth/verify-email-sent/'
            );
        });

        it('ignores a request host that is not the configured site at all', () => {
            // A scheme mismatch is what shipped, but the same anchor has to
            // hold for any alias the app is reachable on — every one of them
            // is an origin Better Auth was never told to trust.
            // Arrange
            const astroUrl = new URL(
                '/es/auth/signup/?returnUrl=/es/mi-cuenta/',
                'https://hospeda-web-staging.internal:4321'
            );

            // Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl,
                locale: 'es',
                siteUrl: CONFIGURED_SITE,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://staging.hospeda.com.ar/es/mi-cuenta/'
            );
            expect(result.signInConfig.redirectTo).not.toContain('internal');
        });

        it('normalizes a configured siteUrl carrying a path or trailing slash', () => {
            // `getSiteUrl()` does not strip a trailing slash the way
            // `getApiUrl()` does, so the anchor has to normalize it itself.
            // Arrange / Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: new URL('/es/auth/signup/', PROXIED_URL),
                locale: 'es',
                siteUrl: 'https://staging.hospeda.com.ar/',
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://staging.hospeda.com.ar/es/mi-cuenta/'
            );
        });

        it('falls back to the request origin when siteUrl cannot be parsed at all', () => {
            // Pins the branch's behaviour; it does NOT endorse it. Both real
            // call sites pass `getSiteUrl()`, which throws on a value that
            // fails `z.url()`, so this input cannot occur outside this test.
            // Reaching it in a build means the 403 is back.
            // Arrange / Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: new URL('/es/auth/signup/', PROXIED_URL),
                locale: 'es',
                siteUrl: 'not-a-url',
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'http://staging.hospeda.com.ar/es/mi-cuenta/'
            );
        });
    });

    // HOS-1207, second route to the same 403. `validateCallbackUrl` accepts
    // EVERY hospeda.com.ar subdomain on purpose (its rule 2 is explicitly not
    // gated by environment), but the API builds `trustedOrigins` from
    // HOSPEDA_SITE_URL + HOSPEDA_ADMIN_URL + HOSPEDA_EXTRA_TRUSTED_ORIGINS —
    // and the extras var is empty in both staging and production. So a
    // subdomain outside that pair passes this app's allowlist and is then
    // refused by Better Auth, which kills the whole sign-up. Only the value
    // that LEAVES the browser is narrowed; the browser redirect is untouched.
    describe('HOS-1207: a callbackUrl this app trusts but the API does not', () => {
        const OTHER_SUBDOMAIN = 'https://otro.hospeda.com.ar/panel';

        function resultForCallbackUrl(callbackUrl: string) {
            return resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(`/es/auth/signup/?callbackUrl=${encodeURIComponent(callbackUrl)}`),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });
        }

        it('keeps it out of the verification callback, falling back to the safe returnPath', () => {
            // Act
            const result = resultForCallbackUrl(OTHER_SUBDOMAIN);

            // Assert: sending this would 403 the sign-up and create no account.
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/'
            );
        });

        it('still redirects the BROWSER there, because that was never the unsafe part', () => {
            // The narrowing must not silently revoke SPEC-182's cross-subdomain
            // redirect: a browser redirect to a Hospeda-owned host is fine.
            // Act
            const result = resultForCallbackUrl(OTHER_SUBDOMAIN);

            // Assert
            expect(result.validatedCallbackUrl).toBe(OTHER_SUBDOMAIN);
            expect(result.signInConfig.redirectTo).toBe(OTHER_SUBDOMAIN);
            expect(result.signInConfig.externalRedirect).toBe(true);
            expect(result.signUpConfig.oauthRedirectTo).toBe(OTHER_SUBDOMAIN);
        });

        it('still carries the admin panel, which IS a configured trusted origin', () => {
            // The designed SPEC-182 flow (admin guard bounces to web signin)
            // must keep working end to end — this is the regression the
            // narrowing could plausibly cause.
            // Act
            const result = resultForCallbackUrl(`${ADMIN_URL}/dashboard`);

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(`${ADMIN_URL}/dashboard`);
        });

        it('still carries a callbackUrl pointing at the site itself', () => {
            // Act
            const result = resultForCallbackUrl(`${SITE_URL}/es/mi-cuenta/favoritos/`);

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/favoritos/'
            );
        });

        it('drops it when no admin origin is configured at all', () => {
            // Arrange / Act: adminUrl undefined — the admin URL must not be
            // matched by accident through some other branch.
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signup/?callbackUrl=${encodeURIComponent(`${ADMIN_URL}/dashboard`)}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: undefined,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/mi-cuenta/'
            );
        });

        it('keeps the requested returnUrl as the fallback destination, not the bare dashboard', () => {
            // Losing the cross-origin destination must not also lose the
            // same-site one the caller asked for.
            // Arrange / Act
            const result = resolveAuthTabsRedirectConfig({
                astroUrl: urlFor(
                    `/es/auth/signup/?returnUrl=/es/publicar/experiencias/&callbackUrl=${encodeURIComponent(OTHER_SUBDOMAIN)}`
                ),
                locale: 'es',
                siteUrl: SITE_URL,
                adminUrl: ADMIN_URL,
                isProduction: true
            });

            // Assert
            expect(result.signUpConfig.verificationCallbackUrl).toBe(
                'https://hospeda.com.ar/es/publicar/experiencias/'
            );
        });
    });
});
