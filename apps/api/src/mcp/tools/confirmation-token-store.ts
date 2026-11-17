/**
 * @file confirmation-token-store.ts
 * @description Generalized single-use confirmation tokens for two-step MCP
 * write tools (HOS-2335 spec §5.2; born as the `reply_inquiry` store of
 * HOS-2184 T-022).
 *
 * A preview call issues a token with {@link issueConfirmationToken}; the commit
 * call consumes it with {@link consumeConfirmationToken}, presenting the same
 * payload. A token is:
 * - **Bound** to `(userId, clientId, tool, subjectId, sha256(canonicalJson(payload)))`.
 *   Any change to one of them makes it unusable. A token never crosses users,
 *   OAuth clients, tools or subjects.
 * - **Single-use.** Consumption is one atomic `GETDEL`, so two concurrent calls
 *   with the same token cannot both succeed. A mismatching attempt also burns
 *   the token: the caller must ask for a new preview.
 * - **Short-lived.** Redis TTL of {@link CONFIRMATION_TOKEN_TTL_SECONDS}.
 * - **Secret.** 256 random bits, returned once and never logged. Redis only
 *   holds the sha256 of the token as part of the key.
 *
 * Each tool has its own Redis key prefix (`mcp:confirm:<tool>:` by default).
 *
 * Redis-unavailable policy: FAIL CLOSED. Without Redis there is no proof that
 * the preview was shown, so both functions answer `UNAVAILABLE`. There is
 * deliberately no in-memory fallback (it would not be shared across instances).
 *
 * Requires Redis >= 6.2 (`GETDEL`). Imports nothing from `lib/mcp/` (HOS-2185
 * reuse).
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type Redis from 'ioredis';
import { apiLogger } from '../../utils/logger';
import { getRedisClient } from '../../utils/redis';
import { type CanonicalJsonValue, canonicalJson } from './canonical-json';

/** Lifetime of a confirmation token, in seconds (10 minutes). */
export const CONFIRMATION_TOKEN_TTL_SECONDS = 600;

/** Why a token could not be issued or consumed. */
export type ConfirmationTokenFailureReason =
    /** Redis is not configured, not connected, or errored. Fail closed. */
    | 'UNAVAILABLE'
    /** Unknown, expired, already used, or bound to something else. Deliberately indistinguishable. */
    | 'INVALID';

/** The binding a token is tied to. */
export interface ConfirmationBinding {
    /** The authenticated user. */
    readonly userId: string;
    /** The OAuth client the preview was shown through. */
    readonly clientId: string;
    /** The tool name (for example `reply_inquiry`). */
    readonly tool: string;
    /** The entity the write targets (conversation id, vertical, listing id...). */
    readonly subjectId: string;
    /** The exact payload the user saw. Hashed canonically (key order is irrelevant). */
    readonly payload: CanonicalJsonValue;
}

/** Minimal Redis surface used here; lets tests inject a fake. */
export type ConfirmationRedis = Pick<Redis, 'set' | 'getdel'>;

/** Optional injection and configuration points. */
export interface ConfirmationStoreDeps {
    /** Resolves the Redis client; defaults to the API's shared client. */
    readonly getRedis?: () => Promise<ConfirmationRedis | undefined>;
    /** Overrides the key prefix (default `mcp:confirm:<tool>:`). Used to keep legacy keys. */
    readonly keyPrefix?: string;
}

/** Arguments for {@link issueConfirmationToken}. */
export interface IssueConfirmationTokenArgs extends ConfirmationBinding, ConfirmationStoreDeps {}

/** Result of {@link issueConfirmationToken}. */
export type IssueConfirmationTokenResult =
    | { readonly ok: true; readonly token: string; readonly expiresInSeconds: number }
    | { readonly ok: false; readonly reason: 'UNAVAILABLE' };

/** Arguments for {@link consumeConfirmationToken}. */
export interface ConsumeConfirmationTokenArgs extends ConfirmationBinding, ConfirmationStoreDeps {
    /** The token received from {@link issueConfirmationToken}. */
    readonly token: string;
}

