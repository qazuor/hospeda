/**
 * HOS-2184 T-009 — per-client, per-user rate limit of MCP tool calls, both the
 * limiter itself and its enforcement in the MCP binding.
 *
 * @module test/lib/mcp/tool-rate-limit
 */

import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { handleMcpToolCall } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import {
    buildMcpRateLimitIdentity,
    consumeMcpToolCall,
    MCP_RATE_LIMIT_KEY_PREFIX
} from '../../../src/lib/mcp/tool-rate-limit';
import { defineTool } from '../../../src/mcp/tools/tool-definition';
import { clearSlidingWindowStore } from '../../../src/middlewares/rate-limit';
import { env, validateApiEnv } from '../../../src/utils/env';

const RATE_LIMIT_MESSAGE =
    'Hiciste demasiadas solicitudes seguidas. Esperá un momento y volvé a intentar.';
const USER_A = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const USER_B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CLIENT_X = 'https://claude.ai/oauth/mcp-client-metadata';
const CLIENT_Y = 'https://chatgpt.com/oauth/client';

function ctxFor({ clientId, userId }: { clientId: string; userId: string }) {
    const actor = {
        id: userId,
        roles: ['HOST'],
        permissions: [],
        emailVerified: true
    } as unknown as Actor;
    return {
        http: {
            authInfo: buildMcpAuthInfo({
                token: 'tok',
                actor,
                mcpAuth: { userId, clientId, clientName: 'Client', scopes: ['openid'] },
                resourceUrl: 'https://api.test/mcp'
            })
        }
    };
}

const handler = vi.fn(async () => ({ data: 'ok' }));
const definition = defineTool({
    name: 'probe_read',
    title: 'Probe',
    description: 'Probe',
    inputSchema: z.object({}),
    isWrite: false,
    handler
});

async function call(who: { clientId: string; userId: string }) {
    return handleMcpToolCall({ definition, input: {}, ctx: ctxFor(who) });
}

describe('MCP tool rate limit', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
        clearSlidingWindowStore();
        handler.mockClear();
        vi.spyOn(env, 'HOSPEDA_MCP_RATE_LIMIT_MAX', 'get').mockReturnValue(3);
        vi.spyOn(env, 'HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS', 'get').mockReturnValue(60_000);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('answers a call over the limit with a RATE_LIMIT_EXCEEDED tool error in Spanish', async () => {
        // Arrange
        const who = { clientId: CLIENT_X, userId: USER_A };
        for (let i = 0; i < 3; i++) await call(who);

        // Act
        const result = await call(who);

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([{ type: 'text', text: RATE_LIMIT_MESSAGE }]);
        expect(handler).toHaveBeenCalledTimes(3);
    });

    it('admits calls up to the configured max', async () => {
        // Arrange / Act
        const results = [];
        for (let i = 0; i < 3; i++)
            results.push(await call({ clientId: CLIENT_X, userId: USER_A }));

        // Assert
        expect(results.every((r) => r.isError !== true)).toBe(true);
    });

    it('keeps a different client of the same user independent', async () => {
        // Arrange
        for (let i = 0; i < 4; i++) await call({ clientId: CLIENT_X, userId: USER_A });

        // Act
        const other = await call({ clientId: CLIENT_Y, userId: USER_A });

        // Assert
        expect(other.isError).not.toBe(true);
    });

    it('keeps a different user of the same client independent', async () => {
        // Arrange
        for (let i = 0; i < 4; i++) await call({ clientId: CLIENT_X, userId: USER_A });

        // Act
        const other = await call({ clientId: CLIENT_X, userId: USER_B });

        // Assert
        expect(other.isError).not.toBe(true);
    });

    it('admits calls again once the window has passed', async () => {
        // Arrange
        const who = { clientId: CLIENT_X, userId: USER_A };
        for (let i = 0; i < 4; i++) await call(who);
        expect((await call(who)).isError).toBe(true);

        // Act
        vi.advanceTimersByTime(60_001);
        const result = await call(who);

        // Assert
        expect(result.isError).not.toBe(true);
    });

    it('does not extend the block with refused calls', async () => {
        // Arrange
        const who = { clientId: CLIENT_X, userId: USER_A };
        for (let i = 0; i < 3; i++) await call(who);
        vi.advanceTimersByTime(30_000);
        await call(who); // refused, must not be recorded

        // Act
        vi.advanceTimersByTime(30_001);
        const result = await call(who);

        // Assert
        expect(result.isError).not.toBe(true);
    });

    it('composes the key as rl:mcp:<clientId>:<userId>', async () => {
        // Arrange
        const identity = buildMcpRateLimitIdentity({ clientId: CLIENT_X, userId: USER_A });

        // Act
        await consumeMcpToolCall({ clientId: CLIENT_X, userId: USER_A });

        // Assert
        expect(`${MCP_RATE_LIMIT_KEY_PREFIX}:${identity}`).toBe(`rl:mcp:${CLIENT_X}:${USER_A}`);
        const { createConditionalSlidingWindowConsumer } = await import(
            '../../../src/middlewares/rate-limit'
        );
        const probe = createConditionalSlidingWindowConsumer({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'rl:mcp'
        });
        expect(await probe.count(`${CLIENT_X}:${USER_A}`)).toBe(1);
        expect(await probe.count(`${USER_A}:${CLIENT_X}`)).toBe(0);
    });

    it('does not touch the web session limiter keys', async () => {
        // Arrange
        const { createConditionalSlidingWindowConsumer } = await import(
            '../../../src/middlewares/rate-limit'
        );
        const web = createConditionalSlidingWindowConsumer({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'prot:user'
        });

        // Act
        for (let i = 0; i < 4; i++) await call({ clientId: CLIENT_X, userId: USER_A });

        // Assert
        expect(await web.count(USER_A)).toBe(0);
        expect(await web.consume(USER_A)).toBe(true);
    });

    it('admits the call when the limiter store fails (fail-open)', async () => {
        // Arrange
        vi.spyOn(env, 'HOSPEDA_MCP_RATE_LIMIT_MAX', 'get').mockImplementation(() => {
            throw new Error('store down');
        });

        // Act
        const admitted = await consumeMcpToolCall({ clientId: CLIENT_X, userId: USER_A });

        // Assert
        expect(admitted).toBe(true);
    });
});
