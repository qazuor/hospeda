/**
 * HOS-955 — staging and production must not share a session-cookie name.
 *
 * Both environments scope the cookie to the apex `hospeda.com.ar`, so the
 * NAME is the only thing that keeps them apart in the browser's cookie jar.
 */

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_AUTH_COOKIE_PREFIX,
    getAuthSessionCookieNames,
    resolveAuthCookiePrefix,
    STAGING_AUTH_COOKIE_PREFIX
} from '../auth-session-cookie.js';

describe('resolveAuthCookiePrefix', () => {
    it('gives staging (preview) its own prefix', () => {
        // Arrange / Act
        const prefix = resolveAuthCookiePrefix({ deployEnv: 'preview' });

        // Assert
        expect(prefix).toBe('hospeda-staging');
    });

    it('keeps the Better Auth default in production so no prod user is signed out', () => {
        // Arrange / Act
        const prefix = resolveAuthCookiePrefix({ deployEnv: 'prod' });

        // Assert
        expect(prefix).toBe('better-auth');
    });

    it('keeps the default for local runs and when the variable is unset', () => {
        // Arrange / Act / Assert
        expect(resolveAuthCookiePrefix({ deployEnv: 'dev' })).toBe(DEFAULT_AUTH_COOKIE_PREFIX);
        expect(resolveAuthCookiePrefix({ deployEnv: 'test' })).toBe(DEFAULT_AUTH_COOKIE_PREFIX);
        expect(resolveAuthCookiePrefix({ deployEnv: undefined })).toBe(DEFAULT_AUTH_COOKIE_PREFIX);
        expect(resolveAuthCookiePrefix({ deployEnv: '' })).toBe(DEFAULT_AUTH_COOKIE_PREFIX);
    });

    it('never lets an unknown value select the staging prefix', () => {
        // Arrange / Act / Assert
        expect(resolveAuthCookiePrefix({ deployEnv: 'staging' })).toBe(DEFAULT_AUTH_COOKIE_PREFIX);
        expect(resolveAuthCookiePrefix({ deployEnv: 'PREVIEW' })).toBe(DEFAULT_AUTH_COOKIE_PREFIX);
    });

    it('tolerates surrounding whitespace on the staging value', () => {
        // Arrange / Act / Assert
        expect(resolveAuthCookiePrefix({ deployEnv: ' preview ' })).toBe(
            STAGING_AUTH_COOKIE_PREFIX
        );
    });

    it('never resolves staging and production to the same prefix', () => {
        // Arrange / Act
        const staging = resolveAuthCookiePrefix({ deployEnv: 'preview' });
        const production = resolveAuthCookiePrefix({ deployEnv: 'prod' });

        // Assert
        expect(staging).not.toBe(production);
    });
});

describe('getAuthSessionCookieNames', () => {
    it('returns the plain and __Secure- names for production', () => {
        // Arrange / Act
        const names = getAuthSessionCookieNames({ deployEnv: 'prod' });

        // Assert
        expect(names).toEqual(['better-auth.session_token', '__Secure-better-auth.session_token']);
    });

    it('returns the staging names for preview, disjoint from production', () => {
        // Arrange / Act
        const staging = getAuthSessionCookieNames({ deployEnv: 'preview' });
        const production = getAuthSessionCookieNames({ deployEnv: 'prod' });

        // Assert
        expect(staging).toEqual([
            'hospeda-staging.session_token',
            '__Secure-hospeda-staging.session_token'
        ]);
        expect(staging.filter((name) => production.includes(name))).toEqual([]);
    });
});
