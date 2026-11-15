/**
 * HOS-2184 T-012 follow-up — the server answers `tools/list` and `tools/call`
 * itself (low-level `Server`), so malformed arguments get the Spanish
 * validation message and malformed WRITE calls are audited.
 *
 * Driven over the SDK's `InMemoryTransport`, i.e. through the real protocol
 * layer of `@modelcontextprotocol/server`, with the verified caller carried as
 * `authInfo` exactly as `createMcpHandler` hands it over.
 *
 * @module test/lib/mcp/tool-handlers
 */

import {
    type AuthInfo,
    InMemoryTransport,
    type JSONRPCMessage,
    McpServer,
    Server
} from '@modelcontextprotocol/server';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockRecord } = vi.hoisted(() => ({ mockRecord: vi.fn() }));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mockRecord }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { buildToolAnnotations, buildToolInputJsonSchema } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { createHospedaMcpServer } from '../../../src/lib/mcp/server';
import { registerMcpToolHandlers } from '../../../src/lib/mcp/tool-handlers';
import { defineTool, type ToolDefinition } from '../../../src/mcp/tools/tool-definition';
import { TOOL_VALIDATION_MESSAGE } from '../../../src/mcp/tools/tool-errors';
import { clearSlidingWindowStore } from '../../../src/middlewares/rate-limit';
import { validateApiEnv } from '../../../src/utils/env';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const LISTING_ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const mcpAuth = {
    userId: USER_ID,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid']
} as const;
const actor = {
    id: USER_ID,
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;
const authInfo: AuthInfo = buildMcpAuthInfo({
    token: 'tok',
    actor,
    mcpAuth,
    resourceUrl: 'https://api.test/mcp'
});

/** A schema exercising the JSON Schema conversion (formats, defaults, enums, strict). */
const richSchema = z
    .object({
        listingId: z.string().uuid().describe('Id de la publicación'),
        text: z.string().min(1).max(500).optional(),
        limit: z.number().int().min(1).max(50).default(10),
        kind: z.enum(['accommodation', 'venue'])
    })
    .strict();

const writeHandler = vi.fn(async () => ({ data: { done: true } }));
const readHandler = vi.fn(async () => ({ data: { items: [] } }));

const writeTool = defineTool({
    name: 'probe_write',
    title: 'Probe write',
    description: 'Writes a probe.',
    inputSchema: richSchema,
    isWrite: true,
    hints: { destructiveHint: true, idempotentHint: false },
    auditTarget: ({ input }) => ({ type: 'accommodation', id: input.listingId }),
    auditContentLength: ({ input }) => input.text?.length,
    handler: writeHandler
});

const readTool = defineTool({
    name: 'probe_read',
    title: 'Probe read',
    description: 'Reads a probe.',
    inputSchema: z.object({ q: z.string() }).strict(),
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: readHandler
});

const TOOLS: readonly ToolDefinition[] = [readTool, writeTool];

interface RpcReply {
    readonly result?: Record<string, unknown>;
    readonly error?: { readonly code: number; readonly message: string };
}

/**
 * Connects `server` to an in-memory client, runs the 2025 `initialize`
 * handshake, sends one request, and returns its reply.
 */
async function rpc(
    server: Server | McpServer,
    method: string,
    params: Record<string, unknown>
): Promise<RpcReply> {
    const [client, serverSide] = InMemoryTransport.createLinkedPair();
    const replies = new Map<number, RpcReply>();
    client.onmessage = (message: JSONRPCMessage) => {
        if ('id' in message && typeof message.id === 'number') {
            replies.set(message.id, message as RpcReply);
        }
    };
    await server.connect(serverSide);
    await client.start();
    await client.send({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'vitest', version: '0.0.0' }
        }
    });
    await client.send({ jsonrpc: '2.0', id: 1, method, params }, { authInfo });
    await vi.waitFor(() => {
        if (!replies.has(1)) throw new Error('no reply yet');
    });
    await client.close();
    return replies.get(1) as RpcReply;
}

/** The server exactly as `bindMcpTool` built it before (McpServer.registerTool). */
function legacyRegisterToolServer(definition: ToolDefinition): McpServer {
    const server = new McpServer(
        { name: 'legacy', version: '0.0.0' },
        { capabilities: { tools: { listChanged: false } } }
    );
    const inputSchema: z.ZodObject = definition.inputSchema;
    server.registerTool(
        definition.name,
        {
            title: definition.title,
            description: definition.description,
            inputSchema,
            annotations: buildToolAnnotations({ definition })
        },
        async () => ({ content: [] })
    );
    return server;
}

const callTool = (name: string, args: unknown) =>
    rpc(createHospedaMcpServer({ tools: TOOLS }), 'tools/call', { name, arguments: args });

