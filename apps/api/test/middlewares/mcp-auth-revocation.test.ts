/**
 * HOS-2184 T-026, AC-11: revoking a connection from the panel makes the
 * client's next `/mcp` call answer 401, and keeps it from refreshing.
 *
 * The access token is a REAL signed JWT checked by the real verifier, and the
 * revoke goes through the real `AiConnectionService`. Only storage is a
 * stand-in: one in-memory store that both the middleware's grant check and the
 * revoke operate on, shaped like the `oauth_consent` and `oauth_refresh_token`
 * rows (the SQL side is covered by the db integration test).
 */

import type { OauthConnectionModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Actor, AiConnectionService } from '@repo/service-core';
import { requestToResourceInput, verifyAccessTokenRequest } from 'better-auth/oauth2';
import { Hono } from 'hono';
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMcpAccessTokenVerifier,
    createMcpAuthMiddleware,
    type McpAuthConfig,
    type McpAuthDeps
} from '../../src/middlewares/mcp-auth';
import type { AppBindings } from '../../src/types';

const API_URL = 'https://api.test';
const ISSUER = `${API_URL}/api/auth`;
const RESOURCE = `${API_URL}/mcp`;
const USER_ID = '43a7b0fb-bde8-4109-a553-1134f2f917fd';
const OTHER_USER_ID = '9b0a5d8e-7e55-4c1c-9d49-0f6a6c3a1b11';
const CLIENT_ID = 'https://claude.ai/oauth/mcp-client-metadata';
const KID = 'test-key-1';
const CONFIG: McpAuthConfig = { enabled: true, resourceUrl: RESOURCE, apiUrl: API_URL };
const ACTOR: Actor = { id: USER_ID, roles: [RoleEnum.HOST], permissions: [] };

interface Pair {
    readonly userId: string;
    readonly clientId: string;
}

let signingKey: CryptoKey;
let publicJwk: JWK;

beforeAll(async () => {
    const pair = await generateKeyPair('EdDSA', { extractable: true });
    signingKey = pair.privateKey;
    publicJwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'EdDSA' };
});

async function signToken(userId = USER_ID): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
        sub: userId,
        aud: RESOURCE,
        azp: CLIENT_ID,
        client_id: CLIENT_ID,
        scope: 'openid offline_access',
        iss: ISSUER,
        iat: now,
        exp: now + 3600
    })
        .setProtectedHeader({ alg: 'EdDSA', kid: KID, typ: 'at+jwt' })
        .sign(signingKey);
}

/** In-memory consents and refresh tokens plus the model operations over them. */
function createStore() {
    let consents: Pair[] = [];
    let refreshTokens: Pair[] = [];
    const matches = (row: Pair, pair: Pair) =>
        row.userId === pair.userId && row.clientId === pair.clientId;
    const model = {
        listForUser: vi.fn(async () => []),
        revokeForUser: vi.fn(async (pair: Pair) => {
            const before = { consents: consents.length, refresh: refreshTokens.length };
            consents = consents.filter((row) => !matches(row, pair));
            refreshTokens = refreshTokens.filter((row) => !matches(row, pair));
            return {
                consents: before.consents - consents.length,
                refreshTokens: before.refresh - refreshTokens.length,
                accessTokens: 0
            };
        })
    };
    return {
        model: model as unknown as OauthConnectionModel,
        connect: (pair: Pair) => {
            consents.push(pair);
            refreshTokens.push(pair);
        },
        hasConsent: (pair: Pair) => consents.some((row) => matches(row, pair)),
        /** What a refresh-token grant could still use. */
        canRefresh: (pair: Pair) => refreshTokens.some((row) => matches(row, pair))
    };
}

describe('AC-11: revoking a connection stops the client', () => {
    let store: ReturnType<typeof createStore>;
    let app: Hono<AppBindings>;
    let service: AiConnectionService;
    const mine: Pair = { userId: USER_ID, clientId: CLIENT_ID };
    const theirs: Pair = { userId: OTHER_USER_ID, clientId: CLIENT_ID };

    beforeEach(() => {
        store = createStore();
        service = new AiConnectionService(
            { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never },
            store.model
        );
        const deps: McpAuthDeps = {
            verifyAccessToken: createMcpAccessTokenVerifier({
                verifyRequest: (request, opts) =>
                    verifyAccessTokenRequest(requestToResourceInput(request), {
                        verifyOptions: { ...opts.verifyOptions },
                        jwksFetch: async () => ({ keys: [publicJwk] })
                    }),
                getIssuer: async () => ISSUER
            }),
            // Same rule as `findActiveMcpGrant`: the consent for the pair must exist.
            findActiveGrant: async (pair) =>
                store.hasConsent(pair) ? { clientName: 'Claude' } : null,
            findUser: async ({ userId }) => ({ id: userId, name: 'Ana', email: 'ana@test.dev' }),
            buildActor: async () => ACTOR,
            isRealClient: async () => true
        };
        app = new Hono<AppBindings>();
        app.use('/mcp', createMcpAuthMiddleware({ deps, getConfig: () => CONFIG }));
        app.post('/mcp', (c) => c.json({ ok: true }));
        store.connect(mine);
        store.connect(theirs);
    });

    const callMcp = async (token: string) =>
        app.request('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    it('accepts the token before the revoke and answers 401 with the same token after', async () => {
        const token = await signToken();
        expect((await callMcp(token)).status).toBe(200);

        const result = await service.revoke(ACTOR, { clientId: CLIENT_ID });

        expect(result.error).toBeUndefined();
        const res = await callMcp(token);
        expect(res.status).toBe(401);
        expect(res.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
    });

    it('also removes the refresh tokens, so the client cannot mint a new access token', async () => {
        expect(store.canRefresh(mine)).toBe(true);

        await service.revoke(ACTOR, { clientId: CLIENT_ID });

        expect(store.canRefresh(mine)).toBe(false);
    });

    it('does not affect another user of the same client', async () => {
        const otherToken = await signToken(OTHER_USER_ID);

        await service.revoke(ACTOR, { clientId: CLIENT_ID });

        expect((await callMcp(otherToken)).status).toBe(200);
        expect(store.canRefresh(theirs)).toBe(true);
    });

    it('answers NOT_FOUND on a second revoke and for a client never connected', async () => {
        await service.revoke(ACTOR, { clientId: CLIENT_ID });

        expect((await service.revoke(ACTOR, { clientId: CLIENT_ID })).error?.code).toBe(
            'NOT_FOUND'
        );
        expect((await service.revoke(ACTOR, { clientId: 'never-connected' })).error?.code).toBe(
            'NOT_FOUND'
        );
    });
});
