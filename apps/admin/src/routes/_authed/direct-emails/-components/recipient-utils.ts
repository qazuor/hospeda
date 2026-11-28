/**
 * @file recipient-utils.ts
 * @description Pure helpers for the recipients chips input (HOS-2685): split a
 * typed or pasted string into addresses, validate each one with the shared
 * `DirectEmailAddressSchema`, dedup case-insensitively and enforce the cap.
 */

import { DIRECT_EMAIL_MAX_RECIPIENTS, DirectEmailAddressSchema } from '@repo/schemas';

/** Why an address was not added. */
export type RecipientRejectionReason = 'invalid' | 'duplicate' | 'limit';

/** One rejected token with the reason. */
export interface RecipientRejection {
    /** The raw token as typed. */
    readonly value: string;
    readonly reason: RecipientRejectionReason;
}

/** Outcome of adding raw input to the current list. */
export interface AddRecipientsResult {
    /** The new list (lowercased, trimmed, no duplicates). */
    readonly recipients: ReadonlyArray<string>;
    /** Tokens that were not added. */
    readonly rejected: ReadonlyArray<RecipientRejection>;
}

/** Characters that separate addresses when several are typed or pasted at once. */
const SEPARATORS = /[\s,;]+/;

/**
 * Splits raw input into non-empty tokens.
 *
 * @param input.raw - Text typed or pasted into the recipients field.
 * @returns The trimmed tokens.
 */
export function splitRecipientTokens({ raw }: { readonly raw: string }): ReadonlyArray<string> {
    return raw
        .split(SEPARATORS)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

/**
 * Adds the addresses found in `raw` to `current`.
 *
 * Each token is validated with `DirectEmailAddressSchema` (which also
 * lowercases). Duplicates are matched case-insensitively. Once the list holds
 * `max` addresses, further valid tokens are rejected with `limit`.
 *
 * @param input.current - Addresses already in the list.
 * @param input.raw - Text typed or pasted.
 * @param input.max - Cap, defaults to the API's `DIRECT_EMAIL_MAX_RECIPIENTS`.
 * @returns The new list plus the rejected tokens.
 */
export function addRecipients({
    current,
    raw,
    max = DIRECT_EMAIL_MAX_RECIPIENTS
}: {
    readonly current: ReadonlyArray<string>;
    readonly raw: string;
    readonly max?: number;
}): AddRecipientsResult {
    const next = [...current];
    const rejected: RecipientRejection[] = [];

    for (const token of splitRecipientTokens({ raw })) {
        const parsed = DirectEmailAddressSchema.safeParse(token);
        if (!parsed.success) {
            rejected.push({ value: token, reason: 'invalid' });
            continue;
        }
        const email = parsed.data;
        if (next.some((existing) => existing.toLowerCase() === email)) {
            rejected.push({ value: token, reason: 'duplicate' });
            continue;
        }
        if (next.length >= max) {
            rejected.push({ value: token, reason: 'limit' });
            continue;
        }
        next.push(email);
    }

    return { recipients: next, rejected };
}

/**
 * Returns the addresses of `recipients` that are in the suppressed set.
 *
 * @param input.recipients - Current recipients.
 * @param input.suppressed - Addresses the API reported as suppressed.
 * @returns The suppressed subset, in list order.
 */
export function pickSuppressed({
    recipients,
    suppressed
}: {
    readonly recipients: ReadonlyArray<string>;
    readonly suppressed: ReadonlySet<string>;
}): ReadonlyArray<string> {
    return recipients.filter((email) => suppressed.has(email.toLowerCase()));
}
