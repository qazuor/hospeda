/**
 * HOS-2184 T-010 — the `/mcp` Streamable HTTP endpoint (AC-1, AC-4).
 *
 * Exercised through the REAL app (`initApp`), so the global middleware stack
 * (validation, origin verification, compression, response formatting) is on
 * the path, and through the REAL `mcpAuthMiddleware` with its production
 * dependencies. Only their outer boundaries are replaced:
 *
 * - the Better Auth instance (`lib/auth`): no session, a fake adapter for the
 *   grant check;
 * - the provider's resource client: accepts exactly one token string;
 * - `getDb` (the global `@repo/db` mock): the user row;
 * - `buildActorForUser`: a fixed actor (its own suite covers it).
 *
 * One test switches on a probe tool (`whoami`) to prove the verified caller
 * reaches a tool handler through `getMcpCaller`.
 */

import { getDb } from '@repo/db';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { USER_ID, CLIENT_ID, VALID_TOKEN, ACTOR, findOneMock, probe } = vi.hoisted(() => {
    const userId = '43a7b0fb-bde8-4109-a553-1134f2f917fd';
    return {
        USER_ID: userId,
        CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
        VALID_TOKEN: 'valid-access-token-0123456789',
        ACTOR: { id: userId, roles: ['HOST'], permissions: [] } as unknown as Actor,
        findOneMock: vi.fn(),
        probe: { enabled: false }
    };
});

vi.mock('../../../src/lib/mcp/server', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/lib/mcp/server')>();
    const { z } = await import('zod');
    const { defineTool } = await import('../../../src/mcp/tools/tool-definition');
    const whoami = defineTool({
        name: 'whoami',
        title: 'Probe',
        description: 'Probe',
        inputSchema: z.object({}),
        isWrite: false,
        emailUnverifiedOperation: 'READ_OWN',
        handler: async ({ actor }) => ({ data: { actorId: actor.id } })
    });
    return {
        ...original,
        createHospedaMcpServer: () =>
            probe.enabled
                ? original.createHospedaMcpServer({ tools: [whoami] })
                : original.createHospedaMcpServer()
    };
});

vi.mock('../../../src/lib/auth', () => {
    const instance = {
        api: { getSession: async () => null },
        handler: async () => new Response(null, { status: 404 }),
        $context: Promise.resolve({
            baseURL: 'https://api.test/api/auth',
            adapter: { findOne: findOneMock }
        })
    };
    return { getAuth: () => instance };
});

vi.mock('@better-auth/oauth-provider/resource-client', () => ({
    oauthProviderResourceClient: () => ({
        getActions: () => ({
            verifyAccessTokenRequest: async (request: Request) => {
                if (request.headers.get('authorization') === `Bearer ${VALID_TOKEN}`) {
                    return {
                        sub: USER_ID,
                        client_id: CLIENT_ID,
                        scope: 'openid offline_access'
                    };
                }
                const error = new Error('invalid access token') as Error & {
                    status: string;
                    statusCode: number;
                };
                error.name = 'APIError';
                error.status = 'UNAUTHORIZED';
                error.statusCode = 401;
                throw error;
            }
        })
    })
}));

vi.mock('../../../src/middlewares/actor', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/middlewares/actor')>()),
    buildActorForUser: vi.fn(async () => ACTOR)
}));

import { initApp } from '../../../src/app';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';
import { env, validateApiEnv } from '../../../src/utils/env';

const RESOURCE_URL = 'https://api.test/mcp';
const MCP_ACCEPT = 'application/json, text/event-stream';
const LEGACY_PROTOCOL_VERSION = '2025-06-18';

/** Points the global `getDb` mock at a live user row. */
function givenLiveUser(): void {
    const row = {
        id: USER_ID,
        name: 'Ana',
        email: 'ana@test.dev',
        image: null,
        emailVerified: true,
        mustChangePassword: false,
        deletedAt: null,
        banned: false,
        banExpires: null
    };
    const limit = vi.fn().mockResolvedValue([row]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>);
}

/** Points the fake adapter at a live client and consent. */
function givenLiveGrant(): void {
    findOneMock.mockImplementation(async ({ model }: { readonly model: string }) =>
        model === 'oauthClient' ? { name: 'Claude', disabled: false } : { id: 'consent-1' }
    );
}

interface PostInput {
    readonly body: unknown;
    readonly token?: string;
    readonly headers?: Record<string, string>;
}

/** POSTs a JSON-RPC message to `/mcp` the way a Streamable HTTP client does. */
async function postMcp({ body, token, headers }: PostInput): Promise<Response> {
    const app = initApp();
    return app.request('/mcp', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: MCP_ACCEPT,
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...headers
        },
        body: JSON.stringify(body)
    });
}

const initializeRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'vitest-client', version: '0.0.0' }
    }
} as const;

/** Reads a JSON-RPC response from a JSON or single-event SSE body. */
async function readJsonRpc(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
        const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
        return JSON.parse(dataLine?.slice('data: '.length) ?? 'null') as Record<string, unknown>;
    }
    return JSON.parse(text) as Record<string, unknown>;
}

