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
});
