/**
 * HOS-2562 — AI assistants are only for real clients, end to end.
 *
 * A real client is a person with at least one business vertical (`isRealClient`
 * in `@repo/schemas`). A pure tourist must be refused SERVER-SIDE at every step
 * of connecting an assistant, and a connection made while they were a client
 * must stop working once they are not:
 *
 * - `/oauth2/authorize` with a session → 403 `access_denied` (no code, no
 *   consent page);
 * - `/oauth2/consent` `accept: true` → 403; `accept: false` still returns the
 *   assistant its `access_denied`;
 * - `/oauth2/token` (code exchange and refresh) → no token, WHEN the
 *   authorization or the token request named the MCP `resource` (the token is
 *   then a JWT and `customAccessTokenClaims` runs). Without any `resource` the
 *   provider mints an opaque token and the issuance gate does not run; `/mcp`
 *   answers 401 to that token;
 * - `/mcp` with a token issued earlier → 403 `FORBIDDEN` (the authoritative gate);
 * - the device-code grant is not offered at all.
 *
 * A client by permission (host) and a client by row ownership alone (provider)
 * are let through.
 *
 * Same harness as `mcp-oauth-end-to-end.test.ts` (real `initApp()`, real Better
 * Auth over its memory adapter). MOCKED: storage, `buildActorForUser` (an actor
 * whose permissions the test sets), `probeBusinessOwnership` (the ownership
 * facts the test sets), the session-path role read, the two `auth.ts` hooks
 * that read user tables, and the tool-call audit write.
 */

import type { Actor } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { subject } = vi.hoisted(() => ({
    subject: {
        userId: '',
        permissions: [] as string[],
        ownsHostTradeListing: false,
        ownsPartner: false
    }
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
                id: subject.userId,
                roles: ['USER'],
                permissions: [...subject.permissions],
                emailVerified: true
            }) as unknown as Actor
    )
}));
vi.mock('../../../src/utils/business-ownership', () => ({
    probeBusinessOwnership: vi.fn(async () => ({
        ownsHostTradeListing: subject.ownsHostTradeListing,
        ownsPartner: subject.ownsPartner
    }))
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    getUserRoles: vi.fn(async () => ['USER'])
}));

import { initApp } from '../../../src/app';
import { getAuth, resetAuth } from '../../../src/lib/auth';
import { MCP_NOT_A_CLIENT_DESCRIPTION } from '../../../src/lib/auth-mcp-client-guard';
import { env, validateApiEnv } from '../../../src/utils/env';
import {
    authMemoryStore,
    createPkcePair,
    dbLiveUser,
    resetAuthMemoryStore,
    toCookieHeader
} from '../../helpers/mcp-real-auth';

const API = 'http://localhost:3001';
const RESOURCE = `${API}/mcp`;
const ISSUER = `${API}/api/auth`;
const REDIRECT_URI = 'http://127.0.0.1:5556/callback';
const EMAIL = 'tomas.tourist@example.com';
const PASSWORD = ['Password', '123!'].join('');

const state = { cookie: '', clientId: '' };

const app = () => initApp();

/** Makes the signed-in user a pure tourist: no permission-gated vertical, no row. */
function becomeTourist(): void {
    subject.permissions = ['accommodation.review.create'];
    subject.ownsHostTradeListing = false;
    subject.ownsPartner = false;
}

/** Makes the signed-in user a host (a client by permission). */
function becomeHost(): void {
    subject.permissions = ['accommodation.create'];
    subject.ownsHostTradeListing = false;
    subject.ownsPartner = false;
}

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

async function authorize(challenge: string): Promise<Response> {
    const query = new URLSearchParams({
        response_type: 'code',
        client_id: state.clientId,
        redirect_uri: REDIRECT_URI,
        scope: 'openid offline_access',
        state: 'state-1',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: RESOURCE
    });
    return app().request(`${ISSUER}/oauth2/authorize?${query}`, {
        headers: { cookie: state.cookie, 'user-agent': 'vitest' }
    });
}

/** Authorize as a client up to the consent page; returns the signed `oauth_query`. */
async function reachConsentPage(challenge: string): Promise<string> {
    const res = await authorize(challenge);
    expect(res.status, await res.clone().text()).toBe(302);
    const location = new URL(res.headers.get('location') as string);
    expect(`${location.origin}${location.pathname}`).toBe(
        `${env.HOSPEDA_SITE_URL}/es/auth/consent/`
    );
    return location.search.slice(1);
}

/** Authorize (consenting if asked) and return the code; the caller must be a client. */
async function getCode(challenge: string): Promise<string> {
    const res = await authorize(challenge);
    expect(res.status, await res.clone().text()).toBe(302);
    let callback = new URL(res.headers.get('location') as string);
    if (`${callback.origin}${callback.pathname}` !== REDIRECT_URI) {
        const consent = await postJson(
            '/api/auth/oauth2/consent',
            { accept: true, oauth_query: callback.search.slice(1) },
            { cookie: state.cookie }
        );
        expect(consent.status).toBe(200);
        callback = new URL(((await consent.json()) as { url: string }).url);
    }
    return callback.searchParams.get('code') as string;
}