describe('registerMcpToolHandlers', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        mockRecord.mockReset();
        writeHandler.mockClear();
        readHandler.mockClear();
        clearSlidingWindowStore();
    });

    describe('tools/list', () => {
        it('publishes the same entry McpServer.registerTool published', async () => {
            // Arrange
            const ours = createHospedaMcpServer({ tools: [writeTool] });
            const legacy = legacyRegisterToolServer(writeTool);

            // Act
            const [after, before] = await Promise.all([
                rpc(ours, 'tools/list', {}),
                rpc(legacy, 'tools/list', {})
            ]);

            // Assert
            expect(before.result?.tools).toHaveLength(1);
            expect(after.result?.tools).toEqual(before.result?.tools);
        });

        it('lists every definition with its JSON Schema and annotations', async () => {
            // Act
            const reply = await rpc(createHospedaMcpServer({ tools: TOOLS }), 'tools/list', {});

            // Assert
            expect(reply.result?.tools).toEqual([
                {
                    name: 'probe_read',
                    title: 'Probe read',
                    description: 'Reads a probe.',
                    inputSchema: buildToolInputJsonSchema({ definition: readTool }),
                    annotations: { title: 'Probe read', readOnlyHint: true, openWorldHint: false }
                },
                expect.objectContaining({
                    name: 'probe_write',
                    inputSchema: expect.objectContaining({
                        type: 'object',
                        required: ['listingId', 'kind'],
                        additionalProperties: false
                    }),
                    annotations: {
                        title: 'Probe write',
                        readOnlyHint: false,
                        openWorldHint: false,
                        destructiveHint: true,
                        idempotentHint: false
                    }
                })
            ]);
        });

        it('lists nothing on a server without tools', async () => {
            // Act
            const reply = await rpc(createHospedaMcpServer({ tools: [] }), 'tools/list', {});

            // Assert
            expect(reply.result).toEqual({ tools: [] });
        });
    });

    describe('tools/call', () => {
        it('runs a valid call with the caller from authInfo', async () => {
            // Act
            const reply = await callTool('probe_write', {
                listingId: LISTING_ID,
                kind: 'venue',
                text: 'hola'
            });

            // Assert
            expect(reply.result).toEqual({ content: [{ type: 'text', text: '{"done":true}' }] });
            expect(writeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    actor: expect.objectContaining({ id: USER_ID }),
                    input: { listingId: LISTING_ID, kind: 'venue', text: 'hola', limit: 10 }
                })
            );
            expect(mockRecord).toHaveBeenCalledWith({
                actor: expect.objectContaining({ id: USER_ID }),
                mcpAuth,
                tool: 'probe_write',
                outcome: 'success',
                target: { type: 'accommodation', id: LISTING_ID },
                contentLength: 4
            });
        });

        it('answers malformed arguments with the Spanish validation message naming the fields', async () => {
            // Act
            const reply = await callTool('probe_write', { listingId: 'not-a-uuid', kind: 'venue' });

            // Assert
            expect(reply.error).toBeUndefined();
            expect(reply.result?.isError).toBe(true);
            const [content] = reply.result?.content as readonly { readonly text: string }[];
            expect(content?.text.startsWith(`${TOOL_VALIDATION_MESSAGE}: `)).toBe(true);
            expect(content?.text).toContain('campo «listingId»');
            expect(content?.text).not.toContain('Input validation error');
            expect(writeHandler).not.toHaveBeenCalled();
        });

        it('audits a malformed write call as error/VALIDATION_ERROR without a target', async () => {
            // Act
            await callTool('probe_write', { listingId: LISTING_ID, kind: 'venue', price: 10 });

            // Assert
            expect(mockRecord).toHaveBeenCalledTimes(1);
            expect(mockRecord).toHaveBeenCalledWith({
                actor: expect.objectContaining({ id: USER_ID }),
                mcpAuth,
                tool: 'probe_write',
                outcome: 'error',
                errorCode: 'VALIDATION_ERROR'
            });
        });

        it('audits a write call with no arguments at all', async () => {
            // Act
            const reply = await callTool('probe_write', undefined);

            // Assert
            expect(reply.result?.isError).toBe(true);
            expect(mockRecord).toHaveBeenCalledWith(
                expect.objectContaining({ outcome: 'error', errorCode: 'VALIDATION_ERROR' })
            );
        });

        it('does not audit a malformed read call', async () => {
            // Act
            const reply = await callTool('probe_read', { q: 42 });

            // Assert
            expect(reply.result?.isError).toBe(true);
            expect(readHandler).not.toHaveBeenCalled();
            expect(mockRecord).not.toHaveBeenCalled();
        });

        it('answers an unknown tool with the JSON-RPC invalid-params error', async () => {
            // Act
            const reply = await callTool('nope', {});

            // Assert
            expect(reply.result).toBeUndefined();
            expect(reply.error).toEqual(
                expect.objectContaining({ code: -32602, message: 'Tool nope not found' })
            );
            expect(mockRecord).not.toHaveBeenCalled();
        });
    });

    it('refuses two definitions with the same name', () => {
        // Arrange
        const server = new Server(
            { name: 'x', version: '0.0.0' },
            { capabilities: { tools: { listChanged: false } } }
        );

        // Act + Assert
        expect(() => registerMcpToolHandlers({ server, tools: [readTool, readTool] })).toThrow(
            'Duplicate MCP tool name: probe_read'
        );
    });
});
