/**
 * @file email-attribution.ts
 * @description Catalog keys and attribution of the emails `apps/api` sends itself (HOS-2359 §6.A.4).
 *
 * Every transactional email names its email catalog key, which derives its
 * `utm_campaign` and its Umami pixel slug. A key that is not in the catalog renders a
 * pixel no `umami:setup` run creates, so these keys are pinned against
 * `EMAIL_CATALOG` by `test/utils/email-attribution.test.ts`.
 */
import type { EmailAttribution } from '@repo/email';
import type { EmailCatalogKey } from '@repo/notifications';

/** Catalog keys of the auth emails (OD-1: reset and verify carry a pixel too). */
export const AUTH_EMAIL_KEYS = {
    resetPassword: 'auth.reset-password',
    verifyEmail: 'auth.verify-email'
} as const satisfies Readonly<Record<string, EmailCatalogKey>>;

/** Catalog keys of the conversation emails. */
export const CONVERSATION_EMAIL_KEYS = {
    verify: 'conversation.verify',
    accessLink: 'conversation.access-link',
    newMessage: 'conversation.new-message',
    newMessageAnon: 'conversation.new-message-anon',
    tokenExpiringDay15: 'conversation.token-expiring-day15',
    tokenExpiringDay25: 'conversation.token-expiring-day25'
} as const satisfies Readonly<Record<string, EmailCatalogKey>>;

/** Email catalog key of each conversation token reminder, by reminder type. */
export const TOKEN_REMINDER_TEMPLATE_KEYS = {
    day15: CONVERSATION_EMAIL_KEYS.tokenExpiringDay15,
    day25: CONVERSATION_EMAIL_KEYS.tokenExpiringDay25
} as const;

/**
 * Attribution of a real transactional send: UTMs plus the template's open pixel.
 *
 * @param input - `templateKey`: the email catalog key
 * @returns The attribution to pass to `sendAppEmail`
 */
export function buildTransactionalAttribution({
    templateKey
}: {
    readonly templateKey: EmailCatalogKey;
}): EmailAttribution {
    return { medium: 'transactional', templateKey, includePixel: true };
}
