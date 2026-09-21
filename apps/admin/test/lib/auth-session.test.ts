/**
 * @file auth-session.test.ts
 * @description Unit tests for `resolveAuthSession` (the testable core of the
 * `fetchAuthSession` server function), plus a minimal HOS-33 T-004 regression
 * test pinning the `getWebRequest()` → `getRequest()` rename (TanStack Start
 * >= 1.132.0).
 *
 * BETA-71 parallelized the two upstream calls (`get-session` + `/auth/me`).
 * These tests pin the security-critical invariant that survives that change:
 * permissions from the eagerly-started `/auth/me` are consumed ONLY when the
 * session validates, and a failing `/auth/me` is non-fatal.
 *
 * `@tanstack/react-start` is mocked so `createServerFn(...).handler(fn)`
 * resolves to the raw handler function `fn` — this lets `fetchAuthSession`
 * be invoked directly in a vitest/jsdom environment without booting the
 * TanStack Start server-function RPC machinery.
 */
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../mocks/server';

const getRequestMock = vi.fn();

vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({
        handler: (fn: (...args: unknown[]) => unknown) => fn
    })
}));

vi.mock('@tanstack/react-start/server', () => ({
    getRequest: getRequestMock
}));

const { fetchAuthSession, resolveAuthSession } = await import('@/lib/auth-session');

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
                        actor: { roles: ['ADMIN'], permissions: ['ACCESS_PANEL_ADMIN'] },
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
        expect(result.roles).toEqual(['ADMIN']);
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

    // ─── HOS-609: languageWeb extraction from the session's settings field ───
    it('extracts languageWeb when settings arrives as a plain object', async () => {
        server.use(
            http.get(SESSION_URL, () =>
                HttpResponse.json({ user: { id: 'u6', settings: { languageWeb: 'pt' } } })
            ),
            http.get(ME_URL, () => HttpResponse.json({ success: true, data: { actor: {} } }))
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.languageWeb).toBe('pt');
    });

    it('extracts languageWeb when settings arrives as a JSON string', async () => {
        server.use(
            http.get(SESSION_URL, () =>
                HttpResponse.json({
                    user: { id: 'u7', settings: JSON.stringify({ languageWeb: 'en' }) }
                })
            ),
            http.get(ME_URL, () => HttpResponse.json({ success: true, data: { actor: {} } }))
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.languageWeb).toBe('en');
    });

    it('returns languageWeb=null when settings has no languageWeb', async () => {
        server.use(
            http.get(SESSION_URL, () =>
                HttpResponse.json({ user: { id: 'u8', settings: { themeWeb: 'dark' } } })
            ),
            http.get(ME_URL, () => HttpResponse.json({ success: true, data: { actor: {} } }))
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.languageWeb).toBeNull();
    });

    it('returns languageWeb=null when settings is missing entirely', async () => {
        server.use(
            http.get(SESSION_URL, () => HttpResponse.json({ user: { id: 'u9' } })),
            http.get(ME_URL, () => HttpResponse.json({ success: true, data: { actor: {} } }))
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.languageWeb).toBeNull();
    });

    it('returns languageWeb=null when settings is malformed JSON', async () => {
        server.use(
            http.get(SESSION_URL, () =>
                HttpResponse.json({ user: { id: 'u10', settings: '{not-json' } })
            ),
            http.get(ME_URL, () => HttpResponse.json({ success: true, data: { actor: {} } }))
        );

        const result = await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        expect(result.languageWeb).toBeNull();
    });
});

describe('fetchAuthSession (HOS-33 T-004 — getWebRequest() -> getRequest() rename)', () => {
    // apps/admin/test/setup.tsx sets process.env.HOSPEDA_API_URL to this value.
    const ADMIN_API_URL = 'http://localhost:3001';
    const ADMIN_SESSION_URL = `${ADMIN_API_URL}/api/auth/get-session`;
    const ADMIN_ME_URL = `${ADMIN_API_URL}/api/v1/public/auth/me`;

    beforeEach(() => {
        getRequestMock.mockReset();
    });

    it('reads the cookie header via the renamed getRequest() and returns the resolved auth state', async () => {
        // Arrange
        getRequestMock.mockReturnValue(
            new Request('http://localhost/', { headers: { cookie: 'session=valid' } })
        );
        server.use(
            http.get(ADMIN_SESSION_URL, () =>
                HttpResponse.json({ user: { id: 'u5', role: 'ADMIN', emailVerified: true } })
            ),
            http.get(ADMIN_ME_URL, () =>
                HttpResponse.json({ success: true, data: { actor: { permissions: ['P1'] } } })
            )
        );

        // Act
        const result = await fetchAuthSession();

        // Assert
        expect(getRequestMock).toHaveBeenCalledTimes(1);
        expect(result.isAuthenticated).toBe(true);
        expect(result.userId).toBe('u5');
        expect(result.permissions).toEqual(['P1']);
    });

    it('returns the unauthenticated state when getRequest() yields no request', async () => {
        // Arrange
        getRequestMock.mockReturnValue(undefined);

        // Act
        const result = await fetchAuthSession();

        // Assert
        expect(result.isAuthenticated).toBe(false);
        expect(result.userId).toBeNull();
    });

    it('forwards HOSPEDA_INTERNAL_REQUEST_SECRET from process.env onto both reads (HOS-1153)', async () => {
        // Arrange
        const SECRET = 'an-admin-internal-request-secret-32ch';
        const previous = process.env.HOSPEDA_INTERNAL_REQUEST_SECRET;
        process.env.HOSPEDA_INTERNAL_REQUEST_SECRET = SECRET;
        getRequestMock.mockReturnValue(
            new Request('http://localhost/', { headers: { cookie: 'session=valid' } })
        );
        const seen: Record<string, string | null> = {};
        server.use(
            http.get(ADMIN_SESSION_URL, ({ request }) => {
                seen.session = request.headers.get('x-internal-request');
                return HttpResponse.json({ user: { id: 'u11', emailVerified: true } });
            }),
            http.get(ADMIN_ME_URL, ({ request }) => {
                seen.me = request.headers.get('x-internal-request');
                return HttpResponse.json({ success: true, data: { actor: { permissions: [] } } });
            })
        );

        // Act
        try {
            await fetchAuthSession();
        } finally {
            if (previous === undefined) {
                delete process.env.HOSPEDA_INTERNAL_REQUEST_SECRET;
            } else {
                process.env.HOSPEDA_INTERNAL_REQUEST_SECRET = previous;
            }
        }

        // Assert: BOTH upstream calls carry it, not just the first one.
        expect(seen.session).toBe(SECRET);
        expect(seen.me).toBe(SECRET);
    });
});

