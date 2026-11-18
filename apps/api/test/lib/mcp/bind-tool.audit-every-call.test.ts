/**
 * HOS-2335 D-12 / AC-C55 — the binder records every call of every registered
 * tool, read or write, in success, denied and error, exactly once, with the
 * right `tool`, `outcome` and `isWrite`. A read row carries no `details` and
 * no `contentLength`. A rate-limited call leaves no row.
 *
 * The test iterates `MCP_TOOL_DEFINITIONS`, so a new tool is covered without
 * editing it. Handlers are swapped for stubs: what is under test is the
 * binder's audit, not the tools.
 *
 * @module test/lib/mcp/bind-tool.audit-every-call
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockRecord, mockConsume } = vi.hoisted(() => ({
    mockRecord: vi.fn(),
    mockConsume: vi.fn()
}));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mockRecord }));
vi.mock('../../../src/lib/mcp/tool-rate-limit', () => ({ consumeMcpToolCall: mockConsume }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { handleMcpToolCall } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';
import type { ToolDefinition } from '../../../src/mcp/tools/tool-definition';
import { validateApiEnv } from '../../../src/utils/env';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const ENTITY_ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const mcpAuth = {
    userId: USER_ID,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid']
} as const;

const actor: Actor = {
    id: USER_ID,
    role: 'HOST',
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

const ctx = {
    http: {
        authInfo: buildMcpAuthInfo({
            token: 'tok',
            actor,
            mcpAuth,
            resourceUrl: 'https://api.test/mcp'
        })
    }
};

/**
 * Arguments every audit reader of the registry can read: the ids, verticals,
 * kinds and the optional confirmation token the tools' `auditTarget`,
 * `auditDetails` and `auditContentLength` look at.
 */
const PERMISSIVE_INPUT = {
    id: ENTITY_ID,
    inquiryId: ENTITY_ID,
    vertical: 'accommodation',
    kind: 'amenity',
    text: 'hola',
    added: [],
    removed: []
} as const;

type Ending = 'success' | 'denied' | 'error';

/** The definition with a permissive schema and a stub handler that ends as asked. */
function stubbed(definition: ToolDefinition, ending: Ending): ToolDefinition {
    return {
        ...definition,
        inputSchema: z.looseObject({}),
        handler: async () => {
            if (ending === 'error') throw new Error('boom');
            if (ending === 'denied') {
                return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'missing' } };
            }
            return { data: { ok: true } };
        }
    };
}

describe('every registered tool call leaves exactly one audit row (AC-C55)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        mockRecord.mockReset();
        mockConsume.mockReset();
        mockConsume.mockResolvedValue(true);
    });

    it('covers a non-empty registry with reads and writes', () => {
        expect(MCP_TOOL_DEFINITIONS.length).toBeGreaterThan(0);
        expect(MCP_TOOL_DEFINITIONS.some((d) => d.isWrite)).toBe(true);
        expect(MCP_TOOL_DEFINITIONS.some((d) => !d.isWrite)).toBe(true);
    });

    for (const definition of MCP_TOOL_DEFINITIONS) {
        for (const ending of ['success', 'denied', 'error'] as const) {
            it(`${definition.name} (${definition.isWrite ? 'write' : 'read'}) → ${ending}`, async () => {
                // Act
                await handleMcpToolCall({
                    definition: stubbed(definition, ending),
                    input: PERMISSIVE_INPUT,
                    ctx
                });

                // Assert
                expect(mockRecord).toHaveBeenCalledTimes(1);
                const [row] = mockRecord.mock.calls[0] ?? [];
                expect(row).toMatchObject({
                    tool: definition.name,
                    outcome: ending,
                    isWrite: definition.isWrite
                });
                if (!definition.isWrite) {
                    expect(Object.keys(row)).not.toContain('details');
                    expect(Object.keys(row)).not.toContain('contentLength');
                }
            });
        }

        it(`${definition.name}: a malformed call is recorded once as an error`, async () => {
            // Act: a number is never a valid argument object.
            await handleMcpToolCall({ definition, input: 42, ctx });

            // Assert
            expect(mockRecord).toHaveBeenCalledTimes(1);
            expect(mockRecord.mock.calls[0]?.[0]).toMatchObject({
                tool: definition.name,
                outcome: 'error',
                errorCode: ServiceErrorCode.VALIDATION_ERROR,
                isWrite: definition.isWrite
            });
        });

        it(`${definition.name}: a rate-limited call leaves no row`, async () => {
            // Arrange
            mockConsume.mockResolvedValue(false);

            // Act
            const result = await handleMcpToolCall({
                definition: stubbed(definition, 'success'),
                input: PERMISSIVE_INPUT,
                ctx
            });

            // Assert
            expect(result.isError).toBe(true);
            expect(mockRecord).not.toHaveBeenCalled();
        });
    }
});
