/**
 * HOS-2184 T-012 — the MCP binding of a tool definition: caller, error
 * rendering, re-authentication challenge, and auditing of write tools.
 *
 * @module test/lib/mcp/bind-tool
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockRecord, mockLoggerError } = vi.hoisted(() => ({
    mockRecord: vi.fn(),
    mockLoggerError: vi.fn()
}));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mockRecord }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    buildToolAnnotations,
    buildToolReauthChallenge,
    handleMcpToolCall,
    MCP_WWW_AUTHENTICATE_META_KEY
} from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { defineTool, type ToolDefinition } from '../../../src/mcp/tools/tool-definition';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_UNEXPECTED_ERROR_MESSAGE
} from '../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../src/utils/env';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const LISTING_ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const mcpAuth = {
    userId: USER_ID,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid']
} as const;

/** The SDK context of a verified request for an actor. */
function ctxFor(emailVerified: boolean | undefined = true) {
    const actor = {
        id: USER_ID,
        roles: ['HOST'],
        permissions: [],
        emailVerified
    } as unknown as Actor;
    return {
        actor,
        ctx: {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor,
                    mcpAuth,
                    resourceUrl: 'https://api.test/mcp'
                })
            }
        }
    };
}

const inputSchema = z.object({ listingId: z.string(), text: z.string().optional() });

/** A write tool whose handler result is supplied per test. */
function writeTool(
    handler: ToolDefinition<typeof inputSchema, { done: boolean }>['handler']
): ToolDefinition<typeof inputSchema, { done: boolean }> {
    return defineTool({
        name: 'probe_write',
        title: 'Probe write',
        description: 'Probe',
        inputSchema,
        isWrite: true,
        auditTarget: ({ input }) => ({ type: 'accommodation', id: input.listingId }),
        auditContentLength: ({ input }) => input.text?.length,
        handler
    });
}

const input = { listingId: LISTING_ID, text: 'hola' };

