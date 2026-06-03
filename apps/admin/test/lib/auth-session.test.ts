import { resolveAuthSession } from '@/lib/auth-session';
/**
 * @file auth-session.test.ts
 * @description Unit tests for `resolveAuthSession` (the testable core of the
 * `fetchAuthSession` server function).
 *
 * BETA-71 parallelized the two upstream calls (`get-session` + `/auth/me`).
 * These tests pin the security-critical invariant that survives that change:
 * permissions from the eagerly-started `/auth/me` are consumed ONLY when the
 * session validates, and a failing `/auth/me` is non-fatal.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';

const API = 'http://api.test';
const SESSION_URL = `${API}/api/auth/get-session`;
const ME_URL = `${API}/api/v1/public/auth/me`;

describe('resolveAuthSession (BETA-71 parallel fetch)', () => {
    it('returns authenticated state with permissions for a valid session', async () => {
        // Arrange
        server.use(
            http.get(SESSION_URL, () =>
                HttpResponse.json({
                    user: {
                        id: 'u1',
                        role: 'ADMIN',
                        name: 'Ada',
                        email: 'ada@x.test',
                        emailVerified: true
                    }
                })
            ),
            http.get(ME_URL, () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        actor: { permissions: ['ACCESS_PANEL_ADMIN'] },
                        passwordChangeRequired: false
                    }
                })
            )
        );

        // Act
        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        // Assert
        expect(result.isAuthenticated).toBe(true);
        expect(result.userId).toBe('u1');
        expect(result.role).toBe('ADMIN');
        expect(result.permissions).toEqual(['ACCESS_PANEL_ADMIN']);
        expect(result.emailVerified).toBe(true);
    });

    it('returns unauthenticated when get-session is not ok', async () => {
        server.use(
            http.get(SESSION_URL, () => new HttpResponse(null, { status: 401 })),
            http.get(ME_URL, () =>
                HttpResponse.json({ success: true, data: { actor: { permissions: ['X'] } } })
            )
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: '' });

        expect(result.isAuthenticated).toBe(false);
        expect(result.permissions).toEqual([]);
    });

    it('SECURITY: ignores /auth/me permissions when the session has no user', async () => {
        // The parallel /auth/me runs even for an invalid session — it must NOT
        // leak permissions when get-session returns no user.
        server.use(
            http.get(SESSION_URL, () => HttpResponse.json({})),
            http.get(ME_URL, () =>
                HttpResponse.json({
                    success: true,
                    data: { actor: { permissions: ['ACCESS_PANEL_ADMIN'] } }
                })
            )
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=stale' });

        expect(result.isAuthenticated).toBe(false);
        expect(result.userId).toBeNull();
        expect(result.permissions).toEqual([]);
    });

    it('is non-fatal when /auth/me responds with an error status', async () => {
        server.use(
            http.get(SESSION_URL, () => HttpResponse.json({ user: { id: 'u2' } })),
            http.get(ME_URL, () => new HttpResponse(null, { status: 500 }))
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.isAuthenticated).toBe(true);
        expect(result.userId).toBe('u2');
        expect(result.permissions).toEqual([]);
        expect(result.passwordChangeRequired).toBe(false);
    });

    it('is non-fatal when /auth/me network-errors (rejected fetch)', async () => {
        server.use(
            http.get(SESSION_URL, () => HttpResponse.json({ user: { id: 'u3' } })),
            http.get(ME_URL, () => HttpResponse.error())
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.isAuthenticated).toBe(true);
        expect(result.userId).toBe('u3');
        expect(result.permissions).toEqual([]);
    });

    it('propagates the password-change flag from /auth/me', async () => {
        server.use(
            http.get(SESSION_URL, () => HttpResponse.json({ user: { id: 'u4' } })),
            http.get(ME_URL, () =>
                HttpResponse.json({
                    success: true,
                    data: { actor: { permissions: [] }, passwordChangeRequired: true }
                })
            )
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.isAuthenticated).toBe(true);
        expect(result.passwordChangeRequired).toBe(true);
    });
});
