/**
 * HOS-2247 — a usage answered by someone else between the preview and the
 * user's answer to the form. Driven through the REAL binder
 * (`handleMcpToolCall`) so the early burn of a refused retry
 * (`discardUnsettledConfirmation`) is part of what is proven: the commit is
 * refused with the same not-pending refusal the plain path gives, the state is
 * gone from Redis, and replaying the same `requestState` (even after an undo put
 * the usage back to PENDING) is refused as an unknown state, never a commit.
 *
 * @module test/mcp/tools/host-trade/answer-benefit-usage.settled-meanwhile
 */

import {
    CLIENT_CAPABILITIES_META_KEY,
    PROTOCOL_VERSION_META_KEY
} from '@modelcontextprotocol/server';
import { HostTradeUsageService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    buildUsageService,
    CLIENT,
    HOST_PROVIDER_ID,
    makeFakeRedis,
    usageRow
} from './host-trade-tools.harness';

const mocks = vi.hoisted(() => ({
    usageService: undefined as unknown,
    redis: undefined as unknown,
    notifyUsageConfirmed: vi.fn(),
    notifyUsageRejected: vi.fn()
}));

vi.mock('../../../../src/mcp/tools/host-trade/host-trade-tool-services', () => ({
    getHostTradeUsageToolService: () => mocks.usageService,
    getHostTradeToolService: () => ({})
}));
vi.mock('../../../../src/utils/redis', () => ({ getRedisClient: vi.fn(async () => mocks.redis) }));
vi.mock('../../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));
vi.mock('../../../../src/lib/mcp/tool-rate-limit', () => ({
    consumeMcpToolCall: vi.fn(async () => true)
}));
vi.mock('../../../../src/lib/host-trade-notifications', () => ({
    notifyUsageConfirmed: mocks.notifyUsageConfirmed,
    notifyUsageRejected: mocks.notifyUsageRejected,
    notifyUsageDeclared: vi.fn()
}));

import { handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import { ELICITATION_INPUT_KEY } from '../../../../src/lib/mcp/elicitation';
import {
    ELICITATION_REASON_MESSAGES,
    ELICITATION_STATE_INVALID_REASON
} from '../../../../src/mcp/tools/elicitation-confirmation';
import {
    confirmBenefitUsageTool,
    rejectBenefitUsageTool
} from '../../../../src/mcp/tools/host-trade/answer-benefit-usage';
import type { ToolDefinition } from '../../../../src/mcp/tools/tool-definition';

const USAGE = usageRow({ id: 'c1111111-1111-4111-8111-111111111111' });
const STATE_KEY_PREFIX = 'mcp:elicit:';

let confirmWrite: ReturnType<typeof vi.spyOn>;
let rejectWrite: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
    const { validateApiEnv } = await import('../../../../src/utils/env');
    validateApiEnv();
});

beforeEach(() => {
    vi.clearAllMocks();
    USAGE.status = 'PENDING';
    mocks.usageService = buildUsageService([USAGE]).service;
    mocks.redis = makeFakeRedis();
    confirmWrite = vi
        .spyOn(HostTradeUsageService.prototype, 'confirmUsage')
        .mockResolvedValue({ data: { usage: { ...USAGE, status: 'CONFIRMED' } } } as never);
    rejectWrite = vi
        .spyOn(HostTradeUsageService.prototype, 'rejectUsage')
        .mockResolvedValue({ data: { usage: { ...USAGE, status: 'REJECTED' } } } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** A real-binder call; `answer` turns it into the retry of a 2026-07-28 client. */
const call = (
    definition: ToolDefinition,
    input: Record<string, unknown>,
    mode: 'plain' | 'capable' | { readonly requestState: string }
) => {
    const actor = actorFor(HOST_PROVIDER_ID);
    const mcpReq =
        mode === 'plain'
            ? undefined
            : {
                  envelope: {
                      [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
                      [CLIENT_CAPABILITIES_META_KEY]: { elicitation: {} }
                  },
                  ...(mode === 'capable'
                      ? {}
                      : {
                            requestState: () => mode.requestState,
                            inputResponses: {
                                [ELICITATION_INPUT_KEY]: {
                                    action: 'accept',
                                    content: { confirm: true }
                                }
                            }
                        })
              };
    return handleMcpToolCall({
        definition,
        input,
        ctx: {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor,
                    mcpAuth: {
                        userId: actor.id,
                        clientId: CLIENT,
                        clientName: 'Claude',
                        scopes: ['openid']
                    },
                    resourceUrl: 'https://api.test/mcp'
                })
            },
            ...(mcpReq ? { mcpReq } : {})
        }
    } as never) as Promise<{
        readonly isError?: boolean;
        readonly content?: readonly { readonly text: string }[];
        readonly requestState?: string;
    }>;
};

const text = (result: Awaited<ReturnType<typeof call>>) => result.content?.[0]?.text;

describe.each([
    ['confirm_benefit_usage', confirmBenefitUsageTool, {}],
    ['reject_benefit_usage', rejectBenefitUsageTool, { note: 'No vino nadie.' }]
] as const)('%s when the usage was settled before the form was answered', (_n, tool, extra) => {
    const input = { usageId: USAGE.id, ...extra };

    it('refuses as not pending, burns the state and never commits or emails', async () => {
        // Arrange: the preview issued a state; then someone else settled the usage.
        const preview = await call(tool, input, 'capable');
        const stateId = preview.requestState as string;
        expect(typeof stateId).toBe('string');
        const redis = mocks.redis as ReturnType<typeof makeFakeRedis>;
        const key = redis.set.mock.calls[0]?.[0] as string;
        expect(key.startsWith(`${STATE_KEY_PREFIX}${tool.name}:`)).toBe(true);
        USAGE.status = 'CONFIRMED';
        const plainRefusal = await call(tool, input, 'plain');

        // Act
        const answered = await call(tool, input, { requestState: stateId });

        // Assert: same refusal as the non-elicitation path, state gone, no write.
        expect(answered.isError).toBe(true);
        expect(plainRefusal.isError).toBe(true);
        expect(text(answered)).toBe(text(plainRefusal));
        expect(await redis.getdel(key)).toBeNull();
        expect(confirmWrite).not.toHaveBeenCalled();
        expect(rejectWrite).not.toHaveBeenCalled();
        expect(mocks.notifyUsageConfirmed).not.toHaveBeenCalled();
        expect(mocks.notifyUsageRejected).not.toHaveBeenCalled();
    });

    it('a replay of the same state after an undo is refused as an unknown state', async () => {
        // Arrange
        const stateId = (await call(tool, input, 'capable')).requestState as string;
        USAGE.status = 'REJECTED';
        await call(tool, input, { requestState: stateId });
        USAGE.status = 'PENDING'; // the undo put it back

        // Act
        const replay = await call(tool, input, { requestState: stateId });

        // Assert
        expect(replay.isError).toBe(true);
        expect(text(replay)).toBe(ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON]);
        expect(confirmWrite).not.toHaveBeenCalled();
        expect(rejectWrite).not.toHaveBeenCalled();
        expect(mocks.notifyUsageConfirmed).not.toHaveBeenCalled();
        expect(mocks.notifyUsageRejected).not.toHaveBeenCalled();
    });
});
