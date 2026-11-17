/**
 * @file redaction-labels.ts
 * @description Render-time labels for the PII redaction markers (HOS-2320).
 *
 * The AI chat redactor (`scrubPii` in `@repo/ai-core`) stores stable technical
 * markers such as `[REDACTED_EMAIL]`. Those mean nothing to a listing owner, so
 * every owner-facing surface (the weekly digest email and the web panel) swaps
 * them for a label in the viewer's language. This is the ONE place that maps
 * marker to label; storage and redaction stay unchanged.
 */

import type { Locale } from './config.shared';
import { defaultLocale, webTrans } from './config.shared';

/** Marker emitted by the redactor mapped to its `common.redactedContact.*` key. */
const REDACTION_TOKEN_KEYS = {
    '[REDACTED_EMAIL]': 'common.redactedContact.email',
    '[REDACTED_PHONE]': 'common.redactedContact.phone',
    '[REDACTED_CARD]': 'common.redactedContact.card'
} as const;

const REDACTION_TOKEN_PATTERN = /\[REDACTED_(?:EMAIL|PHONE|CARD)\]/g;

/**
 * Replaces every redaction marker in `text` with its localized label.
 *
 * @param input.text - Text that may contain `[REDACTED_*]` markers. Never mutated.
 * @param input.locale - Language of the label.
 * @returns `{ text }` the copy with labels (identical when nothing matched).
 */
export function localizeRedactionTokens(input: {
    readonly text: string;
    readonly locale: Locale;
}): { readonly text: string } {
    const dictionary = (webTrans[input.locale] ?? webTrans[defaultLocale]) as Record<
        string,
        string
    >;
    return {
        text: input.text.replace(REDACTION_TOKEN_PATTERN, (token) => {
            const key = REDACTION_TOKEN_KEYS[token as keyof typeof REDACTION_TOKEN_KEYS];
            return dictionary[key] ?? token;
        })
    };
}
