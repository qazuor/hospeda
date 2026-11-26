/**
 * HOS-2184 phase B T-040 (review B3) — `handleMcpToolCall` over the REAL
 * `resolveAiAssistantAccess`. Only the listing-access ports (the effective-set
 * probe and billing's coverage) are mocked, so the decision, the gate's
 * failure mapping and the binder's rendering run as in production.
 *
 * `test/setup.ts` replaces the access module for every suite; this file
 * restores the real one with its own `vi.mock` over `importOriginal`.
 *
 * @module test/lib/mcp/bind-tool.ai-gate.real-access
 */

import type { CoverageSource } from '@repo/billing-verticals-contract';
import { buildPortalUrl } from '@repo/portal-routes';
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockRecord, ports } = vi.hoisted(() => ({
    mockRecord: vi.fn(),
    ports: { effectiveSet: vi.fn(), coverage: vi.fn() }
}));

vi.mock('../../../src/mcp/access/ai-assistant-access', async (importOriginal) => importOriginal());
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: (...args: unknown[]) => ports.effectiveSet(...args),
        billing: { coverage: (...args: unknown[]) => ports.coverage(...args) }
    })
}));
vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mockRecord }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    AI_ASSISTANT_NOT_IN_PLAN_MESSAGE,
    AI_ASSISTANT_NOT_IN_PLAN_REASON
} from '../../../src/lib/mcp/ai-assistant-gate';
import { handleMcpToolCall, REFUSAL_ACTION_LINE_PREFIX } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { defineTool } from '../../../src/mcp/tools/tool-definition';
import { clearSlidingWindowStore } from '../../../src/middlewares/rate-limit';
import { env, validateApiEnv } from '../../../src/utils/env';

const SITE = 'https://hospeda.test';
const USER_ID = '8c1d2e3f-4a5b-4c6d-9e7f-0a1b2c3d4e5f';
const VERSION = '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b';
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

const PRE_TRIAL = {
    type: 'TRIAL',
    reference: { kind: 'PLAN_VERSION', planVersionId: VERSION },
    scope: 'VERTICAL',
    target: null,
    since: 'NOT_STARTED',
    until: 'NOT_STARTED',
    charged: null,
    floor: null
} as CoverageSource;

const BASE = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: VERSION },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01T00:00:00.000Z'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
} as CoverageSource;

const handler = vi.fn(async () => ({ data: { ok: true } }));

const gatedTool = defineTool({
    name: 'probe_gated_real',
    title: 'Probe',
    description: 'Probe',
    inputSchema: z.object({ id: z.string() }).strict(),
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler
});

/** No vertical grants the key; `sources` is each vertical's coverage. */
function arrangeNoGrant(args: {
    readonly sources: Partial<Record<VerticalEnum, readonly CoverageSource[]>>;
    readonly failingSet?: readonly VerticalEnum[];
}): void {
    ports.effectiveSet.mockImplementation(
        async ({ vertical }: { readonly vertical: VerticalEnum }) => {
            if (args.failingSet?.includes(vertical)) throw new Error('effective set down');
            return { entitlements: { get: () => undefined } };
        }
    );
    ports.coverage.mockImplementation(
        async ({ vertical }: { readonly vertical: VerticalEnum }) => ({
            covered: false,
            sources: args.sources[vertical] ?? [PRE_TRIAL, BASE]
        })
    );
}

describe('handleMcpToolCall over the real resolveAiAssistantAccess', () => {
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
        ports.effectiveSet.mockReset();
        ports.coverage.mockReset();
        handler.mockClear();
        clearSlidingWindowStore();
    });

    it('refuses a floor-only owner: handler not run, Spanish message, plans link', async () => {
        // Arrange: the venue trial is over (floor only), nothing grants the key.
        arrangeNoGrant({ sources: { [VerticalEnum.VENUE]: [BASE] } });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 'x' }, ctx });

        // Assert
        const plansUrl = buildPortalUrl({
            destination: { kind: 'plans', vertical: 'venue' },
            locale: 'es',
            siteUrl: SITE
        });
        expect(ports.effectiveSet).toHaveBeenCalledTimes(3);
        expect(handler).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
            {
                type: 'text',
                text: `${AI_ASSISTANT_NOT_IN_PLAN_MESSAGE}\n${REFUSAL_ACTION_LINE_PREFIX} ${plansUrl}`
            }
        ]);
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: 'denied',
                errorCode: AI_ASSISTANT_NOT_IN_PLAN_REASON
            })
        );
    });

    it('answers UNAVAILABLE when an effective set cannot be read: no link, no handler', async () => {
        // Arrange
        arrangeNoGrant({ sources: {}, failingSet: [VerticalEnum.ACCOMMODATION] });

        // Act
        const result = await handleMcpToolCall({ definition: gatedTool, input: { id: 'x' }, ctx });

        // Assert
        expect(handler).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
        expect(JSON.stringify(result.content)).not.toContain(AI_ASSISTANT_NOT_IN_PLAN_MESSAGE);
        expect(mockRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: 'error',
                errorCode: ServiceErrorCode.SERVICE_UNAVAILABLE
            })
        );
    });
});
