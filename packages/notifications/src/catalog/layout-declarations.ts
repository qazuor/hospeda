/**
 * What each catalog entry declares for the USER email layout (HOS-2565 PR-4): the
 * illustration next to its first title and the help articles of its footer
 * "Preguntas frecuentes" block.
 *
 * Declarations are data, read by key, never a branch per template:
 * - {@link EMAIL_DOMAIN_LAYOUT} gives every domain its default. It is a full
 *   `Record`, so a new domain does not compile until someone decides its value.
 * - {@link EMAIL_KEY_LAYOUT} overrides one entry when its domain default does not fit.
 *
 * An absent illustration renders none; absent help ids render the generic default
 * set. Staff entries declare nothing: the staff layout reads no declaration.
 * `email-layout-declarations.test.ts` fails on a key that is not in the catalog and
 * on a help id that has no article.
 *
 * @module catalog/layout-declarations
 */

import type { EmailIllustration, EmailLayoutContextValue } from '@repo/email';
import type { EmailCatalogDomain, EmailCatalogEntry } from './types.js';

/** One layout declaration. */
export interface EmailLayoutDeclaration {
    /** Illustration shown next to the first title. Absent: none. */
    readonly illustration?: EmailIllustration;
    /** Related help article ids, 3 to 4, in display order. Absent: the default set. */
    readonly helpArticleIds?: readonly string[];
}

const BILLING_HELP = ['change-plan', 'addons', 'pause-resume', 'help-center'] as const;
const LISTING_HELP = ['fix-request', 'publish-requirements', 'pause-resume', 'delete-listing'];
const TRIAL_HELP = ['create-listing', 'publish-requirements', 'photos', 'change-plan'];
const HOST_TRADE_HELP = ['benefit-usage', 'benefit-usage-provider', 'provider-directory'];

/** Default declaration of every domain. */
export const EMAIL_DOMAIN_LAYOUT: Readonly<Record<EmailCatalogDomain, EmailLayoutDeclaration>> = {
    auth: { illustration: 'account' },
    billing: { illustration: 'payments', helpArticleIds: BILLING_HELP },
    subscription: { illustration: 'plan', helpArticleIds: BILLING_HELP },
    trial: { illustration: 'plan', helpArticleIds: TRIAL_HELP },
    listing: { illustration: 'listings', helpArticleIds: LISTING_HELP },
    'host-trade': { illustration: 'listings', helpArticleIds: HOST_TRADE_HELP },
    alliance: { illustration: 'account' },
    partner: { illustration: 'account' },
    conversation: { illustration: 'messages' },
    admin: {},
    newsletter: {},
    alerts: { illustration: 'alerts' },
    'contact-feedback': {},
    ai: { illustration: 'messages', helpArticleIds: ['ai-assistants', 'inquiries', 'help-center'] }
};

const PLAN_CHANGE: EmailLayoutDeclaration = {
    illustration: 'plan',
    helpArticleIds: ['change-plan', 'addons', 'pause-resume', 'delete-listing']
};

/** Per-entry overrides of {@link EMAIL_DOMAIN_LAYOUT}. */
export const EMAIL_KEY_LAYOUT: Readonly<Record<string, EmailLayoutDeclaration>> = {
    'notification.plan_change_confirmation': PLAN_CHANGE,
    'notification.plan_downgrade_limit_warning': PLAN_CHANGE,
    'notification.plan_price_change_notice': PLAN_CHANGE,
    'outbox.billing.plan-migration-announced': PLAN_CHANGE,
    'outbox.billing.plan-migration-upcoming': PLAN_CHANGE,
    'outbox.billing.plan-migration-cancelled': PLAN_CHANGE,
    'outbox.billing.one-time-addon-activated': {
        illustration: 'payments',
        helpArticleIds: ['addons', 'change-plan', 'help-center']
    },
    'outbox.billing.addon-cancelled': {
        illustration: 'payments',
        helpArticleIds: ['addons', 'change-plan', 'help-center']
    },
    'conversation.new-message': {
        illustration: 'messages',
        helpArticleIds: ['inquiries', 'reviews', 'help-center']
    },
    'notification.accommodation_calendar_feed_broken': {
        illustration: 'listings',
        helpArticleIds: ['calendar', 'pause-resume', 'help-center']
    },
    'notification.listing_location_exception_approved': {
        illustration: 'listings',
        helpArticleIds: ['publish-requirements', 'create-listing', 'help-center']
    },
    'notification.listing_location_exception_rejected': {
        illustration: 'listings',
        helpArticleIds: ['publish-requirements', 'create-listing', 'help-center']
    }
};

/**
 * Builds the layout context of one render of a catalog entry.
 *
 * @param input - The entry (absent for a key outside the catalog) and the
 *   recipient's verticals, when the sender resolved them.
 * @returns The context `renderEmailBodies({ layout })` takes.
 */
export function buildEmailCatalogLayout(input: {
    readonly entry?: Pick<EmailCatalogEntry, 'key' | 'domain'>;
    readonly recipientVerticals?: readonly string[];
}): EmailLayoutContextValue {
    const { entry, recipientVerticals } = input;
    const declaration: EmailLayoutDeclaration = entry
        ? (EMAIL_KEY_LAYOUT[entry.key] ?? EMAIL_DOMAIN_LAYOUT[entry.domain])
        : {};
    return {
        ...(declaration.illustration ? { illustration: declaration.illustration } : {}),
        ...(declaration.helpArticleIds ? { helpArticleIds: declaration.helpArticleIds } : {}),
        ...(recipientVerticals ? { recipientVerticals } : {})
    };
}