describe('/mcp endpoint', () => {
    const original = {
        enabled: undefined as boolean | undefined,
        resourceUrl: undefined as string | undefined
    };

    beforeAll(() => {
        validateApiEnv();
        original.enabled = env.HOSPEDA_MCP_ENABLED;
        original.resourceUrl = env.HOSPEDA_MCP_RESOURCE_URL;
    });

    beforeEach(() => {
        env.HOSPEDA_MCP_ENABLED = true;
        env.HOSPEDA_MCP_RESOURCE_URL = RESOURCE_URL;
        givenLiveUser();
        givenLiveGrant();
    });

    afterEach(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.resourceUrl;
        vi.mocked(getDb).mockReset();
        findOneMock.mockReset();
        probe.enabled = false;
    });

    describe('flag off (AC-1)', () => {
        it.each(['POST', 'GET', 'DELETE'])('answers the normal 404 on %s', async (method) => {
            // Arrange
            env.HOSPEDA_MCP_ENABLED = false;
            const app = initApp();

            // Act
            const res = await app.request('/mcp', {
                method,
                headers: { authorization: `Bearer ${VALID_TOKEN}`, accept: MCP_ACCEPT }
            });

            // Assert
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Route not found' }
            });
        });

        it('treats an undefined flag as off', async () => {
            // Arrange
            env.HOSPEDA_MCP_ENABLED = undefined as unknown as boolean;

            // Act
            const res = await postMcp({ body: initializeRequest, token: VALID_TOKEN });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    describe('authentication (AC-4)', () => {
        it('answers 401 with the resource_metadata challenge without a token', async () => {
            // Act
            const res = await postMcp({ body: initializeRequest });

            // Assert
            expect(res.status).toBe(401);
            expect(res.headers.get('WWW-Authenticate')).toMatch(
                /^Bearer resource_metadata=".+\/\.well-known\/oauth-protected-resource\/mcp"$/
            );
        });

        it('answers 401 with invalid_token for a rejected token', async () => {
            // Act
            const res = await postMcp({
                body: initializeRequest,
                token: 'forged-token-0123456789'
            });

            // Assert
            expect(res.status).toBe(401);
            expect(res.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
        });

        it('answers 401, not a validation 400, for a non-bearer Authorization header', async () => {
            // Act
            const res = await postMcp({
                body: initializeRequest,
                headers: { authorization: 'Basic dXNlcjpwYXNz' }
            });

            // Assert
            expect(res.status).toBe(401);
            expect(res.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
        });

        it('answers 401 when the grant was revoked (AC-11)', async () => {
            // Arrange
            findOneMock.mockImplementation(async ({ model }: { readonly model: string }) =>
                model === 'oauthClient' ? { name: 'Claude', disabled: false } : null
            );

            // Act
            const res = await postMcp({ body: initializeRequest, token: VALID_TOKEN });

            // Assert
            expect(res.status).toBe(401);
        });
    });

    describe('with a valid token', () => {
        it('completes the initialize handshake with serverInfo and capabilities', async () => {
            // Act
            const res = await postMcp({ body: initializeRequest, token: VALID_TOKEN });
            const message = await readJsonRpc(res);

            // Assert
            expect(res.status).toBe(200);
            expect(message.id).toBe(1);
            expect(message.result).toMatchObject({
                protocolVersion: LEGACY_PROTOCOL_VERSION,
                serverInfo: { name: 'hospeda', title: 'Hospeda MCP', version: '1.0.0' },
                capabilities: { tools: { listChanged: false } }
            });
        });

        it('lists exactly the registry tools', async () => {
            // Act
            const res = await postMcp({
                body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
                token: VALID_TOKEN,
                headers: { 'mcp-protocol-version': LEGACY_PROTOCOL_VERSION }
            });
            const message = (await readJsonRpc(res)) as {
                readonly id?: number;
                readonly result?: { readonly tools?: readonly { readonly name: string }[] };
            };

            // Assert
            expect(res.status).toBe(200);
            expect(message.id).toBe(2);
            expect(message.result?.tools?.map((tool) => tool.name)).toEqual(
                MCP_TOOL_DEFINITIONS.map((definition) => definition.name)
            );
        });

        it('hands the verified caller to tool handlers', async () => {
            // Arrange
            probe.enabled = true;

            // Act
            const res = await postMcp({
                body: {
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'tools/call',
                    params: { name: 'whoami', arguments: {} }
                },
                token: VALID_TOKEN,
                headers: { 'mcp-protocol-version': LEGACY_PROTOCOL_VERSION }
            });
            const message = (await readJsonRpc(res)) as {
                readonly result?: { readonly content?: readonly { readonly text: string }[] };
            };

            // Assert (the grant reaching the tool is asserted through the
            // audit record in mcp-tools.test.ts)
            expect(res.status).toBe(200);
            expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
                actorId: USER_ID
            });
        });

        it('acknowledges a notification with 202', async () => {
            // Act
            const res = await postMcp({
                body: { jsonrpc: '2.0', method: 'notifications/initialized' },
                token: VALID_TOKEN,
                headers: { 'mcp-protocol-version': LEGACY_PROTOCOL_VERSION }
            });

            // Assert
            expect(res.status).toBe(202);
        });

        it.each(['GET', 'DELETE'])('answers 405 on %s (stateless: no sessions)', async (method) => {
            // Arrange
            const app = initApp();

            // Act
            const res = await app.request('/mcp', {
                method,
                headers: { authorization: `Bearer ${VALID_TOKEN}`, accept: MCP_ACCEPT }
            });

            // Assert
            expect(res.status).toBe(405);
        });

        it('refuses a client that does not accept the Streamable HTTP media types', async () => {
            // Act
            const res = await postMcp({
                body: initializeRequest,
                token: VALID_TOKEN,
                headers: { accept: 'text/html' }
            });

            // Assert
            expect(res.status).toBe(406);
        });
    });
});
