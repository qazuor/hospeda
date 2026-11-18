/**
 * HOS-2335 follow-up (known gap U-5) — the MCP binding resolves the user's web
 * language once per call and every portal link of the answer carries it:
 * a handler refusal, a malformed call and a tool's own links.
 *
 * @module test/lib/mcp/bind-tool.locale
 */

import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const { resolveRecipientLocale } = vi.hoisted(() => ({ resolveRecipientLocale: vi.fn() }));
vi.mock('../../../src/services/notification-recipient-locale', () => ({ resolveRecipientLocale }));

import { handleMcpToolCall } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { buildPortalUrl } from '../../../src/mcp/portal/build-portal-url';
import { defineTool } from '../../../src/mcp/tools/tool-definition';
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

/** A tool that refuses with FORBIDDEN, pointing at the listing editor. */
const refusingTool = defineTool({
    name: 'probe_locale_refusal',
    title: 'Probe',
    description: 'Probe',
    inputSchema: z.object({ id: z.string() }),
    isWrite: false,
    refusalAction: () => ({
        destination: { kind: 'listingEditor', vertical: 'accommodation', id: LISTING_ID }
    }),
    handler: async () => ({ error: { code: ServiceErrorCode.FORBIDDEN, message: 'x' } })
});

/** A tool whose handler THROWS a `ServiceError`: the executor's catch path. */
const throwingTool = defineTool({
    name: 'probe_locale_throw',
    title: 'Probe',
    description: 'Probe',
    inputSchema: z.object({ id: z.string() }),
    isWrite: false,
    refusalAction: () => ({
        destination: { kind: 'listingEditor', vertical: 'accommodation', id: LISTING_ID }
    }),
    handler: async () => {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'x');
    }
});

/** A tool that returns a link it builds from the call context. */
const linkingTool = defineTool({
    name: 'probe_locale_link',
    title: 'Probe',
    description: 'Probe',
    inputSchema: z.object({}),
    isWrite: false,
    handler: async ({ context }) => ({
        data: buildPortalUrl({
            destination: { kind: 'subscription' },
            locale: context.locale,
            siteUrl: SITE
        })
    })
});

describe('MCP portal links use the user locale', () => {
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
        resolveRecipientLocale.mockReset();
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('a refusal link carries the %s prefix of the caller', async (locale) => {
        resolveRecipientLocale.mockResolvedValue(locale);

        const result = await handleMcpToolCall({
            definition: refusingTool,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(resolveRecipientLocale).toHaveBeenCalledWith({ userId: USER_ID });
        expect(result.structuredContent).toMatchObject({
            action: { url: `${SITE}/${locale}/mi-cuenta/propiedades/${LISTING_ID}/editar/` }
        });
    });

    it.each([
        'en',
        'pt'
    ] as const)('a thrown ServiceError refusal link carries the %s prefix', async (locale) => {
        resolveRecipientLocale.mockResolvedValue(locale);

        const result = await handleMcpToolCall({
            definition: throwingTool,
            input: { id: LISTING_ID },
            ctx: ctx()
        });

        expect(result.isError).toBe(true);
        expect(result.structuredContent).toMatchObject({
            action: { url: `${SITE}/${locale}/mi-cuenta/propiedades/${LISTING_ID}/editar/` }
        });
    });

    it('a malformed call links in the caller locale too', async () => {
        resolveRecipientLocale.mockResolvedValue('pt');

        const result = await handleMcpToolCall({
            definition: refusingTool,
            input: {},
            ctx: ctx()
        });

        expect(result.isError).toBe(true);
        expect(result.structuredContent).toMatchObject({
            action: { url: expect.stringContaining(`${SITE}/pt/`) }
        });
    });

    it('hands the handler the locale in its context', async () => {
        resolveRecipientLocale.mockResolvedValue('en');

        const result = await handleMcpToolCall({
            definition: linkingTool,
            input: {},
            ctx: ctx()
        });

        expect(result.content).toEqual([
            { type: 'text', text: `${SITE}/en/mi-cuenta/suscripcion/` }
        ]);
    });

    it('resolves the locale once per call, not once per link', async () => {
        resolveRecipientLocale.mockResolvedValue('en');

        await handleMcpToolCall({ definition: refusingTool, input: { id: 'x' }, ctx: ctx() });

        expect(resolveRecipientLocale).toHaveBeenCalledTimes(1);
    });
});
