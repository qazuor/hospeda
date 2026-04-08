/**
 * @file middleware-helpers.test.ts
 * @description Unit tests for middleware helper functions.
 */

import { describe, expect, it } from 'vitest';
import {
    buildCspHeader,
    buildLocaleRedirect,
    buildLoginRedirect,
    extractLocaleFromPath,
    generateCspNonce,
    isAuthRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute
} from '../../src/lib/middleware-helpers';

describe('extractLocaleFromPath', () => {
    it('should extract valid locale', () => {
        const result = extractLocaleFromPath({ path: '/es/alojamientos/' });
        expect(result).toEqual({ locale: 'es', restOfPath: '/alojamientos/' });
    });

    it('should return null for invalid locale', () => {
        const result = extractLocaleFromPath({ path: '/xx/foo/' });
        expect(result.locale).toBeNull();
    });

    it('should return null for root path', () => {
        const result = extractLocaleFromPath({ path: '/' });
        expect(result.locale).toBeNull();
    });

    it('should handle all supported locales', () => {
        expect(extractLocaleFromPath({ path: '/es/test/' }).locale).toBe('es');
        expect(extractLocaleFromPath({ path: '/en/test/' }).locale).toBe('en');
        expect(extractLocaleFromPath({ path: '/pt/test/' }).locale).toBe('pt');
    });

    it('should extract rest of path correctly', () => {
        const result = extractLocaleFromPath({ path: '/en/mi-cuenta/perfil/' });
        expect(result).toEqual({ locale: 'en', restOfPath: '/mi-cuenta/perfil/' });
    });
});

describe('isProtectedRoute', () => {
    it('should return true for mi-cuenta routes', () => {
        expect(isProtectedRoute({ path: '/es/mi-cuenta/' })).toBe(true);
        expect(isProtectedRoute({ path: '/es/mi-cuenta/perfil/' })).toBe(true);
    });

    it('should return false for public routes', () => {
        expect(isProtectedRoute({ path: '/es/alojamientos/' })).toBe(false);
        expect(isProtectedRoute({ path: '/es/destinos/' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isProtectedRoute({ path: '' })).toBe(false);
    });
});

describe('isAuthRoute', () => {
    it('should return true for auth routes', () => {
        expect(isAuthRoute({ path: '/es/auth/signin/' })).toBe(true);
        expect(isAuthRoute({ path: '/es/auth/signup/' })).toBe(true);
    });

    it('should return false for non-auth routes', () => {
        expect(isAuthRoute({ path: '/es/alojamientos/' })).toBe(false);
    });
});

describe('isStaticAssetRoute', () => {
    it('should detect static file extensions', () => {
        expect(isStaticAssetRoute({ path: '/images/logo.png' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/styles/main.css' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/script.js' })).toBe(true);
    });

    it('should detect Astro internal paths', () => {
        expect(isStaticAssetRoute({ path: '/_astro/chunk.js' })).toBe(true);
    });

    it('should detect well-known static files', () => {
        expect(isStaticAssetRoute({ path: '/robots.txt' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/favicon.ico' })).toBe(true);
    });

    it('should detect error pages', () => {
        expect(isStaticAssetRoute({ path: '/404' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/500' })).toBe(true);
    });

    it('should return false for regular pages', () => {
        expect(isStaticAssetRoute({ path: '/es/alojamientos/' })).toBe(false);
    });
});

describe('isServerIslandRoute', () => {
    it('should detect server island routes', () => {
        expect(isServerIslandRoute({ path: '/_server-islands/AuthSection' })).toBe(true);
    });

    it('should return false for non-server-island routes', () => {
        expect(isServerIslandRoute({ path: '/es/' })).toBe(false);
    });
});

describe('buildLoginRedirect', () => {
    it('should build login URL with encoded return path', () => {
        const result = buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' });
        expect(result).toBe('/es/auth/signin/?returnUrl=%2Fes%2Fmi-cuenta%2Fperfil%2F');
    });
});

describe('buildLocaleRedirect', () => {
    it('should prefix with default locale', () => {
        const result = buildLocaleRedirect({ restOfPath: '/alojamientos/' });
        expect(result).toBe('/es/alojamientos/');
    });
});

describe('generateCspNonce', () => {
    it('should generate a non-empty string', () => {
        const nonce = generateCspNonce();
        expect(nonce).toBeTruthy();
        expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces', () => {
        const a = generateCspNonce();
        const b = generateCspNonce();
        expect(a).not.toBe(b);
    });

    it('should be valid base64', () => {
        const nonce = generateCspNonce();
        expect(() => atob(nonce)).not.toThrow();
    });
});

describe('buildCspHeader', () => {
    it('should include nonce in script-src and style-src', () => {
        const header = buildCspHeader({ nonce: 'test123' });
        expect(header).toContain("'nonce-test123'");
        expect(header).toContain('script-src');
        expect(header).toContain('style-src');
    });

    it('should include API URL in connect-src when provided', () => {
        const header = buildCspHeader({ nonce: 'x', apiUrl: 'https://api.example.com' });
        expect(header).toContain('https://api.example.com');
    });

    it('should omit API URL from connect-src when empty', () => {
        const header = buildCspHeader({ nonce: 'x', apiUrl: '' });
        expect(header).not.toContain("connect-src 'self'  ");
    });

    it('should omit API URL from connect-src when undefined', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain("connect-src 'self'");
    });

    it('should include sentry report-uri when provided', () => {
        const header = buildCspHeader({ nonce: 'x', sentryReportUri: 'https://sentry.io/report' });
        expect(header).toContain('report-uri https://sentry.io/report');
    });

    it('should not include report-uri when not provided', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).not.toContain('report-uri');
    });

    it('should restrict img-src to specific domains', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain('img-src');
        expect(header).toContain('vercel-storage.com');
        expect(header).not.toContain("img-src 'self' data: https:");
    });

    it('should not include unsafe-inline', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).not.toContain('unsafe-inline');
    });
});
