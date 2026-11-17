/**
 * @file confirmation-token-store.ts
 * @description `reply_inquiry` adapter over the generalized confirmation store
 * (`../confirmation-token-store`, HOS-2335 spec §5.2).
 *
 * Keeps the original `(userId, clientId, conversationId, text)` binding and the
 * original Redis key prefix, so behaviour (refusals, TTL) is identical to before
 * the generalization. Only the tool name and the payload shape are fixed here:
 * tool `reply_inquiry`, subject = conversation, payload = the reply text.
 *
 * Deploy note: the digest changed (the tool field was added and `canonicalJson`
 * quotes the text), so a token issued before the deploy becomes `INVALID` once.
 * It lives at most 600 s and the user simply asks for a new preview. No legacy
 * digest is kept on purpose.
 */

import {
    CONFIRMATION_TOKEN_TTL_SECONDS,
    type ConfirmationRedis,
    type ConfirmationStoreDeps,
    type ConfirmationTokenFailureReason,
    type ConsumeConfirmationTokenResult,
    consumeConfirmationToken as consumeGeneric,
    type IssueConfirmationTokenResult,
    issueConfirmationToken as issueGeneric
} from '../confirmation-token-store';

export {
    CONFIRMATION_TOKEN_TTL_SECONDS,
    type ConfirmationRedis,
    type ConfirmationStoreDeps,
    type ConfirmationTokenFailureReason,
    type ConsumeConfirmationTokenResult,
    type IssueConfirmationTokenResult
};

/** Redis key prefix of `reply_inquiry` confirmation tokens (unchanged since T-022). */
export const CONFIRMATION_TOKEN_KEY_PREFIX = 'mcp:reply-confirm:';

/** Tool name bound into every `reply_inquiry` token. */
const REPLY_INQUIRY_TOOL = 'reply_inquiry';

/** The binding a `reply_inquiry` token is tied to. */
export interface ConfirmationBinding {
    /** The authenticated user. */
    readonly userId: string;
    /** The OAuth client the preview was shown through. A token never crosses clients. */
    readonly clientId: string;
    /** The conversation being replied to. */
    readonly conversationId: string;
    /** The exact reply text. */
    readonly text: string;
}

/** Arguments for {@link issueConfirmationToken}. */
export interface IssueConfirmationTokenArgs extends ConfirmationBinding, ConfirmationStoreDeps {}

/** Arguments for {@link consumeConfirmationToken}. */
export interface ConsumeConfirmationTokenArgs extends ConfirmationBinding, ConfirmationStoreDeps {
    /** The token received from {@link issueConfirmationToken}. */
    readonly token: string;
}

const toGenericBinding = ({ userId, clientId, conversationId, text }: ConfirmationBinding) => ({
    userId,
    clientId,
    tool: REPLY_INQUIRY_TOOL,
    subjectId: conversationId,
    payload: text,
    keyPrefix: CONFIRMATION_TOKEN_KEY_PREFIX
});

/**
 * Issues a single-use token for a reply preview.
 *
 * @param args - The binding (user, client, conversation, text) and optional deps
 * @returns The token and its lifetime, or `UNAVAILABLE` (fail closed)
 */
export async function issueConfirmationToken(
    args: IssueConfirmationTokenArgs
): Promise<IssueConfirmationTokenResult> {
    return issueGeneric({ ...toGenericBinding(args), getRedis: args.getRedis });
}

/**
 * Consumes a reply token atomically (single use, burnt on mismatch).
 *
 * @param args - The token, the binding presented now, and optional deps
 * @returns `{ ok: true }`, `INVALID`, or `UNAVAILABLE` (fail closed)
 */
export async function consumeConfirmationToken(
    args: ConsumeConfirmationTokenArgs
): Promise<ConsumeConfirmationTokenResult> {
    return consumeGeneric({
        ...toGenericBinding(args),
        token: args.token,
        getRedis: args.getRedis
    });
}
