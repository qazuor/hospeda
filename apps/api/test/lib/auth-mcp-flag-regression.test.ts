/**
 * HOS-2184 T-031, AC-13 — the existing auth flows survive the MCP plugins.
 *
 * The REAL Better Auth instance built by `lib/auth` (every option, hook and
 * plugin of `buildAuth`) is exercised twice, with `HOSPEDA_MCP_ENABLED` off and
 * on, over Better Auth's in-memory adapter (the Drizzle schema mapping and the
 * SQL have their own tests). The two runs are compared, so a flag-on
 * difference in what web, admin and mobile see fails here:
 *
 * - email/password sign-up, sign-in (good and wrong password), session read,
 *   sign-out;
 * - the session cookies (names and attributes) and the absence of any new
 *   response header on session reads (`set-auth-jwt`);
 * - the `session.create.before` hook still stamps `authMethod`;
 * - the social providers (Google, Facebook) still configured and redirecting
 *   to the same callback URLs;
 * - every pre-existing Better Auth endpoint (path and methods, the admin and
 *   expo plugins included) is still there; the new endpoints sit under
 *   `/oauth2/*`, `/jwks`, `/.well-known/*` and the like, and shadow nothing;
 * - with the flag off none of the OAuth endpoints exist, through `initApp` too.
 *
 * Mocked: the storage (memory adapter), `getDb()`, the two hooks that read the
 * user tables (deleted-user guard, baseline role) and the outgoing email.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('better-auth/adapters/drizzle', async () => {
    const { createMemoryDrizzleAdapter } = await import('../helpers/mcp-real-auth');
    return { drizzleAdapter: createMemoryDrizzleAdapter };
});
vi.mock('../../src/lib/auth-mcp-oauth-schema', () => ({ getMcpOAuthAdapterSchema: () => ({}) }));
vi.mock('../../src/lib/auth-deleted-user-guard', async () => {
    const { deletedUserGuardMock } = await import('../helpers/mcp-real-auth');
    return deletedUserGuardMock;
});
vi.mock('../../src/lib/auth-signup-baseline-role', async () => {
    const { baselineRoleMock } = await import('../helpers/mcp-real-auth');
    return baselineRoleMock;
});
vi.mock('@repo/db', async () => {
    const { createRealAuthDbMock } = await import('../helpers/mcp-real-auth');
    return createRealAuthDbMock();
});
vi.mock('../../src/utils/email-sender', () => ({
    sendAppEmail: vi.fn(async () => ({ success: true }))
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    getUserRoles: vi.fn(async () => ['USER'])
}));
vi.mock('@better-auth/cimd/node', () => ({
    fetchClientMetadataResource: async () => new Response('not found', { status: 404 })
}));

import { initApp } from '../../src/app';
import { getAuth, resetAuth } from '../../src/lib/auth';
import { env, validateApiEnv } from '../../src/utils/env';
import { authMemoryStore, resetAuthMemoryStore, toCookieHeader } from '../helpers/mcp-real-auth';

const API = 'http://localhost:3001';
const AUTH = `${API}/api/auth`;
const EMAIL = 'maria.sanchez@example.com';
const PASSWORD = ['Password', '123!'].join('');

/** Cookie attributes without the value, so two runs compare. */
interface CookieShape {
    readonly name: string;
    readonly attributes: readonly string[];
}

interface Endpoint {
    readonly path: string;
    readonly methods: readonly string[];
}

/** Everything one run of the auth flows produced. */
interface Run {
    readonly signUpStatus: number;
    readonly signInStatus: number;
    readonly signInCookies: readonly CookieShape[];
    readonly sessionStatus: number;
    readonly sessionEmail: string | undefined;
    readonly sessionHeaderNames: readonly string[];
    readonly storedSessionAuthMethod: unknown;
    readonly wrongPassword: { readonly status: number; readonly code: string | undefined };
    readonly signOutStatus: number;
    readonly signOutClearedCookies: readonly string[];
    readonly sessionRowsAfterSignOut: number;
    readonly endpoints: readonly Endpoint[];
    readonly socialRedirects: Readonly<Record<string, string | null>>;
    readonly oauthRouteStatuses: Readonly<Record<string, number>>;
    /** `skipConsent` of a client a plain user created asking for it (flag on only). */
    readonly createdClientSkipsConsent: unknown;
}

const OAUTH_ROUTES = [
    ['GET', '/oauth2/authorize'],
    ['POST', '/oauth2/token'],
    ['POST', '/oauth2/register'],
    ['POST', '/oauth2/consent'],
    ['GET', '/jwks'],
    ['GET', '/token'],
    ['GET', '/.well-known/oauth-authorization-server'],
    ['GET', '/.well-known/openid-configuration']
] as const;

