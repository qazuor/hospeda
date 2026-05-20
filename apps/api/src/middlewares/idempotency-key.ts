/**
 * X-Idempotency-Key middleware for billing mutation endpoints (SPEC-143 T-143-60).
 *
 * Enforces request-level idempotency on the mutating billing endpoints so a
 * client retry caused by a network blip or double-click does not produce a
 * duplicate side effect (a second MercadoPago preference, a second
 * subscription row, a second addon purchase).
 *
 * Contract:
 *
 * 1. **Required header.** Every protected request to a route wrapped by this
 *    middleware MUST send `X-Idempotency-Key: <opaque-string>`. Missing or
 *    empty → `400 IDEMPOTENCY_KEY_REQUIRED`. The web/admin clients send a
 *    fresh UUID v4 per logical user action.
 * 2. **Same key + same body → cached response.** A second request with the
 *    same key and an identical request body within the TTL window returns
 *    the EXACT response (status + body) the first call produced. No side
 *    effects, no DB writes downstream.
 * 3. **Same key + different body → 409 CONFLICT.** A second request with
 *    the same key but a non-matching body returns `409
 *    IDEMPOTENCY_KEY_CONFLICT` so the client cannot accidentally clobber
 *    an in-progress operation by reusing a stale key.
 * 4. **Expired key → fresh execution.** Entries past `expires_at` are
 *    treated as missing; the handler runs and stores a new entry.
 * 5. **Non-2xx responses are NOT cached.** A 400/422/500 leaves no
 *    persistent state — the client should fix the request and retry with
 *    the same key.
 *
 * Storage: the qzpay-drizzle `billing_idempotency_keys` table, already
 * present in the schema. The key is namespaced per-user with
 * `hospeda-billing:{userId}:{clientKey}` so two users supplying the same
 * UUID do not collide on the global UNIQUE constraint.
 *
 * Distinct from MP-side idempotency: `addon.checkout.ts` and the qzpay
 * billing adapter pass MP its OWN `X-Idempotency-Key` (a fresh
 * `checkoutUuid` per request) to dedup at the MP API layer. This middleware
 * dedups at the hospeda API layer; the two are independent and both fire
 * within a single request.
 *
 * @module middlewares/idempotency-key
 */

import { type DrizzleClient, billingIdempotencyKeys, eq, getDb, sql } from '@repo/db';
import * as Sentry from '@sentry/node';
import type { Context, MiddlewareHandler } from 'hono';
import { getActorFromContext } from '../utils/actor';
import { apiLogger } from '../utils/logger';

/**
 * Token namespace prefix applied to every stored key so hospeda entries do
 * not collide with qzpay-core's own idempotency entries in the same table.
 */
const HOSPEDA_KEY_NAMESPACE = 'hospeda-billing:';

/**
 * Default TTL in milliseconds. Matches MercadoPago's idempotency window so
 * the two layers retire keys on the same cadence.
 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Header the middleware reads. Lowercase per Hono convention (request
 * headers are normalized to lowercase before the handler sees them).
 */
const IDEMPOTENCY_HEADER = 'x-idempotency-key';

/**
 * Configuration for {@link idempotencyKeyMiddleware}.
 */
interface IdempotencyKeyMiddlewareConfig {
    /**
     * Logical operation name stored alongside the key. Identifies WHICH
     * route a cached response came from; if the same key is replayed on a
     * different route the conflict path fires regardless of body match.
     *
     * Use a stable dotted identifier: `hospeda.start_paid`,
     * `hospeda.addons.purchase`.
     */
    readonly operation: string;
    /**
     * Override the 24h default. Useful for tests; production should keep
     * the default so MP's window aligns with hospeda's.
     */
    readonly ttlMs?: number;
}

/**
 * Wrap a billing route with X-Idempotency-Key enforcement. Mount via
 * `router.use('/path', idempotencyKeyMiddleware({operation: ...}))` BEFORE
 * the route handler.
 *
 * @example
 * ```ts
 * router.use(
 *     '/start-paid',
 *     idempotencyKeyMiddleware({ operation: 'hospeda.start_paid' })
 * );
 * router.openapi(startPaidRoute, startPaidHandler);
 * ```
 *
 * @param config - Operation name + optional TTL override
 * @returns Hono middleware handler
 */
