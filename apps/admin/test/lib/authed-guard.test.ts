/**
 * Unit tests for `decideAuthedGuard`.
 *
 * The guard's decision logic is a pure function — this suite covers all the
 * branches without spinning up TanStack Router or mocking `redirect()`.
 */

import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { decideAuthedGuard } from '../../src/lib/authed-guard';

const SITE_URL = 'https://hospeda.com.ar';
const ADMIN_URL = 'https://admin.hospeda.com.ar';
const DEFAULT_PATH = '/dashboard';
const DEFAULT_LOCALE = 'es';

const baseAuthState = (overrides: Partial<AuthState>): AuthState => ({
    userId: 'user-123',
    isAuthenticated: true,
    role: 'USER',
    permissions: [],
    passwordChangeRequired: false,
    displayName: 'Lola Test',
    email: 'lola@example.com',
    avatar: null,
    emailVerified: true,
    ...overrides
});

describe('decideAuthedGuard', () => {
    it('redirects unauthenticated users to the web signin with an absolute admin callbackUrl (SPEC-182)', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ isAuthenticated: false, userId: null, role: null }),
            pathname: '/admin/accommodations',
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision.kind).toBe('redirect-signin');
        if (decision.kind !== 'redirect-signin') return;

        const url = new URL(decision.href);
        // Lands on the web signin page, not the admin's own deleted signin.
        expect(url.origin).toBe(SITE_URL);
        expect(url.pathname).toBe('/es/auth/signin/');
        // callbackUrl is the ABSOLUTE admin URL the user was trying to reach,
        // so the web signin (validateCallbackUrl) accepts it post-login.
        expect(url.searchParams.get('callbackUrl')).toBe(
            'https://admin.hospeda.com.ar/admin/accommodations'
        );
    });

    it('builds the web signin callbackUrl with the preferred locale', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ isAuthenticated: false, userId: null, role: null }),
            pathname: '/dashboard',
            preferredLocale: 'en',
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision.kind).toBe('redirect-signin');
        if (decision.kind !== 'redirect-signin') return;
        expect(new URL(decision.href).pathname).toBe('/en/auth/signin/');
    });

    it('redirects a tourist (role=USER, no panel access) to the public host funnel with from=admin', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ role: 'USER', permissions: [] }),
            pathname: DEFAULT_PATH,
            preferredLocale: 'pt',
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision.kind).toBe('redirect-tourist-funnel');
        if (decision.kind !== 'redirect-tourist-funnel') return;

        const url = new URL(decision.href);
        expect(url.origin).toBe(SITE_URL);
        expect(url.pathname).toBe('/pt/publicar/');
        expect(url.searchParams.get('from')).toBe('admin');
    });

    it('encodes the locale into the redirect path verbatim', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ role: 'USER', permissions: [] }),
            pathname: DEFAULT_PATH,
            preferredLocale: 'en',
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision.kind).toBe('redirect-tourist-funnel');
        if (decision.kind !== 'redirect-tourist-funnel') return;
        expect(new URL(decision.href).pathname).toBe('/en/publicar/');
    });

    it('redirects a HOST without panel access to forbidden with reason=host-missing-permission', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ role: 'HOST', permissions: [] }),
            pathname: '/admin/accommodations/abc',
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision).toEqual({
            kind: 'redirect-forbidden',
            search: {
                reason: 'host-missing-permission',
                redirect: '/admin/accommodations/abc'
            }
        });
    });

    it('redirects any other authenticated role (e.g. ADMIN without ACCESS_PANEL_ADMIN, exotic roles) to forbidden with reason=generic', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ role: 'ADMIN', permissions: [] }),
            pathname: '/admin/billing/plans',
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision).toEqual({
            kind: 'redirect-forbidden',
            search: {
                reason: 'generic',
                redirect: '/admin/billing/plans'
            }
        });
    });

    it('redirects to change-password when access is granted but password change is required', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({
                role: 'ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN],
                passwordChangeRequired: true
            }),
            pathname: DEFAULT_PATH,
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision).toEqual({ kind: 'redirect-change-password' });
    });

    it('allows the request through when authenticated with ACCESS_PANEL_ADMIN', () => {
        const authState = baseAuthState({
            role: 'ADMIN',
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
        });
        const decision = decideAuthedGuard({
            authState,
            pathname: DEFAULT_PATH,
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision).toEqual({ kind: 'allow', authState });
    });

    it('treats null role with empty permissions as generic forbidden', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ role: null, permissions: [] }),
            pathname: '/admin',
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });

        expect(decision.kind).toBe('redirect-forbidden');
        if (decision.kind !== 'redirect-forbidden') return;
        expect(decision.search.reason).toBe('generic');
    });
});