/** Result of {@link consumeConfirmationToken}. */
export type ConsumeConfirmationTokenResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: ConfirmationTokenFailureReason };

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Digest of the binding. Length-prefixed fields so no field can bleed into another. */
function bindingDigest({
    userId,
    clientId,
    tool,
    subjectId,
    payload
}: ConfirmationBinding): string {
    return sha256Hex(
        `${userId.length}:${userId}|${clientId.length}:${clientId}|${tool.length}:${tool}|${subjectId.length}:${subjectId}|${sha256Hex(canonicalJson(payload))}`
    );
}

const prefixFor = ({ tool, keyPrefix }: { tool: string; keyPrefix?: string }): string =>
    keyPrefix ?? `mcp:confirm:${tool}:`;

const keyFor = ({
    token,
    tool,
    keyPrefix
}: {
    token: string;
    tool: string;
    keyPrefix?: string;
}): string => `${prefixFor({ tool, keyPrefix })}${sha256Hex(token)}`;

/** Resolves Redis, treating any failure as "unavailable". */
async function resolveRedis(deps: ConfirmationStoreDeps): Promise<ConfirmationRedis | undefined> {
    try {
        return await (deps.getRedis ?? getRedisClient)();
    } catch {
        return undefined;
    }
}

/** Logs a store failure. Never receives the token or the payload. */
function logUnavailable({
    op,
    tool,
    error
}: {
    readonly op: 'issue' | 'consume';
    readonly tool: string;
    readonly error?: unknown;
}) {
    apiLogger.warn(
        {
            event: 'mcp.confirmation_token.unavailable',
            op,
            tool,
            ...(error === undefined
                ? {}
                : { error: error instanceof Error ? error.message : String(error) })
        },
        'MCP confirmation token store unavailable, failing closed'
    );
}

/**
 * Issues a single-use token for a write preview.
 *
 * @param args - The binding (user, client, tool, subject, payload) and optional deps
 * @returns The token and its lifetime, or `UNAVAILABLE` when Redis cannot
 *   store it (fail closed: no preview without a confirmable token)
 *
 * @example
 * ```typescript
 * const issued = await issueConfirmationToken({
 *     userId, clientId, tool: 'create_listing', subjectId: vertical, payload
 * });
 * if (!issued.ok) return unavailable();
 * ```
 */
export async function issueConfirmationToken(
    args: IssueConfirmationTokenArgs
): Promise<IssueConfirmationTokenResult> {
    const redis = await resolveRedis(args);
    if (!redis) {
        logUnavailable({ op: 'issue', tool: args.tool });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    const token = randomBytes(32).toString('base64url');
    try {
        await redis.set(
            keyFor({ token, tool: args.tool, keyPrefix: args.keyPrefix }),
            bindingDigest(args),
            'EX',
            CONFIRMATION_TOKEN_TTL_SECONDS
        );
    } catch (error) {
        logUnavailable({ op: 'issue', tool: args.tool, error });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    return { ok: true, token, expiresInSeconds: CONFIRMATION_TOKEN_TTL_SECONDS };
}

/**
 * Consumes a token atomically. Succeeds at most once per token, and only when
 * the binding matches. A failed attempt on an existing token still burns it.
 *
 * @param args - The token, the binding presented now, and optional deps
 * @returns `{ ok: true }` when the write may proceed; `INVALID` for an unknown,
 *   expired, reused or mismatching token; `UNAVAILABLE` when Redis fails
 *   (fail closed: the write must not proceed)
 *
 * @example
 * ```typescript
 * const consumed = await consumeConfirmationToken({ token, userId, clientId, tool, subjectId, payload });
 * if (!consumed.ok) return refuse(consumed.reason);
 * ```
 */
export async function consumeConfirmationToken(
    args: ConsumeConfirmationTokenArgs
): Promise<ConsumeConfirmationTokenResult> {
    const { token } = args;
    if (token.length === 0) {
        return { ok: false, reason: 'INVALID' };
    }
    const redis = await resolveRedis(args);
    if (!redis) {
        logUnavailable({ op: 'consume', tool: args.tool });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    let stored: string | null;
    try {
        stored = await redis.getdel(keyFor({ token, tool: args.tool, keyPrefix: args.keyPrefix }));
    } catch (error) {
        logUnavailable({ op: 'consume', tool: args.tool, error });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    if (stored === null) {
        return { ok: false, reason: 'INVALID' };
    }
    const expected = Buffer.from(bindingDigest(args));
    const actual = Buffer.from(stored);
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    return matches ? { ok: true } : { ok: false, reason: 'INVALID' };
}
