/**
 * HOS-2184 T-029 — the OAuth 2.1 flow and the MCP endpoint, end to end, in one process.
 *
 * One journey, as a hosted AI client lives it: discovery -> client
 * registration (DCR, then a CIMD client) -> sign-in -> authorize with PKCE ->
 * consent -> token (with `resource`) -> `/mcp` initialize -> `tools/list` ->
 * a read tool call -> refresh -> the user disconnects the assistant from the
 * account panel -> `/mcp` answers 401 and the refresh token is dead.
 *
 * REAL: `initApp()` (the whole middleware stack and routing), the Better Auth
 * instance built by `lib/auth` with every hook in it and the `jwt`,
 * `oauthProvider` and `cimd` plugins from `buildMcpOAuthConfig`, email and
 * password sign-up and sign-in, the session cookie, `/oauth2/register`,
 * `/oauth2/authorize`, `/oauth2/consent`, `/oauth2/token`, the signed JWT
 * access token, `mcpAuthMiddleware` with its production dependencies
 * (default verifier, `findActiveMcpGrant` reading the consent through the
 * adapter), the Streamable HTTP handler and SDK, the tool registry, the
 * discovery routes, the protected `ai-connections` route and the real
 * `AiConnectionService`.
 *
 * MOCKED (outer boundaries only):
 * - storage: Better Auth's in-memory adapter replaces Drizzle (the schema
 *   mapping has its own tests, the SQL its own db integration test), and
 *   `OauthConnectionModel` is a memory stand-in with the same operations;
 * - `getDb()`: answers only the bearer middleware's user lookup;
 * - `buildActorForUser` (the `/mcp` bearer path and the HOS-2562 real-client
 *   guard) and `getUserRoles` (the session path): a fixed HOST actor holding
 *   `accommodation.create` for the real user id (their own suites cover them);
 * - the two `auth.ts` hooks that read the user tables (deleted-user guard,
 *   baseline role);
 * - the CIMD metadata fetch (`safeExternalFetch` resolves public DNS and pins the IP);
 * - the listing services behind `list_my_listings` (prototype spies);
 * - `recordMcpToolCall` (it writes the audit row).
 */

import type { Actor } from '@repo/service-core';
import { AccommodationService, ExperienceService, VenueService } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { actorState, CIMD_CLIENT_ID, cimdFetchSpy } = vi.hoisted(() => ({
    actorState: { userId: '' },
    CIMD_CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
    cimdFetchSpy: { calls: [] as string[] }
}));

vi.mock('better-auth/adapters/drizzle', async () => {
    const { createMemoryDrizzleAdapter } = await import('../../helpers/mcp-real-auth');
    return { drizzleAdapter: createMemoryDrizzleAdapter };
});
vi.mock('../../../src/lib/auth-mcp-oauth-schema', () => ({ getMcpOAuthAdapterSchema: () => ({}) }));
vi.mock('../../../src/lib/auth-deleted-user-guard', async () => {
    const { deletedUserGuardMock } = await import('../../helpers/mcp-real-auth');
    return deletedUserGuardMock;
});
vi.mock('../../../src/lib/auth-signup-baseline-role', async () => {
    const { baselineRoleMock } = await import('../../helpers/mcp-real-auth');
    return baselineRoleMock;
});
vi.mock('@repo/db', async () => {
    const { createRealAuthDbMock } = await import('../../helpers/mcp-real-auth');
    return createRealAuthDbMock();
});
vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));
vi.mock('../../../src/middlewares/actor', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/middlewares/actor')>()),
    buildActorForUser: vi.fn(
        async () =>
            ({
                id: actorState.userId,
                roles: ['HOST'],
                // HOS-2562: a real client (a business vertical), so the OAuth
                // flow and `/mcp` let them through. The tourist journey is in
                // `mcp-oauth-real-client.test.ts`.
                permissions: ['accommodation.create'],
                emailVerified: true
            }) as unknown as Actor
    )
}));
// The session middleware reads the user's roles (user_role table) before building the actor.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    getUserRoles: vi.fn(async () => ['HOST'])
}));
vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: async ({ url }: { url: string }) => {
        cimdFetchSpy.calls.push(url);
        if (url !== CIMD_CLIENT_ID) {
            return { ok: false, status: 0, error: 'not found', blocked: true };
        }
        return {
            ok: true,
            status: 200,
            finalUrl: url,
            body: JSON.stringify({
                client_id: CIMD_CLIENT_ID,
                client_name: 'Claude (CIMD)',
                redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code']
            })
        };
    }
}));

