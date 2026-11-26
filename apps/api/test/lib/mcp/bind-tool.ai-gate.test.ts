/**
 * HOS-2184 phase B T-040 (spec §6.4, AC-14) — the `ai_assistant_access` plan
 * gate inside `handleMcpToolCall`: a refused call never runs the handler, is
 * audited as a denial with its target, and points to the plans page; an
 * undecidable one is a transient error; a malformed call answers
 * `VALIDATION_ERROR` before the gate is asked; `aiAccessExempt` tools never ask.
 *
 * The decision (`resolveAiAssistantAccess`) is mocked here; its own suite is
 * `test/mcp/access/ai-assistant-access.test.ts`, and
 * `bind-tool.ai-gate.real-access.test.ts` runs this binder over the real one.
 *
 * @module test/lib/mcp/bind-tool.ai-gate
 */

import { buildPortalUrl } from '@repo/portal-routes';
import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockRecord, mockResolve } = vi.hoisted(() => ({
    mockRecord: vi.fn(),
    mockResolve: vi.fn()
}));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mockRecord }));
vi.mock('../../../src/mcp/access/ai-assistant-access', () => ({
    resolveAiAssistantAccess: mockResolve
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    AI_ASSISTANT_NOT_IN_PLAN_MESSAGE,
    AI_ASSISTANT_NOT_IN_PLAN_REASON
} from '../../../src/lib/mcp/ai-assistant-gate';
import { handleMcpToolCall, REFUSAL_ACTION_LINE_PREFIX } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';
import { defineTool } from '../../../src/mcp/tools/tool-definition';
import { clearSlidingWindowStore } from '../../../src/middlewares/rate-limit';
import { env, validateApiEnv } from '../../../src/utils/env';

const SITE = 'https://hospeda.test';
const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
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

const handler = vi.fn(async () => ({ data: { ok: true } }));

const gatedTool = defineTool({
    name: 'probe_gated',
    title: 'Probe',
    description: 'Probe',
    inputSchema: z.object({ id: z.string() }).strict(),
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    auditTarget: ({ input }) => ({ type: 'accommodation', id: input.id }),
    handler
});

const exemptTool = defineTool({ ...gatedTool, name: 'probe_exempt', aiAccessExempt: true });

describe('handleMcpToolCall — ai_assistant_access gate', () => {
    let originalSiteUrl: string;

    beforeAll(() => {
        validateApiEnv();
        originalSiteUrl = env.HOSPEDA_SITE_URL;
    });

    afterAll(() => {
        env.HOSPEDA_SITE_URL = originalSiteUrl;
    });

    beforeEach(() => {
        env.HOSPEDA_SITE_URL = SITE;
        mockRecord.mockReset();
        mockResolve.mockReset();
        handler.mockClear();
        clearSlidingWindowStore();
    });

    it('runs the tool when the plan grants the key', async () => {
        // Arrange
        mockResolve.mockResolvedValue({ kind: 'GRANTED', hasAccess: true, vertical: 'venue' });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 'x' }, ctx });

        // Assert
        expect(result.isError).toBeUndefined();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(mockResolve).toHaveBeenCalledWith({ userId: USER_ID });
    });

    it('runs the tool for an account the gate does not apply to', async () => {
        // Arrange
        mockResolve.mockResolvedValue({ kind: 'NOT_GATED', hasAccess: true });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 'x' }, ctx });

        // Assert
        expect(result.isError).toBeUndefined();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('refuses without running the handler, links the plans page and audits the denial', async () => {
        // Arrange
        mockResolve.mockResolvedValue({ kind: 'REFUSED', hasAccess: false, vertical: 'venue' });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 'x' }, ctx });

        // Assert
        const plansUrl = buildPortalUrl({
            destination: { kind: 'plans', vertical: 'venue' },
            locale: 'es',
            siteUrl: SITE
        });
        expect(handler).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
            {
                type: 'text',
                text: `${AI_ASSISTANT_NOT_IN_PLAN_MESSAGE}\n${REFUSAL_ACTION_LINE_PREFIX} ${plansUrl}`
            }
        ]);
        expect(result.structuredContent).toEqual({
            action: { url: plansUrl, label: expect.any(String) }
        });
        expect(mockRecord).toHaveBeenCalledTimes(1);
        expect(mockRecord).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: USER_ID }),
            mcpAuth,
            tool: 'probe_gated',
            isWrite: false,
            outcome: 'denied',
            target: { type: 'accommodation', id: 'x' },
            errorCode: AI_ASSISTANT_NOT_IN_PLAN_REASON
        });
    });

    it('answers a malformed call with VALIDATION_ERROR before asking the gate', async () => {
        // Arrange: a refused owner, so a gate run first would answer the refusal.
        mockResolve.mockResolvedValue({ kind: 'REFUSED', hasAccess: false, vertical: 'venue' });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 42 }, ctx });

        // Assert
        expect(handler).not.toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).not.toContain(AI_ASSISTANT_NOT_IN_PLAN_MESSAGE);
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({ errorCode: ServiceErrorCode.VALIDATION_ERROR })
        );
        expect(mockRecord.mock.calls[0]?.[0]).not.toHaveProperty('target');
    });

    it('answers an undecidable call with the transient message, no link, audited as an error', async () => {
        // Arrange
        mockResolve.mockResolvedValue({ kind: 'UNAVAILABLE', hasAccess: false });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 'x' }, ctx });

        // Assert
        expect(handler).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
        expect(JSON.stringify(result.content)).toContain('no está disponible');
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: 'error',
                errorCode: ServiceErrorCode.SERVICE_UNAVAILABLE
            })
        );
    });

    it('never asks for an exempt tool, even for a refused owner', async () => {
        // Arrange
        mockResolve.mockResolvedValue({ kind: 'REFUSED', hasAccess: false, vertical: 'venue' });

        // Act
        const result = await handleMcpToolCall({ definition: exemptTool, input: { id: 'x' }, ctx });

        // Assert
        expect(result.isError).toBeUndefined();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(mockResolve).not.toHaveBeenCalled();
    });
});

describe('aiAccessExempt in the registry', () => {
    it('exempts exactly get_help and get_my_plan', () => {
        // Act
        const exempt = MCP_TOOL_DEFINITIONS.filter((definition) => definition.aiAccessExempt).map(
            (definition) => definition.name
        );

        // Assert
        expect(exempt.sort()).toEqual(['get_help', 'get_my_plan']);
    });
});
