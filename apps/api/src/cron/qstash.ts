/**
 * Upstash QStash signature verification.
 *
 * In production, scheduled cron requests are dispatched by Upstash QStash.
 * Each request carries an `Upstash-Signature` header containing a JWS over
 * the body, signed with one of two rotating signing keys. We verify the
 * signature lazily (only on requests that carry the header) and fall back
 * to the legacy shared-secret flow for manual or local triggers.
 *
 * @module cron/qstash
 */

import { Receiver } from '@upstash/qstash';
import { env } from '../utils/env.js';

let cachedReceiver: Receiver | null = null;

/**
 * Returns a memoised QStash {@link Receiver} configured with the current
 * and next signing keys, or `null` if QStash is not configured for this
 * environment. Holding a single instance avoids re-parsing the keys on
 * every request.
 */
const getReceiver = (): Receiver | null => {
    if (cachedReceiver) return cachedReceiver;

    const currentSigningKey = env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = env.QSTASH_NEXT_SIGNING_KEY;

    if (!currentSigningKey || !nextSigningKey) {
        return null;
    }

    cachedReceiver = new Receiver({ currentSigningKey, nextSigningKey });
    return cachedReceiver;
};

/**
 * Verifies an Upstash QStash signature against the raw request body.
 *
 * @param signature - The `Upstash-Signature` header value, or `null`/`undefined` if absent.
 * @param body - The raw request body string, exactly as transmitted.
 * @returns `true` when the signature is present, well-formed, and matches; `false` otherwise.
 */
export const verifyQStashSignature = async (
    signature: string | null | undefined,
    body: string
): Promise<boolean> => {
    if (!signature) return false;
    const receiver = getReceiver();
    if (!receiver) return false;

    try {
        await receiver.verify({ signature, body });
        return true;
    } catch {
        return false;
    }
};

/**
 * Returns `true` when QStash signing keys are configured in the current
 * environment. Used to decide whether to require a signature on
 * production cron requests.
 */
export const isQStashConfigured = (): boolean => getReceiver() !== null;