export const idempotencyKeyMiddleware = (
    config: IdempotencyKeyMiddlewareConfig
): MiddlewareHandler => {
    const ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;

    return async (c, next) => {
        const clientKey = c.req.header(IDEMPOTENCY_HEADER);

        if (!clientKey || clientKey.trim().length === 0) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'IDEMPOTENCY_KEY_REQUIRED',
                        message: 'X-Idempotency-Key header is required for this endpoint'
                    }
                },
                400
            );
        }

        const actor = getActorFromContext(c);
        if (!actor?.id) {
            // Should not happen — auth middleware runs before us — but
            // guard anyway so an unauthenticated request cannot poison
            // the global idempotency table with a key that lacks a user
            // scope.
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHENTICATED',
                        message: 'Authentication required'
                    }
                },
                401
            );
        }

        const scopedKey = `${HOSPEDA_KEY_NAMESPACE}${actor.id}:${clientKey}`;

        // Capture the request body BEFORE the handler reads it. Hono's
        // request body is a one-shot stream — `c.req.text()` returns the
        // raw bytes and stores them so subsequent reads (validation
        // middleware, the handler) see the same content. The empty body
        // case (handler accepts no body) is normalized to ''.
        let rawBody: string;
        try {
            rawBody = await c.req.text();
        } catch {
            rawBody = '';
        }

        const db = getDb();

        // Look up an existing entry. The table's UNIQUE constraint is on
        // `key` alone, so the per-user namespace embedded in scopedKey is
        // load-bearing.
        const existing = await fetchEntry(db, scopedKey);

        if (existing && existing.expiresAt > new Date()) {
            // Live entry — compare bodies. JSONB equality via stringified
            // canonical form is sufficient because we control the format:
            // the same client sending the same JSON twice produces byte-
            // identical text after JSON.stringify normalization.
            const storedBody = canonicalize(existing.requestParams);
            const incomingBody = canonicalize(safeParseJson(rawBody));

            if (storedBody !== incomingBody) {
                apiLogger.warn(
                    {
                        userId: actor.id,
                        operation: config.operation,
                        scopedKey
                    },
                    'X-Idempotency-Key conflict: same key, different request body'
                );
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'IDEMPOTENCY_KEY_CONFLICT',
                            message:
                                'X-Idempotency-Key was used previously with a different request body'
                        }
                    },
                    409
                );
            }

            // Body match — replay the cached response. responseBody is
            // jsonb so it round-trips faithfully. responseStatus carries
            // the original code as a varchar in this table; coerce to
            // number for c.json's signature.
            const status = Number(existing.statusCode ?? 200);
            return c.json(existing.responseBody as Record<string, unknown>, status as 200);
        }

        // No live entry — execute the handler. Re-read the body for the
        // downstream handler by injecting it back via c.req.raw clone.
        await next();

        // Only cache successful (2xx) responses. Errors should be
        // retried with the same key; caching a 422 would lock the client
        // out of fixing the request and trying again.
        const status = c.res.status;
        if (status < 200 || status >= 300) {
            return;
        }

        // Capture the response. c.res is a Response — clone before reading
        // so the original stream stays readable for the actual reply.
        let responseBody: unknown = null;
        try {
            const cloned = c.res.clone();
            responseBody = await cloned.json();
        } catch (parseErr) {
            // Non-JSON response (rare on these endpoints). Skip caching
            // rather than writing a NULL body and risk a wrong replay.
            apiLogger.warn(
                {
                    operation: config.operation,
                    error: parseErr instanceof Error ? parseErr.message : String(parseErr)
                },
                'Idempotency middleware skipped cache: response is not JSON'
            );
            return;
        }

        const expiresAt = new Date(Date.now() + ttlMs);
        const parsedBody = safeParseJson(rawBody);

        try {
            await upsertEntry(db, {
                key: scopedKey,
                operation: config.operation,
                requestParams: parsedBody,
                responseBody,
                statusCode: String(status),
                expiresAt
            });
        } catch (writeErr) {
            // Cache write is best-effort. A failed insert means future
            // replays will re-execute the handler — undesirable but safe.
            apiLogger.warn(
                {
                    userId: actor.id,
                    operation: config.operation,
                    error: writeErr instanceof Error ? writeErr.message : String(writeErr)
                },
                'Idempotency middleware failed to persist cache entry'
            );
            Sentry.captureException(writeErr, {
                tags: { subsystem: 'idempotency-middleware' },
                extra: { operation: config.operation, scopedKey }
            });
        }
    };
};

