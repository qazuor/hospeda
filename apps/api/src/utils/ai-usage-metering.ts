/**
 * Best-effort AI usage metering helper (HOS-328).
 *
 * ## Why every AI feature must call this
 *
 * `createAiQuotaMiddleware` enforces a monthly quota by reading
 * `getMonthlyCallCount`, which derives that counter by COUNTING rows in
 * `ai_usage` — and counts only rows whose status is `'success'` or
 * `'fallback'`. A feature that checks its quota but never records usage
 * therefore has a counter frozen at zero: the quota is unenforceable and the
 * spend is invisible to the platform USD ceiling. That was the HOS-328 defect
 * in `search`, `text_improve` and `translate`.
 *
 * Because the counter counts ROWS, the row is also the billing unit. Every
 * caller writes exactly ONE row per request, summing the tokens of however
 * many provider calls that request made (`translate` makes one per field ×
 * locale, `search` makes two). Writing one row per provider call would make a
 * request cost an unpredictable 1..N quota units and would silently divide
 * every plan's effective quota by the entity's field count — the per-plan
 * limit values were calibrated against requests.
 *
 * ## Contract
 *
 * By the time metering runs the AI work has already completed and, on the
 * streaming routes, already been delivered to the caller. So this helper is
 * both:
 *
 *   - **non-throwing** — a storage failure is logged and swallowed, never
 *     surfaced as a request failure; and
 *   - **time-bounded** — it stops *waiting* after {@link METERING_TIMEOUT_MS}
 *     so a stalled connection pool cannot hold the HTTP response (or the SSE
 *     `done` frame) hostage. The insert itself is not cancelled: it keeps
 *     running and still lands, we simply stop blocking the caller on it.
 *
 * `chat.ts` predates this helper and keeps its own inline metering blocks with
 * feature-specific log context (owner-keyed vs consumer-keyed rows); it is
 * deliberately left untouched.
 *
 * @module utils/ai-usage-metering
 */

import { recordAiUsage } from '@repo/ai-core';
import type { AiFeature } from '@repo/schemas';
import { apiLogger } from './logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How long a caller will wait for the `ai_usage` insert before giving up on it.
 *
 * Mirrors the intent of `PERSISTENCE_TIMEOUT_MS` in `search-chat.ts`: the SSE
 * `done` frame is only emitted after the route's `meta` promise settles, so any
 * unbounded await placed in that chain becomes unbounded client latency.
 */
export const METERING_TIMEOUT_MS = 1500;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Input for {@link meterAiUsage}.
 */