async function exchange(code: string, verifier: string): Promise<Response> {
    return postToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: state.clientId,
        code_verifier: verifier,
        resource: RESOURCE
    });
}

async function mcpInitialize(token: string): Promise<Response> {
    return app().request(`${API}/mcp`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': '2025-06-18',
            authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'hos-2562', version: '0.0.0' }
            }
        })
    });
}

function consentRowsFor(): number {
    return (authMemoryStore.oauthConsent as Record<string, unknown>[]).filter(
        (row) => row.userId === subject.userId
    ).length;
}

describe('HOS-2562: AI assistants only for real clients', () => {
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
        env.HOSPEDA_DISABLE_AUTH = false;
        env.HOSPEDA_ALLOW_MOCK_ACTOR = false;
        resetAuth();
        resetAuthMemoryStore();
        await getAuth().$context;

        const signUp = await postJson('/api/auth/sign-up/email', {
            email: EMAIL,
            password: PASSWORD,
            name: 'Tomás Tourist'
        });
        expect(signUp.status, await signUp.clone().text()).toBe(200);
        const user = (authMemoryStore.user as Record<string, unknown>[])[0] as Record<
            string,
            unknown
        >;
        user.emailVerified = true;
        subject.userId = user.id as string;
        dbLiveUser.current = {
            id: subject.userId,
            name: 'Tomás Tourist',
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
        state.cookie = toCookieHeader(signIn);

        const register = await postJson('/api/auth/oauth2/register', {
            client_name: 'Claude Code',
            redirect_uris: [REDIRECT_URI],
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            scope: 'openid offline_access'
        });
        expect(register.status).toBe(201);
        state.clientId = ((await register.json()) as { client_id: string }).client_id;
    });

    beforeEach(() => {
        becomeTourist();
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

    it('refuses a pure tourist at /oauth2/authorize with 403 access_denied', async () => {
        // Act
        const res = await authorize(createPkcePair().challenge);
        const body = (await res.json()) as { error?: string; error_description?: string };

        // Assert
        expect(res.status).toBe(403);
        expect(body.error).toBe('access_denied');
        expect(body.error_description).toBe(MCP_NOT_A_CLIENT_DESCRIPTION);
        expect(res.headers.get('location')).toBeNull();
    });

    it('still sends an anonymous visitor to sign in (the gate needs a session)', async () => {
        const query = new URLSearchParams({
            response_type: 'code',
            client_id: state.clientId,
            redirect_uri: REDIRECT_URI,
            scope: 'openid offline_access',
            code_challenge: createPkcePair().challenge,
            code_challenge_method: 'S256',
            resource: RESOURCE
        });

        const res = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain(`${env.HOSPEDA_SITE_URL}/es/auth/signin/`);
    });

    it('refuses a tourist who accepts on the consent page, and stores no consent', async () => {
        // Arrange: a signed consent request (only reachable as a client), then the
        // account is a tourist when the consent is posted — the post-sign-in
        // path, where the provider resumes authorize without a request we can hook.
        becomeHost();
        const oauthQuery = await reachConsentPage(createPkcePair().challenge);
        becomeTourist();
        const before = consentRowsFor();

        // Act
        const accepted = await postJson(
            '/api/auth/oauth2/consent',
            { accept: true, oauth_query: oauthQuery },
            { cookie: state.cookie }
        );

        // Assert
        expect(accepted.status).toBe(403);
        expect(((await accepted.json()) as { error?: string }).error).toBe('access_denied');
        expect(consentRowsFor()).toBe(before);
    });

    it('lets a tourist DENY on the consent page, so the assistant gets access_denied', async () => {
        becomeHost();
        const oauthQuery = await reachConsentPage(createPkcePair().challenge);
        becomeTourist();

        const denied = await postJson(
            '/api/auth/oauth2/consent',
            { accept: false, oauth_query: oauthQuery },
            { cookie: state.cookie }
        );
        const url = new URL(((await denied.json()) as { url: string }).url);

        expect(denied.status).toBe(200);
        expect(url.searchParams.get('error')).toBe('access_denied');
        expect(url.searchParams.get('code')).toBeNull();
    });

    it('issues no token at the code exchange once the account is not a client', async () => {
        // Arrange: a code obtained while a client (or through the resumed
        // post-sign-in path with a stored consent, which skips both hooks).
        becomeHost();
        const pkce = createPkcePair();
        const code = await getCode(pkce.challenge);
        becomeTourist();

        // Act
        const res = await exchange(code, pkce.verifier);
        const body = (await res.json()) as { access_token?: string; error?: string };

        // Assert
        expect(res.status).toBe(403);
        expect(body.access_token).toBeUndefined();
        expect(body.error).toBe('access_denied');
    });

    it('makes an existing connection useless: /mcp answers 403 and the refresh issues nothing', async () => {
        // Arrange: tokens issued while the account was a client
        becomeHost();
        const pkce = createPkcePair();
        const issued = await exchange(await getCode(pkce.challenge), pkce.verifier);
        const tokens = (await issued.json()) as { access_token: string; refresh_token: string };
        expect(issued.status).toBe(200);
        expect((await mcpInitialize(tokens.access_token)).status).toBe(200);
        becomeTourist();

        // Act
        const call = await mcpInitialize(tokens.access_token);
        const refresh = await postToken({
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            client_id: state.clientId,
            resource: RESOURCE
        });

        // Assert
        expect(call.status).toBe(403);
        expect(((await call.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
        expect(refresh.status).toBe(403);
        expect(((await refresh.json()) as { access_token?: string }).access_token).toBeUndefined();
    });

    describe('token requests without `resource`', () => {
        it('refuses the code exchange when the authorization bound the resource', async () => {
            // Arrange: a code authorized WITH `resource`, exchanged WITHOUT it
            becomeHost();
            const pkce = createPkcePair();
            const code = await getCode(pkce.challenge);
            becomeTourist();

            // Act
            const res = await postToken({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                client_id: state.clientId,
                code_verifier: pkce.verifier
            });
            const body = (await res.json()) as { access_token?: string; error?: string };

            // Assert: the bound resource still makes a JWT, so the gate runs
            expect(res.status).toBe(403);
            expect(body.access_token).toBeUndefined();
            expect(body.error).toBe('access_denied');
        });

        it('refuses the refresh when the authorization bound the resource', async () => {
            // Arrange
            becomeHost();
            const pkce = createPkcePair();
            const issued = await exchange(await getCode(pkce.challenge), pkce.verifier);
            const tokens = (await issued.json()) as { refresh_token: string };
            becomeTourist();

            // Act
            const refresh = await postToken({
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
                client_id: state.clientId
            });

            // Assert
            expect(refresh.status).toBe(403);
            expect(
                ((await refresh.json()) as { access_token?: string }).access_token
            ).toBeUndefined();
        });

        it('issues an OPAQUE token when no step named the resource, and /mcp refuses it', async () => {
            // Arrange: authorize WITHOUT `resource` while a client. With no
            // audience the provider mints an opaque token and never calls
            // `customAccessTokenClaims`, so the issuance gate does not run. This
            // test pins that gap so the docblocks cannot claim more than it.
            becomeHost();
            const pkce = createPkcePair();
            const query = new URLSearchParams({
                response_type: 'code',
                client_id: state.clientId,
                redirect_uri: REDIRECT_URI,
                scope: 'openid offline_access',
                state: 'state-2',
                code_challenge: pkce.challenge,
                code_challenge_method: 'S256'
            });
            const authorized = await app().request(`${ISSUER}/oauth2/authorize?${query}`, {
                headers: { cookie: state.cookie, 'user-agent': 'vitest' }
            });
            let callback = new URL(authorized.headers.get('location') as string);
            if (`${callback.origin}${callback.pathname}` !== REDIRECT_URI) {
                const consent = await postJson(
                    '/api/auth/oauth2/consent',
                    { accept: true, oauth_query: callback.search.slice(1) },
                    { cookie: state.cookie }
                );
                callback = new URL(((await consent.json()) as { url: string }).url);
            }
            becomeTourist();

            // Act
            const res = await postToken({
                grant_type: 'authorization_code',
                code: callback.searchParams.get('code') as string,
                redirect_uri: REDIRECT_URI,
                client_id: state.clientId,
                code_verifier: pkce.verifier
            });
            const tokens = (await res.json()) as { access_token: string; refresh_token: string };
            const refresh = await postToken({
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
                client_id: state.clientId
            });
            const refreshed = (await refresh.json()) as { access_token: string };

            // Assert: issued (not a JWT), and useless where it matters — the
            // per-request `/mcp` check is the authoritative gate.
            expect(res.status).toBe(200);
            expect(tokens.access_token.split('.')).toHaveLength(1);
            expect(refresh.status).toBe(200);
            expect((await mcpInitialize(tokens.access_token)).status).toBe(401);
            expect((await mcpInitialize(refreshed.access_token)).status).toBe(401);
        });
    });

    it('offers no device-code grant: no /device/code, unsupported at /oauth2/token, not advertised', async () => {
        // Act
        const deviceCode = await postJson('/api/auth/device/code', { client_id: state.clientId });
        const deviceToken = await postToken({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: 'any',
            client_id: state.clientId
        });
        const metadata = await app().request(
            `${API}/.well-known/oauth-authorization-server/api/auth`,
            { headers: { 'user-agent': 'vitest' } }
        );
        const document = (await metadata.json()) as Record<string, unknown>;

        // Assert
        expect(deviceCode.status).toBe(404);
        expect(deviceToken.status).toBe(400);
        expect(((await deviceToken.json()) as { error?: string }).error).toBe(
            'unsupported_grant_type'
        );
        expect(metadata.status).toBe(200);
        expect(document.device_authorization_endpoint).toBeUndefined();
        expect(document.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    });

    it('lets a client by row ownership alone (a provider, no permission) through', async () => {
        subject.permissions = [];
        subject.ownsHostTradeListing = true;

        const res = await authorize(createPkcePair().challenge);

        expect(res.status, await res.clone().text()).toBe(302);
    });
});