describe('handleMcpToolCall', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        mockRecord.mockReset();
        mockLoggerError.mockReset();
    });

    it('adds the details a tool contributes to its audit record', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = defineTool({
            name: 'probe_details',
            title: 'Probe details',
            description: 'Probe',
            inputSchema,
            isWrite: true,
            auditDetails: ({ input: parsed }) => ({ step: parsed.text ? 'send' : 'preview' }),
            handler: async () => ({ data: { done: true } })
        });

        // Act
        await handleMcpToolCall({ definition, input, ctx });
        await handleMcpToolCall({ definition, input: { listingId: LISTING_ID }, ctx });

        // Assert
        expect(mockRecord.mock.calls.map(([call]) => call.details)).toEqual([
            { step: 'send' },
            { step: 'preview' }
        ]);
    });

    it('renders success as text content and audits it', async () => {
        // Arrange
        const { actor, ctx } = ctxFor();
        const definition = writeTool(async () => ({ data: { done: true } }));

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result).toEqual({ content: [{ type: 'text', text: '{"done":true}' }] });
        expect(mockRecord).toHaveBeenCalledTimes(1);
        expect(mockRecord).toHaveBeenCalledWith({
            actor,
            mcpAuth,
            tool: 'probe_write',
            outcome: 'success',
            target: { type: 'accommodation', id: LISTING_ID },
            contentLength: 4
        });
    });

    it('renders a string payload as is', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = defineTool({
            ...writeTool(async () => ({ data: { done: true } })),
            handler: async () => ({ data: 'Se va a enviar: «hola». ¿Confirmás?' })
        });

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result.content).toEqual([
            { type: 'text', text: 'Se va a enviar: «hola». ¿Confirmás?' }
        ]);
    });

    it('audits a refusal as denied with its error code', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = writeTool(async () => ({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'missing' }
        }));

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result).toEqual({
            content: [{ type: 'text', text: TOOL_NOT_FOUND_MESSAGE }],
            isError: true
        });
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'denied', errorCode: ServiceErrorCode.NOT_FOUND })
        );
    });

    it('audits an unverified-email refusal as denied without running the handler', async () => {
        // Arrange
        const { ctx } = ctxFor(false);
        const handler = vi.fn(async () => ({ data: { done: true } }));
        const definition = writeTool(handler);

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result.isError).toBe(true);
        expect(handler).not.toHaveBeenCalled();
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: 'denied',
                errorCode: ServiceErrorCode.EMAIL_NOT_VERIFIED
            })
        );
    });

    it('audits an unexpected throw as error and answers generically', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = writeTool(async () => {
            throw new TypeError('Cannot read properties of undefined (reading "x")');
        });

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result).toEqual({
            content: [{ type: 'text', text: TOOL_UNEXPECTED_ERROR_MESSAGE }],
            isError: true
        });
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'error', errorCode: 'UNEXPECTED' })
        );
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });

    it('answers a missing and a foreign resource identically', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const missing = writeTool(async () => ({
            error: {
                code: ServiceErrorCode.NOT_FOUND,
                message: `Accommodation ${LISTING_ID} not found`
            }
        }));
        const foreign = writeTool(async () => ({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Not owned by actor' }
        }));

        // Act
        const [a, b] = await Promise.all([
            handleMcpToolCall({ definition: missing, input, ctx }),
            handleMcpToolCall({ definition: foreign, input, ctx })
        ]);

        // Assert
        expect(a).toEqual(b);
    });

    it('does not audit a read tool', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = defineTool({
            ...writeTool(async () => ({ data: { done: true } })),
            isWrite: false,
            emailUnverifiedOperation: 'READ_OWN'
        });

        // Act
        await handleMcpToolCall({ definition, input, ctx });
        await handleMcpToolCall({
            definition: {
                ...definition,
                handler: async () => ({ error: { code: ServiceErrorCode.NOT_FOUND, message: '' } })
            },
            input,
            ctx
        });

        // Assert
        expect(mockRecord).not.toHaveBeenCalled();
    });

    it('attaches the re-authentication challenge on UNAUTHORIZED', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = writeTool(async () => ({
            error: { code: ServiceErrorCode.UNAUTHORIZED, message: 'expired' }
        }));

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result.isError).toBe(true);
        expect(result._meta).toEqual({
            [MCP_WWW_AUTHENTICATE_META_KEY]: buildToolReauthChallenge({
                apiUrl: env.HOSPEDA_API_URL
            })
        });
    });

    it('carries no _meta on other failures', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = writeTool(async () => ({
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'no' }
        }));

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result._meta).toBeUndefined();
    });

    it('answers generically, without throwing or auditing, when the request has no caller', async () => {
        // Arrange
        const handler = vi.fn(async () => ({ data: { done: true } }));
        const definition = writeTool(handler);

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx: {} });

        // Assert
        expect(result).toEqual({
            content: [{ type: 'text', text: TOOL_UNEXPECTED_ERROR_MESSAGE }],
            isError: true
        });
        expect(handler).not.toHaveBeenCalled();
        expect(mockRecord).not.toHaveBeenCalled();
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });

    it('validates raw input itself and audits a malformed write without running it', async () => {
        // Arrange
        const { actor, ctx } = ctxFor();
        const handler = vi.fn(async () => ({ data: { done: true } }));
        const definition = writeTool(handler);

        // Act
        const result = await handleMcpToolCall({ definition, input: { text: 7 }, ctx });

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
            {
                type: 'text',
                text: expect.stringMatching(/^Los datos enviados no son válidos: campo «listingId»/)
            }
        ]);
        expect(handler).not.toHaveBeenCalled();
        expect(mockRecord).toHaveBeenCalledWith({
            actor,
            mcpAuth,
            tool: 'probe_write',
            outcome: 'error',
            errorCode: ServiceErrorCode.VALIDATION_ERROR
        });
    });

    it('hands the handler the PARSED input, not the raw arguments', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const handler = vi.fn(async () => ({ data: { done: true } }));
        const definition = defineTool({
            ...writeTool(handler),
            inputSchema: z.object({ listingId: z.string().trim() }),
            auditTarget: undefined,
            auditContentLength: undefined,
            handler
        });

        // Act
        await handleMcpToolCall({ definition, input: { listingId: `  ${LISTING_ID} ` }, ctx });

        // Assert
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ input: { listingId: LISTING_ID } })
        );
    });

    it('still audits when the audit target reader throws', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const definition = defineTool({
            ...writeTool(async () => ({ data: { done: true } })),
            auditTarget: () => {
                throw new Error('bad reader');
            }
        });

        // Act
        const result = await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(result.isError).toBeUndefined();
        expect(mockRecord).toHaveBeenCalledWith(
            expect.not.objectContaining({ target: expect.anything() })
        );
    });

    it('targets what a successful call created, and falls back to auditTarget on failure (HOS-2329)', async () => {
        // Arrange
        const { ctx } = ctxFor();
        const CREATED_ID = '0b1c2d3e-4f50-4617-8a9b-0c1d2e3f4a5b';
        let fail = false;
        const definition = defineTool({
            name: 'probe_create',
            title: 'Probe create',
            description: 'Probe',
            inputSchema,
            isWrite: true,
            auditTarget: ({ input: parsed }) => ({ type: 'accommodation', id: parsed.listingId }),
            auditResultTarget: ({ data }) => ({
                type: 'accommodation',
                id: z.object({ createdId: z.string() }).parse(data).createdId
            }),
            handler: async () =>
                fail
                    ? { error: { code: ServiceErrorCode.VALIDATION_ERROR, message: 'bad' } }
                    : { data: { createdId: CREATED_ID } }
        });

        // Act
        await handleMcpToolCall({ definition, input, ctx });
        fail = true;
        await handleMcpToolCall({ definition, input, ctx });

        // Assert
        expect(mockRecord.mock.calls.map(([call]) => call.target)).toEqual([
            { type: 'accommodation', id: CREATED_ID },
            { type: 'accommodation', id: LISTING_ID }
        ]);
    });
});

describe('buildToolReauthChallenge', () => {
    it('carries resource_metadata, error and error_description', () => {
        expect(buildToolReauthChallenge({ apiUrl: 'https://api.test/' })).toEqual([
            'Bearer error="invalid_token", resource_metadata="https://api.test/.well-known/oauth-protected-resource/mcp", error_description="Reconnect your Hospeda account to continue"'
        ]);
    });
});

describe('buildToolAnnotations', () => {
    it('marks a read tool read-only and drops write-only hints', () => {
        expect(
            buildToolAnnotations({
                definition: {
                    title: 'Leer',
                    isWrite: false,
                    hints: { destructiveHint: true, idempotentHint: true }
                }
            })
        ).toEqual({ title: 'Leer', readOnlyHint: true, openWorldHint: false });
    });

    it('marks a write tool with its hints', () => {
        expect(
            buildToolAnnotations({
                definition: { title: 'Pausar', isWrite: true, hints: { destructiveHint: true } }
            })
        ).toEqual({
            title: 'Pausar',
            readOnlyHint: false,
            openWorldHint: false,
            destructiveHint: true
        });
    });
});