/**
 * HOS-1153 — the admin's session reads run server-side, so without this header
 * every operator shares one `proxy:<admin-container-ip>` rate-limit bucket on
 * the API. These pin the header's presence, its absence when unconfigured, and
 * that it never displaces the cookie.
 */
describe('resolveAuthSession internal-request header (HOS-1153)', () => {
    const SECRET = 'a-shared-internal-request-secret-32ch';

    it('attaches X-Internal-Request to get-session AND /auth/me when given a secret', async () => {
        // Arrange
        const seen: Record<string, string | null> = {};
        server.use(
            http.get(SESSION_URL, ({ request }) => {
                seen.session = request.headers.get('x-internal-request');
                return HttpResponse.json({ user: { id: 'u12' } });
            }),
            http.get(ME_URL, ({ request }) => {
                seen.me = request.headers.get('x-internal-request');
                return HttpResponse.json({ success: true, data: { actor: { permissions: [] } } });
            })
        );

        // Act
        await resolveAuthSession({
            apiUrl: API,
            cookieHeader: 'session=valid',
            internalRequestSecret: SECRET
        });

        // Assert
        expect(seen.session).toBe(SECRET);
        expect(seen.me).toBe(SECRET);
    });

    it('omits the header entirely when no secret is configured (fails safe)', async () => {
        // Arrange
        const seen: Record<string, string | null> = {};
        server.use(
            http.get(SESSION_URL, ({ request }) => {
                seen.session = request.headers.get('x-internal-request');
                return HttpResponse.json({ user: { id: 'u13' } });
            }),
            http.get(ME_URL, ({ request }) => {
                seen.me = request.headers.get('x-internal-request');
                return HttpResponse.json({ success: true, data: { actor: { permissions: [] } } });
            })
        );

        // Act
        await resolveAuthSession({ apiUrl: API, cookieHeader: 'session=valid' });

        // Assert
        expect(seen.session).toBeNull();
        expect(seen.me).toBeNull();
    });

    it('omits the header when the secret is an empty string', async () => {
        // Arrange: an empty value is a misconfiguration, not a credential, and
        // the API's comparison would reject it on every single request.
        const seen: Record<string, string | null> = {};
        server.use(
            http.get(SESSION_URL, ({ request }) => {
                seen.session = request.headers.get('x-internal-request');
                return HttpResponse.json({ user: { id: 'u14' } });
            }),
            http.get(ME_URL, ({ request }) => {
                seen.me = request.headers.get('x-internal-request');
                return HttpResponse.json({ success: true, data: { actor: { permissions: [] } } });
            })
        );

        // Act
        await resolveAuthSession({
            apiUrl: API,
            cookieHeader: 'session=valid',
            internalRequestSecret: ''
        });

        // Assert
        expect(seen.session).toBeNull();
        expect(seen.me).toBeNull();
    });

    it('still forwards the cookie alongside the internal-request header', async () => {
        // Arrange: the secret must ADD a header, never replace the cookie —
        // dropping it would resolve every session read as a guest.
        const seen: Record<string, string | null> = {};
        server.use(
            http.get(SESSION_URL, ({ request }) => {
                seen.cookie = request.headers.get('cookie');
                return HttpResponse.json({ user: { id: 'u15' } });
            }),
            http.get(ME_URL, () =>
                HttpResponse.json({ success: true, data: { actor: { permissions: [] } } })
            )
        );

        // Act
        const result = await resolveAuthSession({
            apiUrl: API,
            cookieHeader: 'session=valid',
            internalRequestSecret: SECRET
        });

        // Assert
        expect(seen.cookie).toContain('session=valid');
        expect(result.isAuthenticated).toBe(true);
    });
});
