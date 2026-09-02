/**
 * @file verification-callback.test.ts
 * @description HOS-838 — the verification email must carry the destination the
 * person was heading for, and must never send them to a host that serves no
 * pages.
 */

import { describe, expect, it } from 'vitest';
import { resolveVerificationUrl } from '../../src/lib/verification-callback';

const SITE_ORIGIN = 'https://hospeda.com.ar';
const API_ORIGIN = 'https://api.hospeda.com.ar';

/** Builds the `url` shape Better Auth hands to `sendVerificationEmail`. */
function betterAuthUrl(callbackUrl?: string): string {
    const base = `${API_ORIGIN}/api/auth/verify-email?token=tok-123`;
    return callbackUrl === undefined
        ? base
        : `${base}&callbackURL=${encodeURIComponent(callbackUrl)}`;
}

/** Reads the `callbackURL` back out of a resolved verification URL. */
function readCallback(url: string): string | null {
    return new URL(url).searchParams.get('callbackURL');
}

describe('resolveVerificationUrl — HOS-838', () => {
    describe('when the client asked for a destination', () => {
        it('forwards the requested callback verbatim', () => {
            // Arrange
            const requested = `${SITE_ORIGIN}/es/mi-cuenta/comercios/nuevo/`;

            // Act
            const resolved = resolveVerificationUrl({
                url: betterAuthUrl(requested),
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(readCallback(resolved)).toBe(requested);
        });

        it('keeps the verification token intact', () => {
            // Losing the token would make the link dead, which is a far worse
            // failure than landing on the wrong page.
            // Act
            const resolved = resolveVerificationUrl({
                url: betterAuthUrl(`${SITE_ORIGIN}/en/mi-cuenta/`),
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(new URL(resolved).searchParams.get('token')).toBe('tok-123');
        });

        it('honours a non-Spanish locale instead of pinning es', () => {
            // The old hard-coded callback sent everyone to /es/, so anyone who
            // signed up on /en/ or /pt/ came back to Spanish.
            // Act
            const resolved = resolveVerificationUrl({
                url: betterAuthUrl(`${SITE_ORIGIN}/pt/mi-cuenta/`),
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(readCallback(resolved)).toBe(`${SITE_ORIGIN}/pt/mi-cuenta/`);
            expect(readCallback(resolved)).not.toContain('/es/');
        });
    });

    describe('when there is no usable destination', () => {
        it('falls back to the web sign-in screen when Better Auth substituted "/"', () => {
            // A bare "/" would resolve against the API origin, which serves no
            // pages at all.
            // Act
            const resolved = resolveVerificationUrl({
                url: betterAuthUrl('/'),
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(readCallback(resolved)).toBe(`${SITE_ORIGIN}/es/auth/signin?verified=1`);
        });

        it('falls back when no callbackURL is present at all', () => {
            // Act
            const resolved = resolveVerificationUrl({
                url: betterAuthUrl(),
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(readCallback(resolved)).toBe(`${SITE_ORIGIN}/es/auth/signin?verified=1`);
        });

        it('rejects a RELATIVE callback, which would resolve against the API host', () => {
            // Better Auth accepts relative paths as trusted, but this redirect
            // is followed from an inbox against the API origin — the one host
            // that serves no pages.
            // Act
            const resolved = resolveVerificationUrl({
                url: betterAuthUrl('/es/mi-cuenta/comercios/nuevo/'),
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(readCallback(resolved)).toBe(`${SITE_ORIGIN}/es/auth/signin?verified=1`);
            expect(readCallback(resolved)).not.toContain(API_ORIGIN);
        });

        it('returns the fallback rather than throwing on a malformed url', () => {
            // Act
            const resolved = resolveVerificationUrl({
                url: 'not a url at all',
                siteOrigin: SITE_ORIGIN
            });

            // Assert
            expect(resolved).toBe(`${SITE_ORIGIN}/es/auth/signin?verified=1`);
        });
    });

    it('tolerates a trailing slash on the configured site origin', () => {
        // Act
        const resolved = resolveVerificationUrl({
            url: betterAuthUrl('/'),
            siteOrigin: `${SITE_ORIGIN}/`
        });

        // Assert — a doubled slash would 404 or redirect oddly.
        expect(readCallback(resolved)).toBe(`${SITE_ORIGIN}/es/auth/signin?verified=1`);
    });
});
