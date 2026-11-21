/**
 * The central email template catalog (HOS-2519 §6.2): one typed list of every
 * email the platform can send, across the six send paths. Each entry renders
 * through the production component and the production subject code.
 *
 * @module catalog/catalog
 */

import { ALERT_DIGEST_ENTRIES } from './entries/alert-digest.js';
import { AUTH_ENTRIES } from './entries/auth.js';
import { CONVERSATION_ENTRIES } from './entries/conversation.js';
import { NEWSLETTER_ENTRIES } from './entries/newsletter.js';
import { NOTIFICATION_ADMIN_ENTRIES } from './entries/notification-admin.js';
import { NOTIFICATION_BILLING_ENTRIES } from './entries/notification-billing.js';
import { NOTIFICATION_COMMUNITY_ENTRIES } from './entries/notification-community.js';
import { NOTIFICATION_SUBSCRIPTION_ENTRIES } from './entries/notification-subscription.js';
import { NOTIFICATION_TRIAL_ENTRIES } from './entries/notification-trial.js';
import { OUTBOX_BILLING_CANCELLATION_ENTRIES } from './entries/outbox-billing-cancellation.js';
import { OUTBOX_BILLING_NOTICES_ENTRIES } from './entries/outbox-billing-notices.js';
import { OUTBOX_BILLING_OPS_ENTRIES } from './entries/outbox-billing-ops.js';
import { OUTBOX_BILLING_SIGNUP_ENTRIES } from './entries/outbox-billing-signup.js';
import { OUTBOX_LISTING_ENTRIES } from './entries/outbox-listing.js';
import { OUTBOX_PARTNER_ENTRIES } from './entries/outbox-partner.js';
import { OUTBOX_TRIAL_ENTRIES } from './entries/outbox-trial.js';
import type { EmailCatalogEntry } from './types.js';

/** Every email the platform can send, in admin display order. */
export const EMAIL_CATALOG: readonly EmailCatalogEntry[] = Object.freeze([
    ...AUTH_ENTRIES,
    ...NOTIFICATION_BILLING_ENTRIES,
    ...OUTBOX_BILLING_NOTICES_ENTRIES,
    ...OUTBOX_BILLING_OPS_ENTRIES,
    ...OUTBOX_BILLING_SIGNUP_ENTRIES,
    ...OUTBOX_BILLING_CANCELLATION_ENTRIES,
    ...NOTIFICATION_SUBSCRIPTION_ENTRIES,
    ...NOTIFICATION_TRIAL_ENTRIES,
    ...OUTBOX_TRIAL_ENTRIES,
    ...OUTBOX_LISTING_ENTRIES,
    ...OUTBOX_PARTNER_ENTRIES,
    ...NOTIFICATION_COMMUNITY_ENTRIES,
    ...CONVERSATION_ENTRIES,
    ...NOTIFICATION_ADMIN_ENTRIES,
    ...NEWSLETTER_ENTRIES,
    ...ALERT_DIGEST_ENTRIES
]);

/**
 * Finds a catalog entry by key.
 *
 * @param input - The entry key, e.g. `'outbox.billing.renewal-upcoming'`.
 * @returns The entry, or `undefined` when no entry has that key.
 */
export function findEmailCatalogEntry(input: {
    readonly key: string;
}): EmailCatalogEntry | undefined {
    return EMAIL_CATALOG.find((entry) => entry.key === input.key);
}
