/**
 * HOS-2329 — `create_listing` over MCP: preview and commit each leave ONE audit
 * row with their `step`, and the commit's row targets the created listing
 * (AC-C23). Runs through `handleMcpToolCall`, the real MCP binding.
 *
 * @module test/mcp/tools/listing/create-listing.audit
 */

import { VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import { buildCreateListingTool } from '../../../../src/mcp/tools/listing/create-listing';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    CLIENT,
    CREATED_ID,
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    OWNER_ID,
    VALID_INPUT
} from './create-listing.harness';

vi.mock('../../../../src/utils/listing-access/ports', async () => {
    const { mocks } = await import('./create-listing.harness');
    return {
        getListingAccessPorts: () => ({
            loadFacts: mocks.loadFacts,
            billing: { coverage: mocks.coverage },
            effectiveSet: mocks.effectiveSet,
            preTrialDraftLimits: mocks.preTrialDraftLimits
        })
    };
});
vi.mock('../../../../src/lib/mcp/record-tool-call', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { recordMcpToolCall: mocks.record };
});
vi.mock('../../../../src/lib/mcp/tool-rate-limit', () => ({
    consumeMcpToolCall: vi.fn(async () => true)
}));
vi.mock('../../../../src/services/publish-precheck.service', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { resolvePublishPrecheck: mocks.precheck };
});
vi.mock('../../../../src/utils/redis', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { getRedisClient: vi.fn(async () => mocks.redis) };
});
vi.mock('../../../../src/lib/analytics-client', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/lib/analytics-client')>()),
    captureServerAnalyticsEvent: vi.fn()
}));

// The real services (the global setup swaps several for fakes); spied per test.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    assertNoOwnLocationConflict: vi.fn(async () => undefined)
}));

/** The SDK context of a verified request for the owner. */
function ctx() {
    const actor = {
        id: OWNER_ID,
        roles: ['USER'],
        permissions: [],
        emailVerified: true
    } as unknown as Actor;
    return {
        http: {
            authInfo: buildMcpAuthInfo({
                token: 'tok',
                actor,
                mcpAuth: {
                    userId: OWNER_ID,
                    clientId: CLIENT,
                    clientName: 'Claude',
                    scopes: ['openid']
                },
                resourceUrl: 'https://api.test/mcp'
            })
        }
    };
}

describe('create_listing audit (AC-C23)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        mocks.record.mockReset();
        mocks.coverage.mockResolvedValue({ sources: ['TRIAL'] });
        mocks.redis = makeFakeRedis().redis;
        givenPrecheck();
        givenDestinations();
        givenCreateServices();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('preview then commit leave one row each, the commit targeting the created id', async () => {
        // Arrange
        const definition = buildCreateListingTool();
        const input = { ...VALID_INPUT.venue };

        // Act
        const preview = await handleMcpToolCall({ definition, input, ctx: ctx() });
        const token = JSON.parse(
            (preview.content[0] as { readonly text: string }).text
        ).confirmationToken;
        await handleMcpToolCall({
            definition,
            input: { ...input, confirmationToken: token },
            ctx: ctx()
        });

        // Assert
        expect(mocks.record).toHaveBeenCalledTimes(2);
        const [first, second] = mocks.record.mock.calls.map(([call]) => call);
        expect(first).toMatchObject({
            tool: 'create_listing',
            outcome: 'success',
            details: { step: 'preview', vertical: VerticalEnum.VENUE }
        });
        expect(first).not.toHaveProperty('target');
        expect(second).toMatchObject({
            tool: 'create_listing',
            outcome: 'success',
            target: { type: VerticalEnum.VENUE, id: CREATED_ID },
            details: { step: 'commit', vertical: VerticalEnum.VENUE }
        });
    });

    it('a refused commit still leaves its row, with no target', async () => {
        const definition = buildCreateListingTool();
        await handleMcpToolCall({
            definition,
            input: { ...VALID_INPUT.venue, confirmationToken: 'forged' },
            ctx: ctx()
        });
        expect(mocks.record).toHaveBeenCalledTimes(1);
        const [call] = mocks.record.mock.calls[0] ?? [];
        expect(call).toMatchObject({ details: { step: 'commit' } });
        expect(call.outcome).not.toBe('success');
        expect(call).not.toHaveProperty('target');
    });
});
