/**
 * HOS-2184 T-008 — bearer-token middleware for `/mcp` (AC-4, AC-11).
 *
 * The token checks run against REAL signed JWTs: the verifier under test is
 * `createMcpAccessTokenVerifier` wrapped around Better Auth's own
 * `verifyAccessTokenRequest`, fed an in-process JWKS — the same function and
 * the same key-source shape the provider's resource client uses in
 * production. So "wrong audience", "expired" and "bad signature" are decided
 * by jose, not by a stub that returns whatever the test asked for.
 *
 * Only the database-facing seams (grant, user, actor) are replaced.
 */

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { requestToResourceInput, verifyAccessTokenRequest } from 'better-auth/oauth2';
import { Hono } from 'hono';
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    buildMcpWwwAuthenticate,
    createMcpAccessTokenVerifier,
    createMcpAuthMiddleware,
    type McpAuthConfig,
    type McpAuthDeps
} from '../../src/middlewares/mcp-auth';
import { PASSWORD_CHANGE_REQUIRED_RESPONSE } from '../../src/middlewares/must-change-password';
import type { AppBindings } from '../../src/types';

const API_URL = 'https://api.test';
const ISSUER = `${API_URL}/api/auth`;
const RESOURCE = `${API_URL}/mcp`;
const USER_ID = '43a7b0fb-bde8-4109-a553-1134f2f917fd';
const CLIENT_ID = 'https://claude.ai/oauth/mcp-client-metadata';
const KID = 'test-key-1';
const CHALLENGE = `Bearer resource_metadata="${API_URL}/.well-known/oauth-protected-resource/mcp"`;
const INVALID_CHALLENGE = `Bearer error="invalid_token", resource_metadata="${API_URL}/.well-known/oauth-protected-resource/mcp"`;

const CONFIG: McpAuthConfig = { enabled: true, resourceUrl: RESOURCE, apiUrl: API_URL };

let signingKey: CryptoKey;
let foreignKey: CryptoKey;
let publicJwk: JWK;

beforeAll(async () => {
    const pair = await generateKeyPair('EdDSA', { extractable: true });
    const foreign = await generateKeyPair('EdDSA', { extractable: true });
    signingKey = pair.privateKey;
    foreignKey = foreign.privateKey;
    publicJwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'EdDSA' };
});

/** Signs an access token shaped like the provider's `createJwtAccessToken`. */
async function signToken(
    overrides: {
        readonly key?: CryptoKey;
        readonly typ?: string;
        readonly claims?: Record<string, unknown>;
        readonly expiresIn?: number;
    } = {}
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
        sub: USER_ID,
        aud: RESOURCE,
        azp: CLIENT_ID,
        client_id: CLIENT_ID,
        scope: 'openid profile offline_access',
        iss: ISSUER,
        iat: now,
        exp: now + (overrides.expiresIn ?? 3600),
        ...overrides.claims
    })
        .setProtectedHeader({ alg: 'EdDSA', kid: KID, typ: overrides.typ ?? 'at+jwt' })
        .sign(overrides.key ?? signingKey);
}

/** Real verifier: Better Auth's `verifyAccessTokenRequest` over a local JWKS. */
const realVerifier = (): McpAuthDeps['verifyAccessToken'] =>
    createMcpAccessTokenVerifier({
        verifyRequest: (request, opts) =>
            verifyAccessTokenRequest(requestToResourceInput(request), {
                verifyOptions: { ...opts.verifyOptions },
                jwksFetch: async () => ({ keys: [publicJwk] })
            }),
        getIssuer: async () => ISSUER
    });

const ACTOR: Actor = {
    id: USER_ID,
    roles: [RoleEnum.HOST],
    permissions: []
};

/** Builds an app with the middleware and a handler echoing the context. */
function buildApp(
    input: { readonly deps?: Partial<McpAuthDeps>; readonly config?: McpAuthConfig } = {}
) {
    const deps = {
        verifyAccessToken: realVerifier(),
        findActiveGrant: vi.fn(async () => ({ clientName: 'Claude' })),
        findUser: vi.fn(async () => ({ id: USER_ID, name: 'Ana', email: 'ana@test.dev' })),
        buildActor: vi.fn(async () => ACTOR),
        isRealClient: vi.fn(async () => true),
        ...input.deps
    };
    const app = new Hono<AppBindings>();
    app.use('/mcp', createMcpAuthMiddleware({ deps, getConfig: () => input.config ?? CONFIG }));
    app.post('/mcp', (c) => c.json({ actor: c.get('actor'), mcpAuth: c.get('mcpAuth') }));
    return { app, deps };
}

