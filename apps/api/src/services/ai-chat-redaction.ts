/**
 * Redaction of customer chat text at READ time (HOS-2075, owner decision Q-2).
 *
 * The chat stores what the customer typed verbatim (AC-11 of SPEC-173); a
 * customer may have written a phone number or an e-mail. Every surface that
 * shows that text to someone else (the owner panel, the weekly digest e-mail,
 * the staff view) passes it through {@link redactChatText}, so there is ONE
 * implementation and the stored text never changes.
 *
 * It wraps `scrubPii`, which over-redacts on purpose: a phone-like run of digits
 * with separators can also swallow a number that was not a phone (a price such
 * as `1.500.000`). That is accepted: hiding too much is safer than leaking a
 * contact, and being a read-time transform, fixing the pattern fixes every past
 * message without migrating data.
 *
 * @module apps/api/services/ai-chat-redaction
 */

import { scrubPii } from '@repo/ai-core';

/**
 * Replaces emails, phone numbers and card numbers with `[REDACTED_*]` tokens.
 *
 * @param input.text - The stored chat text. Never mutated.
 * @returns `{ text }` the redacted copy (identical when nothing matched).
 */
export function redactChatText(input: { readonly text: string }): { readonly text: string } {
    return { text: scrubPii({ text: input.text }).scrubbed };
}
