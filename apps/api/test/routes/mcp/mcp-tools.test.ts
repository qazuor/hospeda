/**
 * HOS-2184 T-012 — tool definitions served end to end through the REAL `/mcp`
 * route (`initApp`, real `mcpAuthMiddleware`, real SDK handler, real
 * `registerMcpToolHandlers`). Same outer-boundary mocks as `mcp-endpoint.test.ts`; the
 * tool registry is replaced by two dummy definitions (one read, one write),
 * and the audit writer by a spy.
 */

import { getDb } from '@repo/db';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { USER_ID, CLIENT_ID, VALID_TOKEN, ACTOR, findOneMock, recordMock, writeHandler } =
    vi.hoisted(() => {
        const userId = '6c1e4d2b-9a8f-4e7d-a6c5-b4a3928170f6';
        return {
            USER_ID: userId,
            CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
            VALID_TOKEN: 'valid-access-token-0123456789',
            ACTOR: { id: userId, roles: ['HOST'], permissions: [], emailVerified: true } as {
                id: string;
                roles: string[];
                permissions: string[];
                emailVerified: boolean;
            },
            findOneMock: vi.fn(),
            recordMock: vi.fn(),
            writeHandler: vi.fn()
        };
    });

vi.mock('../../../src/mcp/tools/registry', async () => {
    const { z } = await import('zod');
    const { defineTool } = await import('../../../src/mcp/tools/tool-definition');
    return {
        MCP_TOOL_DEFINITIONS: [
            defineTool({
                name: 'dummy_read',
                title: 'Dummy read',
                description: 'Reads a dummy.',
                inputSchema: z.object({ q: z.string() }).strict(),
                isWrite: false,
                emailUnverifiedOperation: 'READ_OWN',
                handler: async ({ actor, input }) => ({ data: { actorId: actor.id, q: input.q } })
            }),
            defineTool({
                name: 'dummy_write',
                title: 'Dummy write',
                description: 'Writes a dummy.',
                inputSchema: z.object({ listingId: z.string() }).strict(),
                isWrite: true,
                hints: { destructiveHint: true },
                auditTarget: ({ input }) => ({ type: 'venue', id: input.listingId }),
                handler: (args) => writeHandler(args)
            })
        ]
    };
});

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: recordMock }));

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
                    return { sub: USER_ID, client_id: CLIENT_ID, scope: 'openid' };
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
    buildActorForUser: vi.fn(async () => ({ ...ACTOR }) as unknown as Actor)
}));

import { initApp } from '../../../src/app';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_VALIDATION_MESSAGE
} from '../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../src/utils/env';

const PROTOCOL_VERSION = '2025-06-18';

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

interface RpcResult {
    readonly error?: { readonly code: number; readonly message: string };
    readonly result?: {
        readonly tools?: readonly Record<string, unknown>[];
        readonly content?: readonly { readonly text: string }[];
        readonly isError?: boolean;
    };
}

