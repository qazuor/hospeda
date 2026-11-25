/**
 * @file email-attribution.ts
 * @description Catalog keys and attribution of the emails `apps/api` sends itself (HOS-2359 §6.A.4).
 *
 * Every transactional email names its email catalog key, which derives its
 * `utm_campaign` and its Brevo `template:` open tag. These keys are pinned against
 * `EMAIL_CATALOG` by `test/utils/email-attribution.test.ts`.
 */
import type { EmailAttribution, EmailLayoutContextValue } from '@repo/email';
import {
    buildEmailCatalogLayout,
    type EmailCatalogKey,
    findEmailCatalogEntry
} from '@repo/notifications';

/** Catalog keys of the auth emails . */
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

/** Catalog keys of the newsletter double opt-in emails (HOS-2603). */
export const NEWSLETTER_EMAIL_KEYS = {
    verify: 'newsletter.verify',
    welcome: 'newsletter.welcome'
} as const satisfies Readonly<Record<string, EmailCatalogKey>>;

/** Email catalog key of each conversation token reminder, by reminder type. */
export const TOKEN_REMINDER_TEMPLATE_KEYS = {
    day15: CONVERSATION_EMAIL_KEYS.tokenExpiringDay15,
    day25: CONVERSATION_EMAIL_KEYS.tokenExpiringDay25
} as const;

/**
 * Attribution of a real transactional send: UTMs for its links.
 *
 * @param input - `templateKey`: the email catalog key
 * @returns The attribution to pass to `sendAppEmail`
 */
export function buildTransactionalAttribution({
    templateKey
}: {
    readonly templateKey: EmailCatalogKey;
}): Extract<EmailAttribution, { readonly medium: 'transactional' }> {
    return { medium: 'transactional', templateKey };
}

/**
 * Layout context of a mail `apps/api` sends itself: the illustration and help articles its
 * catalog entry declares, the same ones the previewer shows (HOS-2580). Without it the
 * Better Auth mails reached the inbox with no illustration.
 *
 * @param input - `templateKey`: the email catalog key
 * @returns The layout to pass to `sendAppEmail`
 */
export function buildAppEmailLayout(input: {
    readonly templateKey: EmailCatalogKey;
}): EmailLayoutContextValue {
    const entry = findEmailCatalogEntry({ key: input.templateKey });
    return buildEmailCatalogLayout(entry ? { entry } : {});
}