function call(app: Hono<AppBindings>, authorization?: string): Promise<Response> {
    return Promise.resolve(
        app.request('/mcp', {
            method: 'POST',
            headers: authorization ? { Authorization: authorization } : {}
        })
    );
}

async function expectRefused(res: Response, challenge: string): Promise<void> {
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe(challenge);
    expect(await res.json()).toEqual({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'A valid access token is required' }
    });
}

describe('createMcpAuthMiddleware — accepted token', () => {
    it('sets the actor and the grant on the context', async () => {
        // Arrange
        const { app, deps } = buildApp();
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            actor: ACTOR,
            mcpAuth: {
                userId: USER_ID,
                clientId: CLIENT_ID,
                clientName: 'Claude',
                scopes: ['openid', 'profile', 'offline_access']
            }
        });
        expect(deps.findActiveGrant).toHaveBeenCalledWith({ clientId: CLIENT_ID, userId: USER_ID });
        expect(deps.findUser).toHaveBeenCalledWith({ userId: USER_ID });
        expect(deps.buildActor).toHaveBeenCalledWith({
            user: { id: USER_ID, name: 'Ana', email: 'ana@test.dev' }
        });
    });

    it('accepts a lowercase scheme name', async () => {
        // Arrange
        const { app } = buildApp();
        const token = await signToken();

        // Act
        const res = await call(app, `bearer ${token}`);

        // Assert
        expect(res.status).toBe(200);
    });
});