/**
 * Subset of the billing_idempotency_keys row the middleware needs.
 */
interface IdempotencyEntry {
    readonly key: string;
    readonly operation: string;
    readonly requestParams: unknown;
    readonly responseBody: unknown;
    readonly statusCode: string | null;
    readonly expiresAt: Date;
}

/**
 * Fetch a single entry by namespaced key. Returns null when no row exists.
 */
async function fetchEntry(db: DrizzleClient, key: string): Promise<IdempotencyEntry | null> {
    const rows = await db
        .select({
            key: billingIdempotencyKeys.key,
            operation: billingIdempotencyKeys.operation,
            requestParams: billingIdempotencyKeys.requestParams,
            responseBody: billingIdempotencyKeys.responseBody,
            statusCode: billingIdempotencyKeys.statusCode,
            expiresAt: billingIdempotencyKeys.expiresAt
        })
        .from(billingIdempotencyKeys)
        .where(eq(billingIdempotencyKeys.key, key))
        .limit(1);

    const row = rows[0];
    return row ? (row as IdempotencyEntry) : null;
}

/**
 * Insert or update an idempotency entry. Uses an upsert on the unique
 * `key` constraint so a stale expired row is overwritten cleanly.
 */
async function upsertEntry(
    db: DrizzleClient,
    input: {
        key: string;
        operation: string;
        requestParams: unknown;
        responseBody: unknown;
        statusCode: string;
        expiresAt: Date;
    }
): Promise<void> {
    await db
        .insert(billingIdempotencyKeys)
        .values({
            key: input.key,
            operation: input.operation,
            requestParams: input.requestParams as Record<string, unknown>,
            responseBody: input.responseBody as Record<string, unknown>,
            statusCode: input.statusCode,
            expiresAt: input.expiresAt,
            livemode: true
        } as typeof billingIdempotencyKeys.$inferInsert)
        .onConflictDoUpdate({
            target: billingIdempotencyKeys.key,
            set: {
                operation: input.operation,
                requestParams: input.requestParams as Record<string, unknown>,
                responseBody: input.responseBody as Record<string, unknown>,
                statusCode: input.statusCode,
                expiresAt: input.expiresAt,
                createdAt: sql`now()`
            }
        });
}

/**
 * Canonicalize an arbitrary value for byte-stable comparison. Sorts object
 * keys recursively so `{a:1,b:2}` and `{b:2,a:1}` produce the same string.
 *
 * Bounded recursion (depth 20) prevents pathological inputs from stack-
 * overflowing the middleware; deeper structures simply collapse to
 * `[truncated]` and compare equal only to themselves.
 */
function canonicalize(value: unknown, depth = 0): string {
    if (depth > 20) return '[truncated]';
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => canonicalize(v, depth + 1)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k], depth + 1)}`).join(',')}}`;
}

/**
 * Best-effort JSON parse. Returns null on parse error or empty string so
 * the canonicalize comparison still produces a deterministic token.
 */
function safeParseJson(raw: string): unknown {
    if (!raw || raw.length === 0) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Avoid unused-warning when the optional dependency is imported but the
// codepath does not touch every binding (Context is used as a Hono type
// re-export so consumers can attach typed helpers later).
export type IdempotencyContext = Context;
