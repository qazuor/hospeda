/**
 * HOS-2184 phase B T-042 — `tools/list` publishes only the tools whose
 * `requiredPermissions` (any-of) the actor holds, and `tools/call` answers a
 * hidden tool exactly like an unknown one. Decided by `PermissionEnum`, never
 * by role: two actors with the same role and different permissions see
 * different lists.
 *
 * Driven over the SDK's `InMemoryTransport`, with the caller carried as
 * `authInfo` exactly as `createMcpHandler` hands it over.
 *
 * @module test/lib/mcp/tool-handlers.visibility
 */

import {
    type AuthInfo,
    InMemoryTransport,
    type JSONRPCMessage
} from '@modelcontextprotocol/server';
import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { createHospedaMcpServer } from '../../../src/lib/mcp/server';
import { defineTool, type ToolDefinition } from '../../../src/mcp/tools/tool-definition';
import { isToolVisibleTo } from '../../../src/mcp/tools/tool-visibility';
import { clearSlidingWindowStore } from '../../../src/middlewares/rate-limit';
import { validateApiEnv } from '../../../src/utils/env';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const mcpAuth = {
    userId: USER_ID,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid']
} as const;

const handler = vi.fn(async () => ({ data: { ok: true } }));

/** A read tool behind `requiredPermissions`. */
function probe(name: string, requiredPermissions?: readonly PermissionEnum[]): ToolDefinition {
    return defineTool({
        name,
        title: name,
        description: name,
        inputSchema: z.object({}).strict(),
        isWrite: false,
        emailUnverifiedOperation: 'READ_OWN',
        ...(requiredPermissions ? { requiredPermissions } : {}),
        handler
    });
}

const TOOLS: readonly ToolDefinition[] = [
    probe('open_tool'),
    probe('empty_list_tool', []),
    probe('view_tool', [PermissionEnum.CONVERSATION_VIEW_OWN]),
    probe('either_tool', [PermissionEnum.CONVERSATION_REPLY_OWN, PermissionEnum.BILLING_VIEW_OWN])
];

/** A HOST actor with the given permissions: the role is the same for every one. */
function actorWith(permissions: readonly PermissionEnum[]): Actor {
    return { id: USER_ID, roles: ['HOST'], permissions, emailVerified: true } as unknown as Actor;
}

interface RpcReply {
    readonly result?: Record<string, unknown>;
    readonly error?: { readonly code: number; readonly message: string };
}

/** Runs the handshake and one request as `actor`, and returns its reply. */
async function rpc(
    actor: Actor,
    method: string,
    params: Record<string, unknown>
): Promise<RpcReply> {
    const authInfo: AuthInfo = buildMcpAuthInfo({
        token: 'tok',
        actor,
        mcpAuth,
        resourceUrl: 'https://api.test/mcp'
    });
    const server = createHospedaMcpServer({ tools: TOOLS });
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

/** The tool names `tools/list` answers for `actor`. */
async function listedNames(actor: Actor): Promise<string[]> {
    const reply = await rpc(actor, 'tools/list', {});
    return ((reply.result?.tools ?? []) as { readonly name: string }[]).map((tool) => tool.name);
}

describe('tools/list and tools/call visibility (HOS-2184 T-042)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        handler.mockClear();
        clearSlidingWindowStore();
    });

    it('shows only the tools with no required permission to an actor without permissions', async () => {
        expect(await listedNames(actorWith([]))).toEqual(['open_tool', 'empty_list_tool']);
    });

    it('shows a tool to an actor holding its permission', async () => {
        expect(await listedNames(actorWith([PermissionEnum.CONVERSATION_VIEW_OWN]))).toEqual([
            'open_tool',
            'empty_list_tool',
            'view_tool'
        ]);
    });

    it('treats requiredPermissions as any-of', async () => {
        expect(await listedNames(actorWith([PermissionEnum.BILLING_VIEW_OWN]))).toEqual([
            'open_tool',
            'empty_list_tool',
            'either_tool'
        ]);
    });

    it('answers a call to a hidden tool exactly like a call to an unknown tool', async () => {
        // Arrange
        const actor = actorWith([]);

        // Act
        const hidden = await rpc(actor, 'tools/call', { name: 'view_tool', arguments: {} });
        const unknown = await rpc(actor, 'tools/call', { name: 'no_such_tool', arguments: {} });

        // Assert
        expect(handler).not.toHaveBeenCalled();
        expect(hidden.result).toBeUndefined();
        expect(hidden.error?.code).toBe(-32602);
        expect(unknown.error?.code).toBe(-32602);
        expect(hidden.error?.message).toBe(
            unknown.error?.message.replace('no_such_tool', 'view_tool')
        );
    });

    it('runs a visible permission-gated tool', async () => {
        // Act
        const reply = await rpc(actorWith([PermissionEnum.CONVERSATION_VIEW_OWN]), 'tools/call', {
            name: 'view_tool',
            arguments: {}
        });

        // Assert
        expect(reply.error).toBeUndefined();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe('isToolVisibleTo', () => {
    it('ignores roles: an admin-role actor without the permission does not see the tool', () => {
        const admin = { roles: ['SUPER_ADMIN'], permissions: [] } as unknown as Actor;
        expect(
            isToolVisibleTo({
                definition: { requiredPermissions: [PermissionEnum.CONVERSATION_VIEW_OWN] },
                actor: admin
            })
        ).toBe(false);
    });
});