describe('createMcpAuthMiddleware — no usable credentials', () => {
    it('refuses a request without Authorization, with no error code', async () => {
        // Arrange
        const verifyAccessToken = vi.fn();
        const { app } = buildApp({ deps: { verifyAccessToken } });

        // Act
        const res = await call(app);

        // Assert
        await expectRefused(res, CHALLENGE);
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('refuses a non-Bearer scheme', async () => {
        // Arrange
        const verifyAccessToken = vi.fn();
        const { app } = buildApp({ deps: { verifyAccessToken } });

        // Act
        const res = await call(app, 'Basic dXNlcjpwYXNz');

        // Assert
        await expectRefused(res, CHALLENGE);
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('refuses an empty Bearer value', async () => {
        // Arrange
        const { app } = buildApp();

        // Act
        const res = await call(app, 'Bearer ');

        // Assert
        await expectRefused(res, CHALLENGE);
    });
});

describe('createMcpAuthMiddleware — rejected token', () => {
    it('refuses a token signed with another key', async () => {
        // Arrange
        const { app, deps } = buildApp();
        const token = await signToken({ key: foreignKey });

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
        expect(deps.findUser).not.toHaveBeenCalled();
    });

    it('refuses a token for another audience', async () => {
        // Arrange
        const { app, deps } = buildApp();
        const token = await signToken({ claims: { aud: `${API_URL}/api/auth/oauth2/userinfo` } });

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
        expect(deps.findActiveGrant).not.toHaveBeenCalled();
    });

    it('refuses a token from another issuer', async () => {
        // Arrange
        const { app } = buildApp();
        const token = await signToken({ claims: { iss: 'https://evil.test/api/auth' } });

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
    });

    it('refuses an expired token', async () => {
        // Arrange
        const { app } = buildApp();
        const token = await signToken({ expiresIn: -120 });

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
    });

    it('refuses a JWT that is not an access token (typ)', async () => {
        // Arrange — same key and claims, `typ: JWT` like an ID token.
        const { app } = buildApp();
        const token = await signToken({ typ: 'JWT' });

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
    });

    it('refuses a value that is not a JWT', async () => {
        // Arrange
        const { app } = buildApp();

        // Act
        const res = await call(app, 'Bearer not-a-jwt');

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
    });

    it('refuses a valid token whose subject is not a user id, before any lookup', async () => {
        // Arrange — a client-credentials style token (`sub` = client id).
        const { app, deps } = buildApp();
        const token = await signToken({ claims: { sub: CLIENT_ID } });

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
        expect(deps.findActiveGrant).not.toHaveBeenCalled();
        expect(deps.findUser).not.toHaveBeenCalled();
    });
});

describe('createMcpAuthMiddleware — revocation and account state', () => {
    it('refuses a correctly signed token whose grant was revoked', async () => {
        // Arrange
        const findActiveGrant = vi.fn(async () => null);
        const { app, deps } = buildApp({ deps: { findActiveGrant } });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
        expect(findActiveGrant).toHaveBeenCalledWith({ clientId: CLIENT_ID, userId: USER_ID });
        expect(deps.buildActor).not.toHaveBeenCalled();
    });

    it('refuses a token whose user is missing, deleted or banned', async () => {
        // Arrange
        const findUser = vi.fn(async () => null);
        const { app, deps } = buildApp({ deps: { findUser } });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        await expectRefused(res, INVALID_CHALLENGE);
        expect(deps.buildActor).not.toHaveBeenCalled();
    });

    it('refuses a user who must change their password, like the session gate', async () => {
        // Arrange
        const findUser = vi.fn(async () => ({ id: USER_ID, mustChangePassword: true }));
        const { app, deps } = buildApp({ deps: { findUser } });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert — same status, code and body as mustChangePasswordGate; no challenge.
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body).toEqual(PASSWORD_CHANGE_REQUIRED_RESPONSE);
        expect(body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
        expect(res.headers.get('WWW-Authenticate')).toBeNull();
        expect(deps.buildActor).not.toHaveBeenCalled();
    });

    it('refuses a user who is not a real client with 403 FORBIDDEN (HOS-2562), no challenge', async () => {
        // Arrange — a pure tourist: valid token, live grant, usable account.
        const isRealClient = vi.fn(async () => false);
        const { app } = buildApp({ deps: { isRealClient } });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('FORBIDDEN');
        expect(res.headers.get('WWW-Authenticate')).toBeNull();
        expect(isRealClient).toHaveBeenCalledWith({ actor: ACTOR });
    });

    it('accepts a user whose mustChangePassword flag is false', async () => {
        // Arrange — positive control for the test above.
        const findUser = vi.fn(async () => ({ id: USER_ID, mustChangePassword: false }));
        const { app } = buildApp({ deps: { findUser } });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(200);
    });
});

describe('createMcpAuthMiddleware — fail closed', () => {
    it.each([
        ['the flag is off', { ...CONFIG, enabled: false }],
        ['the resource URL is missing', { ...CONFIG, resourceUrl: undefined }]
    ])('answers 404 without verifying when %s', async (_label, config) => {
        // Arrange
        const verifyAccessToken = vi.fn();
        const { app } = buildApp({ deps: { verifyAccessToken }, config });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Route not found' }
        });
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('surfaces a key-source failure as a server error, not as a 401', async () => {
        // Arrange — the JWKS cannot be read at all.
        const verifyAccessToken = createMcpAccessTokenVerifier({
            verifyRequest: (request, opts) =>
                verifyAccessTokenRequest(requestToResourceInput(request), {
                    verifyOptions: { ...opts.verifyOptions },
                    jwksFetch: async () => {
                        throw new Error('jwks table unreadable');
                    }
                }),
            getIssuer: async () => ISSUER
        });
        const { app } = buildApp({ deps: { verifyAccessToken } });
        const token = await signToken();

        // Act
        const res = await call(app, `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(500);
        expect(res.headers.get('WWW-Authenticate')).toBeNull();
    });
});

describe('buildMcpWwwAuthenticate', () => {
    it('points at the /mcp protected-resource document and ignores a trailing slash', () => {
        // Act
        const header = buildMcpWwwAuthenticate({ apiUrl: `${API_URL}/`, invalidToken: false });

        // Assert
        expect(header).toBe(CHALLENGE);
    });

    it('adds error="invalid_token" when a token was presented', () => {
        // Act
        const header = buildMcpWwwAuthenticate({ apiUrl: API_URL, invalidToken: true });

        // Assert
        expect(header).toBe(INVALID_CHALLENGE);
    });
});