function cookieShapes(response: Response): CookieShape[] {
    return response.headers.getSetCookie().map((cookie) => {
        const [pair, ...rest] = cookie.split(';').map((part) => part.trim());
        return {
            name: (pair as string).split('=')[0] as string,
            attributes: rest.map((attribute) => attribute.toLowerCase()).sort()
        };
    });
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
    return getAuth().handler(
        new Request(`${AUTH}${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: API, ...headers },
            body: JSON.stringify(body)
        })
    );
}

async function exercise(enabled: boolean): Promise<Run> {
    env.HOSPEDA_MCP_ENABLED = enabled;
    env.HOSPEDA_MCP_RESOURCE_URL = enabled ? `${API}/mcp` : undefined;
    resetAuth();
    resetAuthMemoryStore();
    const auth = getAuth();
    await auth.$context;

    const signUp = await post('/sign-up/email', {
        email: EMAIL,
        password: PASSWORD,
        name: 'Maria Sanchez'
    });
    for (const user of authMemoryStore.user as Record<string, unknown>[]) {
        user.emailVerified = true;
    }
    const signIn = await post('/sign-in/email', { email: EMAIL, password: PASSWORD });
    const cookie = toCookieHeader(signIn);

    const session = await auth.handler(new Request(`${AUTH}/get-session`, { headers: { cookie } }));
    const sessionBody = (await session.json()) as { user?: { email?: string } } | null;
    const storedSession = (authMemoryStore.session as Record<string, unknown>[])[0];

    const wrong = await post('/sign-in/email', { email: EMAIL, password: 'not-the-password' });
    const wrongBody = (await wrong.json()) as { code?: string };

    const social: Record<string, string | null> = {};
    for (const provider of ['google', 'facebook']) {
        const res = await post('/sign-in/social', { provider, callbackURL: `${API}/done` });
        const body = (await res.json().catch(() => null)) as { url?: string } | null;
        social[provider] = body?.url ?? res.headers.get('location');
    }

    const oauthRouteStatuses: Record<string, number> = {};
    for (const [method, path] of OAUTH_ROUTES) {
        const res = await auth.handler(
            new Request(`${AUTH}${path}`, {
                method,
                ...(method === 'POST'
                    ? { headers: { 'content-type': 'application/json' }, body: '{}' }
                    : {})
            })
        );
        oauthRouteStatuses[`${method} ${path}`] = res.status;
    }

    let createdClientSkipsConsent: unknown;
    if (enabled) {
        const created = await post(
            '/oauth2/create-client',
            {
                client_name: 'Wants to skip consent',
                redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
                token_endpoint_auth_method: 'none',
                skip_consent: true
            },
            { cookie }
        );
        const { client_id: clientId } = (await created.json()) as { client_id: string };
        createdClientSkipsConsent = (authMemoryStore.oauthClient as Record<string, unknown>[]).find(
            (client) => client.clientId === clientId
        )?.skipConsent;
    }

    const signOut = await post('/sign-out', {}, { cookie });

    const endpoints = Object.values(
        auth.api as unknown as Record<
            string,
            { path?: string; options?: { method?: string | string[] } }
        >
    )
        .filter((endpoint) => typeof endpoint.path === 'string')
        .map((endpoint) => ({
            path: endpoint.path as string,
            methods: [endpoint.options?.method ?? 'ALL'].flat().sort()
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

    return {
        signUpStatus: signUp.status,
        signInStatus: signIn.status,
        signInCookies: cookieShapes(signIn),
        sessionStatus: session.status,
        sessionEmail: sessionBody?.user?.email,
        sessionHeaderNames: [...session.headers.keys()].sort(),
        storedSessionAuthMethod: storedSession?.authMethod,
        wrongPassword: { status: wrong.status, code: wrongBody.code },
        signOutStatus: signOut.status,
        signOutClearedCookies: signOut.headers
            .getSetCookie()
            .filter((header) => /max-age=0/i.test(header))
            .map((header) => header.split('=')[0] as string)
            .sort(),
        sessionRowsAfterSignOut: (authMemoryStore.session as unknown[]).length,
        endpoints,
        socialRedirects: social,
        oauthRouteStatuses,
        createdClientSkipsConsent
    };
}

describe('auth flows with the MCP plugins on and off (AC-13)', () => {
    const original = {
        enabled: undefined as boolean | undefined,
        resourceUrl: undefined as string | undefined,
        googleId: undefined as string | undefined,
        googleSecret: undefined as string | undefined,
        facebookId: undefined as string | undefined,
        facebookSecret: undefined as string | undefined,
        disableAuth: undefined as boolean | undefined,
        allowMockActor: undefined as boolean | undefined
    };
    let off: Run;
    let on: Run;

    beforeAll(async () => {
        validateApiEnv();
        original.enabled = env.HOSPEDA_MCP_ENABLED;
        original.resourceUrl = env.HOSPEDA_MCP_RESOURCE_URL;
        original.googleId = env.HOSPEDA_GOOGLE_CLIENT_ID;
        original.googleSecret = env.HOSPEDA_GOOGLE_CLIENT_SECRET;
        original.facebookId = env.HOSPEDA_FACEBOOK_CLIENT_ID;
        original.facebookSecret = env.HOSPEDA_FACEBOOK_CLIENT_SECRET;
        original.disableAuth = env.HOSPEDA_DISABLE_AUTH;
        original.allowMockActor = env.HOSPEDA_ALLOW_MOCK_ACTOR;
        env.HOSPEDA_GOOGLE_CLIENT_ID = 'google-client-id';
        env.HOSPEDA_GOOGLE_CLIENT_SECRET = 'google-client-secret';
        env.HOSPEDA_FACEBOOK_CLIENT_ID = 'facebook-client-id';
        env.HOSPEDA_FACEBOOK_CLIENT_SECRET = 'facebook-client-secret';
        env.HOSPEDA_DISABLE_AUTH = false;
        env.HOSPEDA_ALLOW_MOCK_ACTOR = false;
        off = await exercise(false);
        on = await exercise(true);
    });

    afterAll(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.resourceUrl;
        env.HOSPEDA_GOOGLE_CLIENT_ID = original.googleId;
        env.HOSPEDA_GOOGLE_CLIENT_SECRET = original.googleSecret;
        env.HOSPEDA_FACEBOOK_CLIENT_ID = original.facebookId;
        env.HOSPEDA_FACEBOOK_CLIENT_SECRET = original.facebookSecret;
        env.HOSPEDA_DISABLE_AUTH = original.disableAuth as boolean;
        env.HOSPEDA_ALLOW_MOCK_ACTOR = original.allowMockActor as boolean;
        resetAuth();
    });

    describe.each([
        ['off', () => off],
        ['on', () => on]
    ] as const)('with HOSPEDA_MCP_ENABLED %s', (_label, getRun) => {
        it('signs a user up and in with email and password', () => {
            // Arrange / Act
            const run = getRun();

            // Assert
            expect(run.signUpStatus).toBe(200);
            expect(run.signInStatus).toBe(200);
            expect(run.signInCookies.map((cookie) => cookie.name)).toEqual(
                expect.arrayContaining(['better-auth.session_token'])
            );
        });

        it('reads the session of the signed-in user and the session hook still ran', () => {
            // Arrange / Act
            const run = getRun();

            // Assert
            expect(run.sessionStatus).toBe(200);
            expect(run.sessionEmail).toBe(EMAIL);
            expect(run.storedSessionAuthMethod).toBe('credential');
        });

        it('refuses a wrong password with the same error', () => {
            // Arrange / Act
            const { wrongPassword } = getRun();

            // Assert
            expect(wrongPassword.status).toBe(401);
            expect(wrongPassword.code).toBe('INVALID_EMAIL_OR_PASSWORD');
        });

        it('signs the user out: the session row is deleted and the session cookie is cleared', () => {
            // Arrange / Act
            const run = getRun();

            // Assert
            expect(run.signOutStatus).toBe(200);
            expect(run.sessionRowsAfterSignOut).toBe(0);
            expect(run.signOutClearedCookies).toContain('better-auth.session_token');
        });

        it('keeps Google and Facebook configured, redirecting to their own consent screens', () => {
            // Arrange / Act
            const { socialRedirects } = getRun();

            // Assert
            expect(socialRedirects.google).toContain('accounts.google.com');
            expect(socialRedirects.google).toContain(
                encodeURIComponent(`${API}/api/auth/callback/google`)
            );
            expect(socialRedirects.facebook).toContain('facebook.com');
            expect(socialRedirects.facebook).toContain(
                encodeURIComponent(`${API}/api/auth/callback/facebook`)
            );
        });
    });

    describe('what the flag changes', () => {
        it('leaves the sign-in cookies exactly as they were (names and attributes)', () => {
            // Arrange / Act / Assert
            expect(on.signInCookies).toEqual(off.signInCookies);
        });

        it('adds no response header to a session read (no set-auth-jwt)', () => {
            // Arrange / Act / Assert
            expect(on.sessionHeaderNames).toEqual(off.sessionHeaderNames);
            expect(on.sessionHeaderNames).not.toContain('set-auth-jwt');
        });

        it('answers the same statuses and error code on every existing flow', () => {
            // Arrange / Act / Assert
            expect(on.signOutClearedCookies).toEqual(off.signOutClearedCookies);
            expect({
                signUp: on.signUpStatus,
                signIn: on.signInStatus,
                session: on.sessionStatus,
                wrong: on.wrongPassword,
                signOut: on.signOutStatus,
                social: on.socialRedirects.google?.split('?')[0]
            }).toEqual({
                signUp: off.signUpStatus,
                signIn: off.signInStatus,
                session: off.sessionStatus,
                wrong: off.wrongPassword,
                signOut: off.signOutStatus,
                social: off.socialRedirects.google?.split('?')[0]
            });
        });

        it('keeps every pre-existing endpoint, path and methods (admin and expo plugins included)', () => {
            // Arrange
            const onByPath = new Map(on.endpoints.map((endpoint) => [endpoint.path, endpoint]));

            // Act
            const lost = off.endpoints.filter(
                (endpoint) =>
                    JSON.stringify(onByPath.get(endpoint.path)?.methods) !==
                    JSON.stringify(endpoint.methods)
            );

            // Assert
            expect(off.endpoints.length).toBeGreaterThan(30);
            expect(lost).toEqual([]);
        });

        it('adds endpoints only under the OAuth and JWKS namespaces', () => {
            // Arrange
            const offPaths = new Set(off.endpoints.map((endpoint) => endpoint.path));

            // Act
            const added = on.endpoints
                .map((endpoint) => endpoint.path)
                .filter((path) => !offPaths.has(path));

            // Assert
            expect(added.length).toBeGreaterThan(0);
            expect(
                added.filter(
                    (path) =>
                        !(
                            path.startsWith('/oauth2/') ||
                            path.startsWith('/admin/oauth2/') ||
                            path.startsWith('/.well-known/') ||
                            path === '/jwks' ||
                            path === '/token'
                        )
                )
            ).toEqual([]);
        });

        it('does not serve the JWT plugin /token endpoint (the OAuth one is /oauth2/token)', () => {
            // Arrange / Act / Assert
            expect(on.oauthRouteStatuses['GET /token']).toBe(404);
        });

        it('serves no OAuth endpoint at all with the flag off', () => {
            // Arrange / Act / Assert
            for (const status of Object.values(off.oauthRouteStatuses)) {
                expect(status).toBe(404);
            }
        });

        it('does not let a plain signed-in user create a client that skips the consent screen', () => {
            // Arrange / Act / Assert: the consent row is what AC-11 revokes, so every
            // client must go through it.
            expect(on.createdClientSkipsConsent).toBeFalsy();
        });

        it('serves the OAuth endpoints with the flag on', () => {
            // Arrange / Act / Assert
            for (const [route, status] of Object.entries(on.oauthRouteStatuses)) {
                if (route !== 'GET /token') {
                    expect(status, route).not.toBe(404);
                }
            }
        });
    });

    describe('through the app (initApp), flag off', () => {
        it('still signs in and reads the session, and the OAuth token endpoint is a plain 404', async () => {
            // Arrange
            env.HOSPEDA_MCP_ENABLED = false;
            env.HOSPEDA_MCP_RESOURCE_URL = undefined;
            resetAuth();
            resetAuthMemoryStore();
            await getAuth().$context;
            const app = initApp();
            const headers = {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                origin: API
            };
            await app.request(`${AUTH}/sign-up/email`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Maria Sanchez' })
            });
            for (const user of authMemoryStore.user as Record<string, unknown>[]) {
                user.emailVerified = true;
            }

            // Act
            const signIn = await app.request(`${AUTH}/sign-in/email`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email: EMAIL, password: PASSWORD })
            });
            const session = await app.request(`${AUTH}/get-session`, {
                headers: { cookie: toCookieHeader(signIn), 'user-agent': 'vitest' }
            });
            const token = await app.request(`${AUTH}/oauth2/token`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'authorization_code' })
            });
            const wellKnown = await app.request(`${API}/.well-known/oauth-protected-resource`, {
                headers: { 'user-agent': 'vitest' }
            });

            // Assert
            expect(signIn.status).toBe(200);
            expect(session.status).toBe(200);
            expect(((await session.json()) as { user: { email: string } }).user.email).toBe(EMAIL);
            expect(token.status).toBe(404);
            expect(wellKnown.status).toBe(404);
        });
    });
});