export type MeterAiUsageInput = {
    /** UUID of the user the usage is billed to. */
    readonly userId: string;
    /**
     * AI feature key. Typed as {@link AiFeature} rather than `string` on
     * purpose: this value is the join key between the writer (this helper) and
     * the reader (`getMonthlyCallCount`), so a typo would write rows under a
     * key nobody queries and silently reproduce the exact HOS-328 bug — a
     * counter frozen at zero, with no error anywhere.
     */
    readonly feature: AiFeature;
    /** Provider that served the call, as reported by the engine. */
    readonly provider: string;
    /** Model identifier that served the call, as reported by the engine. */
    readonly model: string;
    /** Input tokens consumed. For multi-call requests, the sum across calls. */
    readonly promptTokens: number;
    /** Output tokens generated. For multi-call requests, the sum across calls. */
    readonly completionTokens: number;
    /** End-to-end latency of the metered work, in milliseconds. */
    readonly latencyMs: number;
    /**
     * Call outcome.
     *
     * Only `'success'` and `'fallback'` count against the monthly quota, so
     * this field is a billing decision, not a log level. A request whose AI
     * work failed — or that was never delivered to the caller — must be
     * recorded as `'error'`: the spend stays visible for cost and diagnostics
     * without charging the caller a quota unit for nothing.
     *
     * `'fallback'` is a valid `ai_usage` status but no current caller produces
     * it: the engine's fallback decision is not yet surfaced to route code.
     */
    readonly status: 'success' | 'fallback' | 'error';
    /**
     * Extra fields merged into the warning log emitted when metering fails.
     * Use it to carry the identifiers that make a lost row diagnosable
     * (entity id, locale, ...).
     */
    readonly logContext?: Readonly<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// meterAiUsage
// ---------------------------------------------------------------------------

/**
 * Records one `ai_usage` row, swallowing any failure and bounding the wait.
 *
 * Never throws and never rejects. Non-finite token counts are normalised to 0
 * so a malformed provider `usage` payload cannot turn metering into a request
 * failure (or write a `NaN` into an integer column).
 *
 * @param input - {@link MeterAiUsageInput}
 * @returns Resolves once the row is written, the failure has been logged, or
 *   {@link METERING_TIMEOUT_MS} elapsed — whichever comes first.
 *
 * @example
 * ```ts
 * await meterAiUsage({
 *   userId: actor.id,
 *   feature: 'text_improve',
 *   provider: meta.provider,
 *   model: meta.model,
 *   promptTokens: meta.usage.promptTokens,
 *   completionTokens: meta.usage.completionTokens,
 *   latencyMs: Date.now() - startedAtMs,
 *   status: 'success'
 * });
 * ```
 */
export async function meterAiUsage(input: MeterAiUsageInput): Promise<void> {
    const {
        userId,
        feature,
        provider,
        model,
        promptTokens,
        completionTokens,
        latencyMs,
        status,
        logContext
    } = input;

    // The whole body is guarded, not just the awaited write: callers depend on
    // this function never rejecting, and a synchronous throw (a broken DI wiring,
    // a partial module mock) would otherwise escape and — in the streaming
    // routes — turn a fully delivered response into an SSE `error` frame.
    try {
        let timedOut = false;

        // The write promise always carries its own catch, so it stays handled
        // even once the timeout below stops us awaiting it.
        const writePromise = recordAiUsage({
            userId,
            feature,
            provider,
            model,
            promptTokens: toTokenCount({ value: promptTokens }),
            completionTokens: toTokenCount({ value: completionTokens }),
            latencyMs,
            status
        })
            .then(() => undefined)
            .catch((meteringError: unknown) => {
                const payload = {
                    ...logContext,
                    userId,
                    feature,
                    error:
                        meteringError instanceof Error
                            ? meteringError.message
                            : String(meteringError)
                };

                // Once the timeout has already reported this row as at-risk, a
                // late failure is the expected follow-up, not new information.
                // Logging both at `warn` would double the noise in exactly the
                // incident (a stalled pool) where the log matters most.
                if (timedOut) {
                    apiLogger.debug(
                        payload,
                        `${feature}: ai_usage insert failed after the metering timeout had already been reported`
                    );
                    return;
                }

                apiLogger.warn(payload, `${feature}: failed to record ai_usage row (non-fatal)`);
            });

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<'timeout'>((resolve) => {
            timeoutHandle = setTimeout(() => resolve('timeout'), METERING_TIMEOUT_MS);
        });

        try {
            const outcome = await Promise.race([writePromise, timeoutPromise]);

            if (outcome === 'timeout') {
                timedOut = true;
                apiLogger.warn(
                    { ...logContext, userId, feature, timeoutMs: METERING_TIMEOUT_MS },
                    `${feature}: ai_usage insert exceeded the metering timeout — no longer waiting on it (the write may still land)`
                );
            }
        } finally {
            clearTimeout(timeoutHandle);
        }
    } catch (unexpectedError) {
        apiLogger.warn(
            {
                ...logContext,
                userId,
                feature,
                error:
                    unexpectedError instanceof Error
                        ? unexpectedError.message
                        : String(unexpectedError)
            },
            `${feature}: ai_usage metering threw unexpectedly (non-fatal — swallowed to protect the response)`
        );
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Coerces a token count into a non-negative finite integer.
 *
 * Token counts come from provider adapters. A missing or malformed `usage`
 * payload would otherwise propagate `NaN` into the `integer` columns
 * `tokens_in` / `tokens_out` and fail the insert.
 *
 * @param input - `{ value }`: raw token count reported by the engine.
 * @returns The value when it is a finite positive number, otherwise 0.
 */
function toTokenCount({ value }: { readonly value: number }): number {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