/**
 * Focused coverage of the SPEC-182 web-auth redirect shape (T-009). The
 * redirect-signin href must be a well-formed absolute web signin URL whose
 * callbackUrl is the percent-encoded ABSOLUTE admin URL the visitor requested,
 * so the web signin's allowlist (validateCallbackUrl) accepts it and returns
 * the user to admin after login.
 */
describe('decideAuthedGuard — web-auth redirect shape (SPEC-182 T-009)', () => {
    const signinHref = (pathname: string, locale = DEFAULT_LOCALE): string => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ isAuthenticated: false, userId: null, role: null }),
            pathname,
            preferredLocale: locale,
            siteUrl: SITE_URL,
            adminUrl: ADMIN_URL
        });
        if (decision.kind !== 'redirect-signin') {
            throw new Error(`expected redirect-signin, got ${decision.kind}`);
        }
        return decision.href;
    };

    it('percent-encodes the callbackUrl inside the raw href (not left as raw URL chars)', () => {
        const href = signinHref('/accommodations');
        // The callbackUrl value must be escaped in the query string: its ':'
        // and '/' appear as %3A / %2F, never as a second bare "https://".
        expect(href).toContain('callbackUrl=https%3A%2F%2Fadmin.hospeda.com.ar%2Faccommodations');
        expect(href.indexOf('https://')).toBe(href.lastIndexOf('https://'));
    });

    it('points the callbackUrl at the ADMIN origin, never the site origin', () => {
        const callbackUrl = new URL(signinHref('/destinations')).searchParams.get('callbackUrl');
        const cb = new URL(callbackUrl ?? '');
        expect(cb.origin).toBe(ADMIN_URL);
        expect(cb.origin).not.toBe(SITE_URL);
        expect(cb.pathname).toBe('/destinations');
    });

    it('preserves a deep admin path verbatim in the callbackUrl', () => {
        const callbackUrl = new URL(signinHref('/accommodations/abc-123/edit')).searchParams.get(
            'callbackUrl'
        );
        expect(callbackUrl).toBe('https://admin.hospeda.com.ar/accommodations/abc-123/edit');
    });

    it('escapes special characters in the requested admin path', () => {
        // A path segment with a space + ampersand must round-trip safely.
        const raw = '/search/a b&c';
        const callbackUrl = new URL(signinHref(raw)).searchParams.get('callbackUrl');
        // Decoded callbackUrl resolves back to the same absolute admin URL.
        expect(callbackUrl).toBe(new URL(raw, ADMIN_URL).toString());
    });

    it('does not double the slash when admin URL has a trailing slash', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ isAuthenticated: false, userId: null, role: null }),
            pathname: '/dashboard',
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: SITE_URL,
            adminUrl: 'https://admin.hospeda.com.ar/'
        });
        if (decision.kind !== 'redirect-signin') throw new Error('expected redirect-signin');
        const callbackUrl = new URL(decision.href).searchParams.get('callbackUrl');
        expect(callbackUrl).toBe('https://admin.hospeda.com.ar/dashboard');
    });

    it('builds the signin path with a trailing slash on every locale', () => {
        for (const locale of ['es', 'en', 'pt']) {
            expect(new URL(signinHref('/dashboard', locale)).pathname).toBe(
                `/${locale}/auth/signin/`
            );
        }
    });

    it('works against localhost dev origins', () => {
        const decision = decideAuthedGuard({
            authState: baseAuthState({ isAuthenticated: false, userId: null, role: null }),
            pathname: '/dashboard',
            preferredLocale: DEFAULT_LOCALE,
            siteUrl: 'http://localhost:4321',
            adminUrl: 'http://localhost:3000'
        });
        if (decision.kind !== 'redirect-signin') throw new Error('expected redirect-signin');
        const url = new URL(decision.href);
        expect(url.origin).toBe('http://localhost:4321');
        expect(url.searchParams.get('callbackUrl')).toBe('http://localhost:3000/dashboard');
    });
});
