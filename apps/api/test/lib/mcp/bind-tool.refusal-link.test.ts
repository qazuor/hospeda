/**
 * HOS-2326 (spec HOS-2335 §5.1, AC-C6) — the MCP binding renders a refusal's
 * portal link: one last line of the text (authoritative, some clients ignore
 * `structuredContent`) and the same URL in `structuredContent.action`.
 *
 * @module test/lib/mcp/bind-tool.refusal-link
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    handleMcpToolCall,
    MCP_WWW_AUTHENTICATE_META_KEY,
    REFUSAL_ACTION_LINE_PREFIX
} from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import {
    defineTool,
    type ToolErrorPayload,
    type ToolRefusalLink
} from '../../../src/mcp/tools/tool-definition';
import { TOOL_NOT_FOUND_MESSAGE } from '../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../src/utils/env';

const SITE = 'https://hospeda.test';
const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const LISTING_ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const mcpAuth = {
    userId: USER_ID,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid']
} as const;

/** The SDK context of a verified request. */
function ctx() {
    const actor = {
        id: USER_ID,
        roles: ['HOST'],
        permissions: [],
        emailVerified: true
    } as unknown as Actor;
    return {
        http: {
            authInfo: buildMcpAuthInfo({
                token: 'tok',
                actor,
                mcpAuth,
                resourceUrl: 'https://api.test/mcp'
            })
        }
    };
}

const EDITOR_LINK: ToolRefusalLink = {
    destination: {
        kind: 'listingEditor',
        vertical: 'accommodation',
        id: LISTING_ID,
        section: 'basicInfo'
    }
};

/** A tool that refuses with `error`, pointing at `link`. */
function refusingTool(error: ToolErrorPayload, link: ToolRefusalLink | null = EDITOR_LINK) {
    return defineTool({
        name: 'probe_refusal',
        title: 'Probe',
        description: 'Probe',
        inputSchema: z.object({ id: z.string() }),
        isWrite: false,
        refusalAction: () => link ?? undefined,
        handler: async () => ({ error })
    });
}

describe('refusal link rendering', () => {
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
    });

    it('ends the text with the absolute URL and repeats it in structuredContent (AC-C6)', async () => {
        const definition = refusingTool({ code: ServiceErrorCode.FORBIDDEN, message: 'x' });

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        const url = `${SITE}/es/mi-cuenta/propiedades/${LISTING_ID}/editar/datos/`;
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
            {
                type: 'text',
                text: `Tu cuenta no tiene permiso para hacer esta acción.\n${REFUSAL_ACTION_LINE_PREFIX} ${url}`
            }
        ]);
        expect(result.structuredContent).toEqual({
            action: { url, label: 'Abrir el editor de la publicación' }
        });
        const [first] = result.content;
        expect(first?.type === 'text' && first.text.endsWith(url)).toBe(true);
    });

    it('the line reads "Podés hacerlo acá: <url>"', () => {
        expect(REFUSAL_ACTION_LINE_PREFIX).toBe('Podés hacerlo acá:');
    });

    it('leaves a refusal with no link exactly as before', async () => {
        const definition = refusingTool({ code: ServiceErrorCode.NOT_FOUND, message: 'x' }, null);

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(result).toEqual({
            content: [{ type: 'text', text: TOOL_NOT_FOUND_MESSAGE }],
            isError: true
        });
    });

    it('a not-found carries no editor URL for the asked id (AC-C4)', async () => {
        const definition = refusingTool({ code: ServiceErrorCode.NOT_FOUND, message: 'x' });

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(JSON.stringify(result)).not.toContain(LISTING_ID);
        expect(result.structuredContent).toBeUndefined();
    });

    it('a not-found may carry the owner listings link', async () => {
        const definition = refusingTool(
            { code: ServiceErrorCode.NOT_FOUND, message: 'x' },
            { destination: { kind: 'ownerListings', vertical: 'accommodation' } }
        );

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(result.content).toEqual([
            {
                type: 'text',
                text: `${TOOL_NOT_FOUND_MESSAGE}\n${REFUSAL_ACTION_LINE_PREFIX} ${SITE}/es/mi-cuenta/propiedades/`
            }
        ]);
    });

    it('a transient failure renders no link and no structuredContent (AC-C3)', async () => {
        const definition = refusingTool({
            code: ServiceErrorCode.SERVICE_UNAVAILABLE,
            message: 'x'
        });

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(JSON.stringify(result)).not.toContain('/es/');
        expect(result.structuredContent).toBeUndefined();
    });

    it('renders a help topic in structuredContent even without a link', async () => {
        const definition = refusingTool(
            { code: ServiceErrorCode.FORBIDDEN, message: 'x', helpTopicId: 'publish-requirements' },
            null
        );

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(result.structuredContent).toEqual({ helpTopicId: 'publish-requirements' });
        expect(result.content).toEqual([
            { type: 'text', text: 'Tu cuenta no tiene permiso para hacer esta acción.' }
        ]);
    });

    it('a malformed call to the tool is linked too, over the raw input', async () => {
        const definition = refusingTool({ code: ServiceErrorCode.FORBIDDEN, message: 'x' });

        const result = await handleMcpToolCall({ definition, input: { wrong: true }, ctx: ctx() });

        expect(result.isError).toBe(true);
        expect(result.structuredContent).toMatchObject({ action: { url: expect.any(String) } });
    });

    it('keeps the reconnect challenge and adds no link to it', async () => {
        const definition = refusingTool({ code: ServiceErrorCode.UNAUTHORIZED, message: 'x' });

        const result = await handleMcpToolCall({
            definition,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(result._meta?.[MCP_WWW_AUTHENTICATE_META_KEY]).toBeDefined();
        expect(result.structuredContent).toBeUndefined();
    });
});
