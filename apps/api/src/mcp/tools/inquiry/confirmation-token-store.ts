/**
 * @file confirmation-token-store.ts
 * @description Single-use confirmation tokens for `reply_inquiry` (HOS-2184
 * T-022, spec §6.7).
 *
 * The first `reply_inquiry` call (moderation preview) calls
 * {@link issueConfirmationToken}; the second call (the actual send) calls
 * {@link consumeConfirmationToken} with the same text. A token is:
 * - **Bound** to `(userId, conversationId, sha256(text))`. Any change to the
 *   text, the user or the conversation makes it unusable.
 * - **Single-use.** Consumption is one atomic `GETDEL`, so two concurrent
 *   calls with the same token cannot both succeed. A mismatching attempt also
 *   burns the token: the caller must ask for a new preview, which is the safe
 *   behaviour for "the text changed".
 * - **Short-lived.** Redis TTL of {@link CONFIRMATION_TOKEN_TTL_SECONDS}.
 * - **Secret.** 256 random bits (`crypto.randomBytes`), returned once to the
 *   caller and never logged. Redis only holds the sha256 of the token as part
 *   of the key, so a Redis dump does not yield usable tokens.
 *
 * Redis-unavailable policy: FAIL CLOSED. Confirming a write needs proof that
 * the preview was shown, and without Redis there is none. Unlike the rate
 * limiter (fail-open), both functions answer `UNAVAILABLE` when Redis is not
 * configured, not connected, or throws. There is deliberately no in-memory
 * fallback: it would not be shared across API instances and would let a
 * confirmation succeed or fail depending on which instance answered.
 *
 * Requires Redis >= 6.2 (`GETDEL`).
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type Redis from 'ioredis';
import { apiLogger } from '../../../utils/logger';
import { getRedisClient } from '../../../utils/redis';

/** Lifetime of a confirmation token, in seconds (spec §6.7: 10 minutes). */
export const CONFIRMATION_TOKEN_TTL_SECONDS = 600;

/** Redis key prefix of confirmation tokens. */
export const CONFIRMATION_TOKEN_KEY_PREFIX = 'mcp:reply-confirm:';

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
    /** The conversation being replied to. */
    readonly conversationId: string;
    /** The exact reply text. */
    readonly text: string;
}

/** Minimal Redis surface used here; lets tests inject a fake. */
export type ConfirmationRedis = Pick<Redis, 'set' | 'getdel'>;

/** Optional injection point for the Redis client (tests). */
export interface ConfirmationStoreDeps {
    /** Resolves the Redis client; defaults to the API's shared client. */
    readonly getRedis?: () => Promise<ConfirmationRedis | undefined>;
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
function bindingDigest({ userId, conversationId, text }: ConfirmationBinding): string {
    return sha256Hex(
        `${userId.length}:${userId}|${conversationId.length}:${conversationId}|${sha256Hex(text)}`
    );
}

const keyFor = (token: string): string => `${CONFIRMATION_TOKEN_KEY_PREFIX}${sha256Hex(token)}`;

/** Resolves Redis, treating any failure as "unavailable". */
async function resolveRedis(deps: ConfirmationStoreDeps): Promise<ConfirmationRedis | undefined> {
    try {
        return await (deps.getRedis ?? getRedisClient)();
    } catch {
        return undefined;
    }
}

/** Logs a store failure. Never receives the token or the text. */
function logUnavailable({
    op,
    error
}: {
    readonly op: 'issue' | 'consume';
    readonly error?: unknown;
}) {
    apiLogger.warn(
        {
            event: 'mcp.confirmation_token.unavailable',
            op,
            ...(error === undefined
                ? {}
                : { error: error instanceof Error ? error.message : String(error) })
        },
        'MCP confirmation token store unavailable, failing closed'
    );
}

/**
 * Issues a single-use token for a reply preview.
 *
 * @param args - The binding (user, conversation, text) and optional deps
 * @returns The token and its lifetime, or `UNAVAILABLE` when Redis cannot
 *   store it (fail closed: no preview without a confirmable token)
 *
 * @example
 * ```typescript
 * const issued = await issueConfirmationToken({ userId, conversationId, text });
 * if (!issued.ok) return toolError('unavailable');
 * return preview({ token: issued.token });
 * ```
 */
export async function issueConfirmationToken(
    args: IssueConfirmationTokenArgs
): Promise<IssueConfirmationTokenResult> {
    const redis = await resolveRedis(args);
    if (!redis) {
        logUnavailable({ op: 'issue' });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    const token = randomBytes(32).toString('base64url');
    try {
        await redis.set(keyFor(token), bindingDigest(args), 'EX', CONFIRMATION_TOKEN_TTL_SECONDS);
    } catch (error) {
        logUnavailable({ op: 'issue', error });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    return { ok: true, token, expiresInSeconds: CONFIRMATION_TOKEN_TTL_SECONDS };
}

/**
 * Consumes a token atomically. Succeeds at most once per token, and only when
 * the binding matches. A failed attempt on an existing token still burns it.
 *
 * @param args - The token, the binding presented now, and optional deps
 * @returns `{ ok: true }` when the send may proceed; `INVALID` for an unknown,
 *   expired, reused or mismatching token; `UNAVAILABLE` when Redis fails
 *   (fail closed: the write must not proceed)
 *
 * @example
 * ```typescript
 * const consumed = await consumeConfirmationToken({ token, userId, conversationId, text });
 * if (!consumed.ok) return toolError(consumed.reason);
 * await messageService.createMessage(...);
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
        logUnavailable({ op: 'consume' });
        return { ok: false, reason: 'UNAVAILABLE' };
    }
    let stored: string | null;
    try {
        stored = await redis.getdel(keyFor(token));
    } catch (error) {
        logUnavailable({ op: 'consume', error });
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
