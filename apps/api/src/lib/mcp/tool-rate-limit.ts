/**
 * @file tool-rate-limit.ts
 * @description Per-client, per-user rate limit of MCP tool calls (HOS-2184 T-009).
 *
 * Spec §6.4: a sliding window keyed on the access token's OAuth client plus the
 * user (`rl:mcp:<clientId>:<userId>`), stacked with the existing limiters and
 * driven by `HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS` / `HOSPEDA_MCP_RATE_LIMIT_MAX`.
 * It is built on the API's shared sliding-window store (Redis sorted set when
 * `HOSPEDA_RATE_LIMIT_BACKEND=redis`, in-memory otherwise), so no new algorithm
 * exists here.
 *
 * What it counts: `tools/call` only. It runs inside the MCP binding
 * (`bind-tool.ts`), which only tool calls reach; `initialize` and `tools/list`
 * are cheap, carry no side effects and are never counted.
 *
 * Exceeding the limit is a TOOL error (`RATE_LIMIT_EXCEEDED`, `isError` result
 * with the Spanish message), never an HTTP 429: the model sees the text and can
 * tell the user. Only admitted calls are recorded, so a client hammering a full
 * window does not extend its own block.
 *
 * Failure policy mirrors the existing limiters (fail-open): if the store
 * throws, the call is admitted and a warning is logged. The Redis store already
 * degrades to a per-process in-memory window on its own when Redis is down.
 *
 * It lives in the MCP binding, not in `runTool`, so the transport-agnostic
 * runner HOS-2185 reuses is not forced through this limiter.
 */

import { createConditionalSlidingWindowConsumer } from '../../middlewares/rate-limit';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';

/** Key prefix of the MCP limiter; the logical key is `rl:mcp:<clientId>:<userId>`. */
export const MCP_RATE_LIMIT_KEY_PREFIX = 'rl:mcp';

/**
 * Builds the identity part of the limiter key. Client first, so one user
 * connecting two clients gets two independent budgets, and two users of one
 * client never share one.
 *
 * @param args - OAuth client id and user id of the token
 * @returns `<clientId>:<userId>`
 */
export function buildMcpRateLimitIdentity({
    clientId,
    userId
}: {
    readonly clientId: string;
    readonly userId: string;
}): string {
    return `${clientId}:${userId}`;
}

/** Arguments for {@link consumeMcpToolCall}. RO-RO. */
export interface ConsumeMcpToolCallArgs {
    /** OAuth client id of the access token (`mcpAuth.clientId`). */
    readonly clientId: string;
    /** User the token acts as (`actor.id`). */
    readonly userId: string;
}

/**
 * Records one tool call against the caller's window.
 *
 * @param args - Client and user
 * @returns `true` when the call is admitted, `false` when the window is full.
 *   Never throws: a store failure admits the call (fail-open).
 *
 * @example
 * ```typescript
 * if (!(await consumeMcpToolCall({ clientId, userId }))) {
 *     return rateLimitedResult();
 * }
 * ```
 */
export async function consumeMcpToolCall({
    clientId,
    userId
}: ConsumeMcpToolCallArgs): Promise<boolean> {
    try {
        const consumer = createConditionalSlidingWindowConsumer({
            windowMs: env.HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS,
            max: env.HOSPEDA_MCP_RATE_LIMIT_MAX,
            keyPrefix: MCP_RATE_LIMIT_KEY_PREFIX
        });
        const admitted = await consumer.consume(buildMcpRateLimitIdentity({ clientId, userId }));
        if (!admitted) {
            apiLogger.warn(
                { event: 'mcp.rate_limit.exceeded', clientId, userId },
                'MCP tool call rate limit exceeded'
            );
        }
        return admitted;
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'MCP rate limiter failed, admitting the call'
        );
        return true;
    }
}