/** Sends one JSON-RPC request to `/mcp` and reads the (JSON or SSE) answer. */
async function rpc(method: string, params: Record<string, unknown>): Promise<RpcResult> {
    const res = await initApp().request('/mcp', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${VALID_TOKEN}`,
            'mcp-protocol-version': PROTOCOL_VERSION
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const payload = (res.headers.get('content-type') ?? '').includes('text/event-stream')
        ? (text.split('\n').find((l) => l.startsWith('data: ')) ?? 'data: null').slice(6)
        : text;
    return JSON.parse(payload) as RpcResult;
}

const callTool = (name: string, args: Record<string, unknown>) =>
    rpc('tools/call', { name, arguments: args });

describe('/mcp tools (T-012 binding, end to end)', () => {
    const original = {
        enabled: undefined as boolean | undefined,
        url: undefined as string | undefined
    };

    beforeAll(() => {
        validateApiEnv();
        original.enabled = env.HOSPEDA_MCP_ENABLED;
        original.url = env.HOSPEDA_MCP_RESOURCE_URL;
    });

    beforeEach(() => {
        env.HOSPEDA_MCP_ENABLED = true;
        env.HOSPEDA_MCP_RESOURCE_URL = 'https://api.test/mcp';
        ACTOR.emailVerified = true;
        givenLiveUser();
        findOneMock.mockImplementation(async ({ model }: { readonly model: string }) =>
            model === 'oauthClient' ? { name: 'Claude', disabled: false } : { id: 'consent-1' }
        );
        writeHandler.mockResolvedValue({ data: { paused: true } });
    });

    afterEach(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.url;
        vi.mocked(getDb).mockReset();
        findOneMock.mockReset();
        recordMock.mockReset();
        writeHandler.mockReset();
    });

    it('lists the registry with annotations derived from the definitions', async () => {
        // Act
        const message = await rpc('tools/list', {});

        // Assert
        expect(message.result?.tools).toEqual([
            expect.objectContaining({
                name: 'dummy_read',
                title: 'Dummy read',
                annotations: { title: 'Dummy read', readOnlyHint: true, openWorldHint: false },
                inputSchema: expect.objectContaining({ type: 'object', required: ['q'] })
            }),
            expect.objectContaining({
                name: 'dummy_write',
                annotations: {
                    title: 'Dummy write',
                    readOnlyHint: false,
                    openWorldHint: false,
                    destructiveHint: true
                }
            })
        ]);
    });

    it('runs a read tool as the token subject and audits it as a read (D-12)', async () => {
        // Act
        const message = await callTool('dummy_read', { q: 'hola' });

        // Assert
        expect(message.result?.isError).toBeUndefined();
        expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
            actorId: USER_ID,
            q: 'hola'
        });
        expect(recordMock).toHaveBeenCalledTimes(1);
        expect(recordMock).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: USER_ID }),
            mcpAuth: expect.objectContaining({ clientId: CLIENT_ID }),
            tool: 'dummy_read',
            isWrite: false,
            outcome: 'success'
        });
    });

    it('runs a write tool and audits it with the OAuth client', async () => {
        // Act
        const message = await callTool('dummy_write', { listingId: 'v-1' });

        // Assert
        expect(message.result?.isError).toBeUndefined();
        expect(recordMock).toHaveBeenCalledTimes(1);
        expect(recordMock).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: USER_ID }),
            mcpAuth: expect.objectContaining({ clientId: CLIENT_ID, clientName: 'Claude' }),
            tool: 'dummy_write',
            isWrite: true,
            outcome: 'success',
            target: { type: 'venue', id: 'v-1' }
        });
    });

    it('answers a not-found write as a Spanish tool error and audits it as denied', async () => {
        // Arrange
        writeHandler.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'Venue v-1 not found' }
        });

        // Act
        const message = await callTool('dummy_write', { listingId: 'v-1' });

        // Assert
        expect(message.result).toMatchObject({
            isError: true,
            content: [{ text: TOOL_NOT_FOUND_MESSAGE }]
        });
        expect(recordMock).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'denied', errorCode: 'NOT_FOUND' })
        );
    });

    it('refuses a write to an unverified user but serves a READ_OWN read', async () => {
        // Arrange
        ACTOR.emailVerified = false;

        // Act
        const write = await callTool('dummy_write', { listingId: 'v-1' });
        const read = await callTool('dummy_read', { q: 'x' });

        // Assert
        expect(write.result?.isError).toBe(true);
        expect(write.result?.content?.[0]?.text).toMatch(/^Tenés que verificar tu email/);
        expect(writeHandler).not.toHaveBeenCalled();
        expect(read.result?.isError).toBeUndefined();
    });

    it('never leaks an unexpected error to the client', async () => {
        // Arrange
        writeHandler.mockRejectedValue(new Error('relation "venues" does not exist'));

        // Act
        const message = await callTool('dummy_write', { listingId: 'v-1' });

        // Assert
        expect(message.result?.isError).toBe(true);
        expect(JSON.stringify(message)).not.toContain('venues');
    });

    it('rejects arguments outside the schema before the handler runs', async () => {
        // Act
        const message = await callTool('dummy_write', { listingId: 'v-1', price: 10 });

        // Assert
        expect(message.result?.isError).toBe(true);
        expect(writeHandler).not.toHaveBeenCalled();
    });

    it('answers malformed write arguments in Spanish and audits the call', async () => {
        // Act
        const message = await callTool('dummy_write', { listingId: 42 });

        // Assert
        expect(message.result?.isError).toBe(true);
        expect(message.result?.content?.[0]?.text).toMatch(
            new RegExp(`^${TOOL_VALIDATION_MESSAGE}: campo «listingId»`)
        );
        expect(writeHandler).not.toHaveBeenCalled();
        expect(recordMock).toHaveBeenCalledTimes(1);
        expect(recordMock).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: USER_ID }),
            mcpAuth: expect.objectContaining({ clientId: CLIENT_ID }),
            tool: 'dummy_write',
            isWrite: true,
            outcome: 'error',
            errorCode: 'VALIDATION_ERROR'
        });
    });

    it('answers malformed read arguments in Spanish and audits them as a read error', async () => {
        // Act
        const message = await callTool('dummy_read', {});

        // Assert
        expect(message.result?.isError).toBe(true);
        expect(message.result?.content?.[0]?.text).toContain('campo «q»');
        expect(recordMock).toHaveBeenCalledTimes(1);
        expect(recordMock).toHaveBeenCalledWith(
            expect.objectContaining({
                tool: 'dummy_read',
                isWrite: false,
                outcome: 'error',
                errorCode: 'VALIDATION_ERROR'
            })
        );
    });

    it('answers an unknown tool with a JSON-RPC error', async () => {
        // Act
        const message = await callTool('nope', {});

        // Assert
        expect(message.result).toBeUndefined();
        expect(message.error).toEqual(expect.objectContaining({ code: -32602 }));
    });
});
