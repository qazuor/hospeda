/**
 * @file template-tag.ts
 * @description The Brevo tag that carries a transactional email's catalog key (HOS-2583).
 *
 * Brevo echoes the `tags` of a send back in the `tags` array of every transactional
 * webhook event (`opened`, `delivered`, ...). The transport adds one
 * `template:<catalog key>` tag to every transactional send, and the webhook receiver
 * reads it back to know which template an open belongs to, with no `message-id` table.
 *
 * @module transports/email/template-tag
 */

/** Prefix of the Brevo tag that names the template key. */
export const EMAIL_TEMPLATE_TAG_PREFIX = 'template:';

/**
 * Builds the Brevo tag of a transactional email's catalog key.
 *
 * @param input - `templateKey`: the email catalog key (`auth.reset-password`)
 * @returns The tag (`template:auth.reset-password`)
 */
export function buildEmailTemplateTag(input: { readonly templateKey: string }): string {
    return `${EMAIL_TEMPLATE_TAG_PREFIX}${input.templateKey}`;
}

/**
 * Reads the template key out of the tags of a Brevo webhook event.
 *
 * Tolerant by design: `tags` is whatever the provider sent, so anything that is not an
 * array of strings, or has no well-formed `template:` tag, answers `null`.
 *
 * @param input - `tags`: the raw `tags` field of the event
 * @returns The first template key found, or `null`
 */
export function parseEmailTemplateTag(input: { readonly tags: unknown }): string | null {
    if (!Array.isArray(input.tags)) {
        return null;
    }
    for (const tag of input.tags) {
        if (typeof tag === 'string' && tag.startsWith(EMAIL_TEMPLATE_TAG_PREFIX)) {
            const key = tag.slice(EMAIL_TEMPLATE_TAG_PREFIX.length).trim();
            if (key.length > 0) {
                return key;
            }
        }
    }
    return null;
}