import { initApp } from '../../../src/app';
import { getAuth, resetAuth } from '../../../src/lib/auth';
import { env, validateApiEnv } from '../../../src/utils/env';
import {
    authMemoryStore,
    createPkcePair,
    dbLiveUser,
    readJsonRpc,
    resetAuthMemoryStore,
    toCookieHeader
} from '../../helpers/mcp-real-auth';

const API = 'http://localhost:3001';
const RESOURCE = `${API}/mcp`;
const ISSUER = `${API}/api/auth`;
const REDIRECT_URI = 'http://127.0.0.1:5555/callback';
const EMAIL = 'ana.owner@example.com';
const PASSWORD = ['Password', '123!'].join('');
const MCP_PROTOCOL_VERSION = '2025-06-18';

/** What the journey carries from step to step. */
const journey = {
    cookie: '',
    userId: '',
    clientId: '',
    accessToken: '',
    refreshToken: '',
    rotatedAccessToken: '',
    rotatedRefreshToken: ''
};

interface TokenResponse {
    readonly access_token: string;
    readonly refresh_token?: string;
    readonly token_type: string;
    readonly expires_in: number;
    readonly scope?: string;
    readonly error?: string;
}

const app = () => initApp();

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
    return app().request(`${API}${path}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            origin: API,
            ...headers
        },
        body: JSON.stringify(body)
    });
}

async function postToken(form: Record<string, string>): Promise<Response> {
    return app().request(`${ISSUER}/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'vitest' },
        body: new URLSearchParams(form)
    });
}

interface AuthorizeInput {
    readonly clientId: string;
    readonly redirectUri: string;
    readonly challenge: string;
    /** Whether this is the user's first authorization of the client (consent screen expected). */
    readonly firstTime?: boolean;
}

/**
 * Authorize + consent with the signed-in user; returns the authorization code.
 * Once a consent is stored the provider skips the consent screen and answers
 * with the code directly, which is what a returning client sees.
 */
async function authorizeAndConsent(input: AuthorizeInput): Promise<string> {
    const query = new URLSearchParams({
        response_type: 'code',
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
        scope: 'openid offline_access',
        state: 'state-1',
        code_challenge: input.challenge,
        code_challenge_method: 'S256',
        resource: RESOURCE
    });
    const authorize = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
        headers: { cookie: journey.cookie, 'user-agent': 'vitest' }
    });
    expect(authorize.status, await authorize.clone().text()).toBe(302);
    const location = new URL(authorize.headers.get('location') as string);

    let callback = location;
    if (`${location.origin}${location.pathname}` === input.redirectUri) {
        expect(input.firstTime).not.toBe(true);
    } else {
        // No stored consent yet: the user is sent to the web consent page.
        expect(`${location.origin}${location.pathname}`).toBe(
            `${env.HOSPEDA_SITE_URL}/es/auth/consent/`
        );
        const consent = await postJson(
            '/api/auth/oauth2/consent',
            { accept: true, oauth_query: location.search.slice(1) },
            { cookie: journey.cookie }
        );
        expect(consent.status).toBe(200);
        callback = new URL(((await consent.json()) as { url: string }).url);
    }
    expect(`${callback.origin}${callback.pathname}`).toBe(input.redirectUri);
    expect(callback.searchParams.get('state')).toBe('state-1');
    // RFC 9207: ChatGPT requires the issuer on the authorization response.
    expect(callback.searchParams.get('iss')).toBe(ISSUER);
    return callback.searchParams.get('code') as string;
}

let rpcId = 0;

