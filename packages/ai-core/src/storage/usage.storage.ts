/**
 * AI usage + request-log storage helpers (SPEC-173 T-010).
 *
 * Both tables are APPEND-ONLY — rows are never updated or soft-deleted.
 * Cost values MUST be integer micro-USD (µUSD — millionths of a US dollar;
 * 1 USD = 1,000,000 µUSD). USD native, no FX conversion. NEVER float.
 *
 * PII policy (§5.10): the CALLER is responsible for redacting emails, phone
 * numbers, payment card numbers, and any other PII from `requestMetadata`
 * BEFORE passing it to {@link insertAiRequestLog}.  This module does NOT
 * perform PII scrubbing — it trusts the caller.
 *
 * @module ai-core/storage/usage
 */

import { aiRequestLog, aiUsage, getDb } from '@repo/db';
import type {
    DrizzleClient,
    InsertAiRequestLog,
    InsertAiUsage,
    SelectAiRequestLog,
    SelectAiUsage
} from '@repo/db';

// ---------------------------------------------------------------------------
// insertAiUsage
// ---------------------------------------------------------------------------

/**
 * Input for {@link insertAiUsage}.
 */
export interface InsertAiUsageInput {
    /**
     * UUID of the authenticated user who triggered the AI call.
     * `null` for system-initiated calls or when actor resolution failed.
     */
    readonly userId: string | null;
    /** AI feature that was invoked. */
    readonly feature: string;
    /** Provider that served or attempted the call. */
    readonly provider: string;
    /**
     * Model identifier as returned by the provider adapter (e.g. `gpt-4o`).
     * Stored verbatim for cost attribution.
     */
    readonly model: string;
    /** Number of input (prompt) tokens consumed. */
    readonly tokensIn: number;
    /** Number of output (completion) tokens generated. */
    readonly tokensOut: number;
    /**
     * Estimated call cost in **integer micro-USD** (µUSD — millionths of a US dollar;
     * 1 USD = 1,000,000 µUSD). USD native, no FX conversion. NEVER pass a float here.
     */
    readonly costEstimateMicroUsd: number;
    /** End-to-end latency of the AI call in milliseconds. */
    readonly latencyMs: number;
    /** Call outcome: `success | error | fallback | quota_exceeded | ceiling_hit | kill_switch`. */
    readonly status: string;
    /** Optional transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * Appends one metering row to `ai_usage`.
 *
 * This is an append-only operation — rows are never updated or soft-deleted.
 * The `id` and `createdAt` columns are set by the database defaults.
 *
 * @param input - {@link InsertAiUsageInput}
 * @returns The inserted `ai_usage` row.
 *
 * @example
 * ```ts
 * await insertAiUsage({
 *   userId: actor.userId,
 *   feature: 'text_improve',
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   tokensIn: 250,
 *   tokensOut: 180,
 *   costEstimateMicroUsd: 146,
 *   latencyMs: 820,
 *   status: 'success',
 * });
 * ```
 */
export async function insertAiUsage(input: InsertAiUsageInput): Promise<SelectAiUsage> {
    const { tx, ...rest } = input;
    const db = tx ?? getDb();

    const values: InsertAiUsage = {
        userId: rest.userId,
        feature: rest.feature,
        provider: rest.provider,
        model: rest.model,
        tokensIn: rest.tokensIn,
        tokensOut: rest.tokensOut,
        costEstimateMicroUsd: rest.costEstimateMicroUsd,
        latencyMs: rest.latencyMs,
        status: rest.status
    };

    const rows = await db.insert(aiUsage).values(values).returning();

    const row: SelectAiUsage | undefined = rows[0];
    if (!row) {
        throw new Error('insertAiUsage returned no row — unexpected database state');
    }

    return row;
}

// ---------------------------------------------------------------------------
// insertAiRequestLog
// ---------------------------------------------------------------------------

/**
 * Input for {@link insertAiRequestLog}.
 */
export interface InsertAiRequestLogInput {
    /**
     * UUID of the authenticated user who triggered the request.
     * `null` for system-initiated calls or requests rejected before actor
     * resolution.
     */
    readonly userId: string | null;
    /** AI feature that was invoked. */
    readonly feature: string;
    /** Provider that served or attempted the call. */
    readonly provider: string;
    /**
     * PII-scrubbed request metadata.
     * The CALLER must redact all PII (emails, phones, card numbers) BEFORE
     * passing this object.  This module trusts the caller.
     *
     * May include: sanitised input excerpt, model, params, request id, trace
     * id, fallback chain info, error code.
     */
    readonly requestMetadata: Record<string, unknown>;
    /** Optional transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * Appends one debug row to `ai_request_log`.
 *
 * This is an append-only operation — rows are never updated or soft-deleted.
 * The `id` and `createdAt` columns are set by the database defaults.
 *
 * **PII reminder**: ensure `requestMetadata` has been scrubbed of all PII
 * (§5.10) before calling this function.
 *
 * @param input - {@link InsertAiRequestLogInput}
 * @returns The inserted `ai_request_log` row.
 *
 * @example
 * ```ts
 * await insertAiRequestLog({
 *   userId: actor.userId,
 *   feature: 'chat',
 *   provider: 'anthropic',
 *   requestMetadata: {
 *     model: 'claude-3-5-sonnet-20241022',
 *     inputExcerpt: '[REDACTED]',
 *     traceId: 'abc-123',
 *   },
 * });
 * ```
 */
export async function insertAiRequestLog(
    input: InsertAiRequestLogInput
): Promise<SelectAiRequestLog> {
    const { tx, ...rest } = input;
    const db = tx ?? getDb();

    const values: InsertAiRequestLog = {
        userId: rest.userId,
        feature: rest.feature,
        provider: rest.provider,
        requestMetadata: rest.requestMetadata
    };

    const rows = await db.insert(aiRequestLog).values(values).returning();

    const row: SelectAiRequestLog | undefined = rows[0];
    if (!row) {
        throw new Error('insertAiRequestLog returned no row — unexpected database state');
    }

    return row;
}