async function mcp(input: {
    readonly token?: string;
    readonly method: string;
    readonly params?: Record<string, unknown>;
}): Promise<Response> {
    rpcId += 1;
    return app().request(`${API}/mcp`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': MCP_PROTOCOL_VERSION,
            ...(input.token ? { authorization: `Bearer ${input.token}` } : {})
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: rpcId,
            method: input.method,
            params: input.params ?? {}
        })
    });
}

describe('OAuth + MCP, end to end', () => {
    const original = {
        enabled: undefined as boolean | undefined,
        resourceUrl: undefined as string | undefined,
        disableAuth: undefined as boolean | undefined,
        allowMockActor: undefined as boolean | undefined
    };

    beforeAll(async () => {
        validateApiEnv();
        original.enabled = env.HOSPEDA_MCP_ENABLED;
        original.resourceUrl = env.HOSPEDA_MCP_RESOURCE_URL;
        original.disableAuth = env.HOSPEDA_DISABLE_AUTH;
        original.allowMockActor = env.HOSPEDA_ALLOW_MOCK_ACTOR;
        env.HOSPEDA_MCP_ENABLED = true;
        env.HOSPEDA_MCP_RESOURCE_URL = RESOURCE;
        // The account panel route must see the REAL session, not the test-mode
        // mock session/actor (which a non-CI run would otherwise inject).
        env.HOSPEDA_DISABLE_AUTH = false;
        env.HOSPEDA_ALLOW_MOCK_ACTOR = false;
        resetAuth();
        resetAuthMemoryStore();
        await getAuth().$context;

        // A user who signed up and verified their email.
        const signUp = await postJson('/api/auth/sign-up/email', {
            email: EMAIL,
            password: PASSWORD,
            name: 'Ana Owner'
        });
        expect(signUp.status, await signUp.clone().text()).toBe(200);
        const user = (authMemoryStore.user as Record<string, unknown>[])[0] as Record<
            string,
            unknown
        >;
        user.emailVerified = true;
        journey.userId = user.id as string;
        actorState.userId = journey.userId;
        dbLiveUser.current = {
            id: journey.userId,
            name: 'Ana Owner',
            email: EMAIL,
            image: null,
            emailVerified: true,
            mustChangePassword: false,
            deletedAt: null,
            banned: false,
            banExpires: null
        };
        const signIn = await postJson('/api/auth/sign-in/email', {
            email: EMAIL,
            password: PASSWORD
        });
        expect(signIn.status).toBe(200);
        journey.cookie = toCookieHeader(signIn);
    });

    afterAll(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.resourceUrl;
        env.HOSPEDA_DISABLE_AUTH = original.disableAuth as boolean;
        env.HOSPEDA_ALLOW_MOCK_ACTOR = original.allowMockActor as boolean;
        dbLiveUser.current = null;
        resetAuth();
        vi.restoreAllMocks();
    });

    describe('discovery', () => {
        it('answers 401 with a resource_metadata challenge to an unauthenticated /mcp call', async () => {
            const res = await mcp({ method: 'initialize' });

            expect(res.status).toBe(401);
            expect(res.headers.get('WWW-Authenticate')).toBe(
                `Bearer resource_metadata="${API}/.well-known/oauth-protected-resource/mcp"`
            );
        });

        it('serves the protected-resource metadata pointing at the authorization server', async () => {
            const res = await app().request(`${API}/.well-known/oauth-protected-resource/mcp`);
            const body = (await res.json()) as Record<string, unknown>;

            expect(res.status).toBe(200);
            expect(body.resource).toBe(RESOURCE);
            expect(body.authorization_servers).toEqual([ISSUER]);
        });

        it('serves the authorization-server metadata with PKCE S256, DCR and CIMD', async () => {
            const res = await app().request(
                `${API}/.well-known/oauth-authorization-server/api/auth`
            );
            const body = (await res.json()) as Record<string, unknown>;

            expect(res.status).toBe(200);
            expect(body.issuer).toBe(ISSUER);
            expect(body.authorization_endpoint).toBe(`${ISSUER}/oauth2/authorize`);
            expect(body.token_endpoint).toBe(`${ISSUER}/oauth2/token`);
            expect(body.registration_endpoint).toBe(`${ISSUER}/oauth2/register`);
            expect(body.code_challenge_methods_supported).toEqual(['S256']);
            expect(body.client_id_metadata_document_supported).toBe(true);
            expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
            expect(body.authorization_response_iss_parameter_supported).toBe(true);
        });
    });

    describe('client registration', () => {
        it('registers a public client dynamically (DCR) for an allowed loopback redirect', async () => {
            const res = await postJson('/api/auth/oauth2/register', {
                client_name: 'Claude Code',
                redirect_uris: [REDIRECT_URI],
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                scope: 'openid offline_access'
            });
            const body = (await res.json()) as { client_id: string; client_secret?: string };

            expect(res.status).toBe(201);
            expect(body.client_id).toBeTruthy();
            expect(body.client_secret).toBeUndefined();
            journey.clientId = body.client_id;
        });

        it.each([
            ['Claude', ['https://claude.ai/api/mcp/auth_callback']],
            ['Claude (claude.com)', ['https://claude.com/api/mcp/auth_callback']],
            ['ChatGPT', ['https://chatgpt.com/connector_platform_oauth_redirect']],
            [
                'several allowed at once',
                ['https://claude.ai/api/mcp/auth_callback', 'http://localhost:33418/callback']
            ]
        ])('registers a %s client', async (_label, redirectUris) => {
            const res = await postJson('/api/auth/oauth2/register', {
                client_name: 'Hosted client',
                redirect_uris: redirectUris,
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code'],
                response_types: ['code']
            });

            expect(res.status, await res.clone().text()).toBe(201);
        });

        it('refuses the whole registration when one of several redirect URIs is off the allowlist', async () => {
            const before = (authMemoryStore.oauthClient as unknown[]).length;

            const res = await postJson('/api/auth/oauth2/register', {
                client_name: 'Phisher',
                redirect_uris: [
                    'https://claude.ai/api/mcp/auth_callback',
                    'https://evil.example/cb'
                ],
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code'],
                response_types: ['code']
            });

            expect(res.status).toBe(400);
            expect(((await res.json()) as { error: string }).error).toBe('invalid_redirect_uri');
            expect((authMemoryStore.oauthClient as unknown[]).length).toBe(before);
        });

        it.each([
            'https://evil.example/callback',
            'http://claude.ai/api/mcp/auth_callback',
            'https://claude.ai.evil.example/api/mcp/auth_callback',
            'http://192.168.1.10:8080/callback'
        ])('refuses to register %s', async (redirectUri) => {
            const before = (authMemoryStore.oauthClient as unknown[]).length;

            const res = await postJson('/api/auth/oauth2/register', {
                client_name: 'Phisher',
                redirect_uris: [redirectUri],
                token_endpoint_auth_method: 'none'
            });

            expect(res.status).toBe(400);
            expect(((await res.json()) as { error: string }).error).toBe('invalid_redirect_uri');
            expect((authMemoryStore.oauthClient as unknown[]).length).toBe(before);
        });

        it('still never authorizes a redirect off the allowlist for a client registered before the guard', async () => {
            // A row that predates the guard (or came in through CIMD).
            (authMemoryStore.oauthClient as Record<string, unknown>[]).push({
                id: 'legacy-row',
                clientId: 'legacy-client',
                redirectUris: ['https://evil.example/callback'],
                public: true,
                disabled: false,
                grantTypes: ['authorization_code'],
                responseTypes: ['code'],
                tokenEndpointAuthMethod: 'none'
            });
            const query = new URLSearchParams({
                response_type: 'code',
                client_id: 'legacy-client',
                redirect_uri: 'https://evil.example/callback',
                scope: 'openid',
                state: 'state-1',
                code_challenge: createPkcePair().challenge,
                code_challenge_method: 'S256',
                resource: RESOURCE
            });

            const res = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
                headers: { cookie: journey.cookie, 'user-agent': 'vitest' }
            });

            expect(res.headers.get('location') ?? '').not.toContain('evil.example');
            expect(res.headers.get('location') ?? '').not.toContain('code=');
        });
    });

    describe('authorization and token', () => {
        it('refuses an authorization request without PKCE', async () => {
            const query = new URLSearchParams({
                response_type: 'code',
                client_id: journey.clientId,
                redirect_uri: REDIRECT_URI,
                scope: 'openid offline_access',
                state: 'state-1',
                resource: RESOURCE
            });

            const res = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
                headers: { cookie: journey.cookie, 'user-agent': 'vitest' }
            });

            // The error comes back to the client's redirect URI, never as a code.
            expect(res.headers.get('location') ?? '').not.toContain('code=');
            expect(res.headers.get('location') ?? '').toContain('error=');
        });

        it('sends an unauthenticated user to the web sign-in page', async () => {
            const { challenge } = createPkcePair();
            const query = new URLSearchParams({
                response_type: 'code',
                client_id: journey.clientId,
                redirect_uri: REDIRECT_URI,
                scope: 'openid offline_access',
                state: 'state-1',
                code_challenge: challenge,
                code_challenge_method: 'S256',
                resource: RESOURCE
            });

            const res = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
                headers: { 'user-agent': 'vitest' }
            });

            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain(
                `${env.HOSPEDA_SITE_URL}/es/auth/signin/`
            );
        });

        it('runs authorize with consent and exchanges the code for a JWT bound to /mcp', async () => {
            const pkce = createPkcePair();
            const code = await authorizeAndConsent({
                clientId: journey.clientId,
                redirectUri: REDIRECT_URI,
                challenge: pkce.challenge,
                firstTime: true
            });

            const wrongVerifier = await postToken({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                client_id: journey.clientId,
                code_verifier: createPkcePair().verifier,
                resource: RESOURCE
            });
            expect(wrongVerifier.status).toBeGreaterThanOrEqual(400);

            // A failed exchange burns the code: take a fresh one for the real exchange.
            const freshPkce = createPkcePair();
            const freshCode = await authorizeAndConsent({
                clientId: journey.clientId,
                redirectUri: REDIRECT_URI,
                challenge: freshPkce.challenge
            });
            const res = await postToken({
                grant_type: 'authorization_code',
                code: freshCode,
                redirect_uri: REDIRECT_URI,
                client_id: journey.clientId,
                code_verifier: freshPkce.verifier,
                resource: RESOURCE
            });
            const token = (await res.json()) as TokenResponse;

            expect(res.status, JSON.stringify(token)).toBe(200);
            expect(token.token_type.toLowerCase()).toBe('bearer');
            expect(token.refresh_token).toBeTruthy();
            expect(token.scope).toContain('offline_access');
            const payload = JSON.parse(
                Buffer.from(token.access_token.split('.')[1] as string, 'base64url').toString()
            ) as Record<string, unknown>;
            expect(payload.sub).toBe(journey.userId);
            expect([payload.aud].flat()).toContain(RESOURCE);
            expect(payload.iss).toBe(ISSUER);
            expect(payload.azp ?? payload.client_id).toBe(journey.clientId);
            journey.accessToken = token.access_token;
            journey.refreshToken = token.refresh_token as string;
        });

        it('refuses to replay an authorization code', async () => {
            const pkce = createPkcePair();
            const code = await authorizeAndConsent({
                clientId: journey.clientId,
                redirectUri: REDIRECT_URI,
                challenge: pkce.challenge
            });
            const form = {
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                client_id: journey.clientId,
                code_verifier: pkce.verifier,
                resource: RESOURCE
            };
            expect((await postToken(form)).status).toBe(200);

            const replay = await postToken(form);

            expect(replay.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('/mcp with the issued token', () => {
        it('initializes the MCP session', async () => {
            const res = await mcp({
                token: journey.accessToken,
                method: 'initialize',
                params: {
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: {},
                    clientInfo: { name: 'e2e-client', version: '0.0.0' }
                }
            });
            const message = await readJsonRpc<{
                result?: { serverInfo?: { name?: string }; protocolVersion?: string };
            }>(res);

            expect(res.status).toBe(200);
            expect(message.result?.protocolVersion).toBeTruthy();
            expect(message.result?.serverInfo?.name).toBeTruthy();
        });

        it('lists the Hospeda tools', async () => {
            const res = await mcp({ token: journey.accessToken, method: 'tools/list' });
            const message = await readJsonRpc<{ result?: { tools?: { name: string }[] } }>(res);

            expect(res.status).toBe(200);
            expect(message.result?.tools?.map((tool) => tool.name)).toEqual(
                expect.arrayContaining(['list_my_listings', 'get_listing', 'reply_inquiry'])
            );
        });

        it('serves a read tool call for the token subject', async () => {
            const list = vi.spyOn(AccommodationService.prototype, 'list').mockResolvedValue({
                data: {
                    items: [
                        {
                            id: 'a1111111-1111-4111-8111-111111111111',
                            name: 'Cabañas del Río',
                            publicationStatus: 'PUBLISHED'
                        }
                    ],
                    total: 1
                }
            } as unknown as Awaited<ReturnType<AccommodationService['list']>>);
            vi.spyOn(VenueService.prototype, 'listOwn').mockResolvedValue({
                data: { listings: [] }
            } as unknown as Awaited<ReturnType<VenueService['listOwn']>>);
            vi.spyOn(ExperienceService.prototype, 'listOwn').mockResolvedValue({
                data: { listings: [] }
            } as unknown as Awaited<ReturnType<ExperienceService['listOwn']>>);

            const res = await mcp({
                token: journey.accessToken,
                method: 'tools/call',
                params: { name: 'list_my_listings', arguments: {} }
            });
            const message = await readJsonRpc<{
                result?: { content?: { text: string }[]; isError?: boolean };
            }>(res);

            expect(res.status).toBe(200);
            expect(message.result?.isError).toBeUndefined();
            expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
                listings: [
                    {
                        id: 'a1111111-1111-4111-8111-111111111111',
                        vertical: 'accommodation',
                        name: 'Cabañas del Río',
                        publicationStatus: 'PUBLISHED'
                    }
                ],
                total: 1,
                hasMore: false
            });
            expect(list).toHaveBeenCalledWith(
                expect.objectContaining({ id: journey.userId }),
                expect.objectContaining({ where: { ownerId: journey.userId } })
            );
        });

        it('rejects a token whose signature was tampered with', async () => {
            const [header, payload] = journey.accessToken.split('.');
            const forged = `${header}.${payload}.${'A'.repeat(86)}`;

            const res = await mcp({ token: forged, method: 'tools/list' });

            expect(res.status).toBe(401);
            expect(res.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
        });
    });

    describe('refresh', () => {
        it('rotates the refresh token and the new access token works on /mcp', async () => {
            const res = await postToken({
                grant_type: 'refresh_token',
                refresh_token: journey.refreshToken,
                client_id: journey.clientId,
                resource: RESOURCE
            });
            const token = (await res.json()) as TokenResponse;

            expect(res.status).toBe(200);
            expect(token.refresh_token).toBeTruthy();
            expect(token.refresh_token).not.toBe(journey.refreshToken);
            journey.rotatedAccessToken = token.access_token;
            journey.rotatedRefreshToken = token.refresh_token as string;
            const call = await mcp({ token: journey.rotatedAccessToken, method: 'tools/list' });
            expect(call.status).toBe(200);
        });
    });

    describe('the account panel', () => {
        it('lists the connection and revokes it with the session of the user', async () => {
            const listRes = await app().request(`${API}/api/v1/protected/ai-connections`, {
                headers: {
                    cookie: journey.cookie,
                    accept: 'application/json',
                    'user-agent': 'vitest'
                }
            });
            expect(listRes.status).toBe(200);
            const listed = (await listRes.json()) as {
                data: { items: { clientId: string; name: string | null }[] };
            };
            expect(listed.data.items.map((item) => item.clientId)).toEqual([journey.clientId]);

            const revoke = await app().request(
                `${API}/api/v1/protected/ai-connections?clientId=${encodeURIComponent(journey.clientId)}`,
                {
                    method: 'DELETE',
                    headers: {
                        cookie: journey.cookie,
                        accept: 'application/json',
                        'user-agent': 'vitest',
                        origin: API
                    }
                }
            );

            expect(revoke.status).toBe(204);
        });
    });

    describe('after the revoke (AC-11)', () => {
        it('answers 401 on /mcp to both access tokens the client still holds', async () => {
            for (const token of [journey.accessToken, journey.rotatedAccessToken]) {
                const res = await mcp({ token, method: 'tools/list' });

                expect(res.status).toBe(401);
                expect(res.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
            }
        });

        it('refuses to refresh', async () => {
            const res = await postToken({
                grant_type: 'refresh_token',
                refresh_token: journey.rotatedRefreshToken,
                client_id: journey.clientId,
                resource: RESOURCE
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(((await res.json()) as TokenResponse).access_token).toBeUndefined();
        });

        it('no longer lists the connection, and a second revoke is a 404', async () => {
            const listRes = await app().request(`${API}/api/v1/protected/ai-connections`, {
                headers: {
                    cookie: journey.cookie,
                    accept: 'application/json',
                    'user-agent': 'vitest'
                }
            });
            const listed = (await listRes.json()) as { data: { items: unknown[] } };
            expect(listed.data.items).toEqual([]);

            const again = await app().request(
                `${API}/api/v1/protected/ai-connections?clientId=${encodeURIComponent(journey.clientId)}`,
                {
                    method: 'DELETE',
                    headers: {
                        cookie: journey.cookie,
                        accept: 'application/json',
                        'user-agent': 'vitest',
                        origin: API
                    }
                }
            );
            expect(again.status).toBe(404);
        });

        it('lets the same client connect again with a fresh consent', async () => {
            const pkce = createPkcePair();
            const code = await authorizeAndConsent({
                clientId: journey.clientId,
                redirectUri: REDIRECT_URI,
                challenge: pkce.challenge
            });
            const res = await postToken({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                client_id: journey.clientId,
                code_verifier: pkce.verifier,
                resource: RESOURCE
            });
            const token = (await res.json()) as TokenResponse;

            expect(res.status).toBe(200);
            expect((await mcp({ token: token.access_token, method: 'tools/list' })).status).toBe(
                200
            );
        });
    });

    describe('a CIMD client (metadata document as client_id)', () => {
        it('resolves the document, runs the flow and is served on /mcp', async () => {
            const redirectUri = 'https://claude.ai/api/mcp/auth_callback';
            const pkce = createPkcePair();
            const code = await authorizeAndConsent({
                clientId: CIMD_CLIENT_ID,
                redirectUri,
                challenge: pkce.challenge,
                firstTime: true
            });

            const res = await postToken({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: CIMD_CLIENT_ID,
                code_verifier: pkce.verifier,
                resource: RESOURCE
            });
            const token = (await res.json()) as TokenResponse;

            expect(res.status).toBe(200);
            const call = await mcp({ token: token.access_token, method: 'tools/list' });
            expect(call.status).toBe(200);
            const clients = authMemoryStore.oauthClient as { clientId: string; name?: string }[];
            expect(clients.find((client) => client.clientId === CIMD_CLIENT_ID)?.name).toBe(
                'Claude (CIMD)'
            );
        });

        it.each([
            'https://evil.example/oauth/client.json',
            'http://claude.ai/oauth/mcp-client-metadata',
            'https://169.254.169.254/latest/meta-data',
            'https://10.0.0.5/client.json'
        ])('refuses %s before any metadata fetch', async (clientId) => {
            cimdFetchSpy.calls.length = 0;
            const query = new URLSearchParams({
                response_type: 'code',
                client_id: clientId,
                redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
                scope: 'openid offline_access',
                state: 'state-1',
                code_challenge: createPkcePair().challenge,
                code_challenge_method: 'S256',
                resource: RESOURCE
            });

            const res = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
                headers: { cookie: journey.cookie, 'user-agent': 'vitest' }
            });

            expect(cimdFetchSpy.calls).toEqual([]);
            const location = res.headers.get('location') ?? '';
            expect(location.startsWith('https://claude.ai/api/mcp/auth_callback?code=')).toBe(
                false
            );
        });
    });
});
