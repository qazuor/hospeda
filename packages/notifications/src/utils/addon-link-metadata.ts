/**
 * Persistence of the add-on deep-link fields across the retry round trip
 * (HOS-722).
 *
 * ## Why this module exists
 *
 * A notification that fails to send is written to `billing_notification_log`
 * with `status = 'failed'`, and `notification-retry.service.ts` later
 * REBUILDS the payload from that row's `metadata` column and sends it again.
 * So `metadata` is the only channel through which anything on the original
 * payload survives to the retry.
 *
 * `logNotification` wrote a fixed set of envelope fields there — `userId`,
 * `recipientName`, `messageId`, `category`, `idempotencyKey` — and nothing
 * type-specific. Fixing the three add-on dispatch sites to pass `locale` and
 * `addonSlug` was therefore only half a fix: the first attempt would carry the
 * localized, focused CTA, and a RETRY of that same email would silently revert
 * to `/es/` with no focus, because neither field was ever persisted.
 *
 * This module is deliberately narrow: it persists the two fields the add-on
 * CTA link is built from, and nothing else. It is NOT a general
 * "serialize the whole payload" mechanism — see the note on `addonName` below.
 *
 * ## Known adjacent gap (pre-existing, deliberately not widened here)
 *
 * `reconstructPayload` also reads `metadata.addonName`, `metadata.planName`,
 * `metadata.expirationDate` and friends, none of which have ever been written
 * either. A retried `ADDON_EXPIRED` email consequently renders the literal
 * fallback `'Add-on'` as its name. That is a separate defect with a separate
 * blast radius (it affects several notification families, not just add-ons)
 * and is left untouched by HOS-722 rather than fixed halfway.
 *
 * @module utils/addon-link-metadata
 */

import type { NotificationPayload } from '../types/notification.types.js';

/**
 * Subset of `billing_notification_log.metadata` that carries the add-on
 * deep-link fields through a failed send and back out on retry.
 */
export interface AddonLinkMetadata {
    /** Add-on catalog slug the CTA focuses on. */
    readonly addonSlug?: string;
    /** Recipient locale the CTA link was built for. */
    readonly locale?: string;
}

/**
 * Extracts the add-on deep-link fields from any notification payload.
 *
 * Returns an empty object for payloads that carry neither field, so the
 * result can always be spread into the metadata literal without adding
 * `undefined` keys for unrelated notification types.
 *
 * @param payload - The notification being logged.
 * @returns `{ addonSlug?, locale? }` — only the fields actually present.
 */
export function buildAddonLinkMetadata(payload: NotificationPayload): AddonLinkMetadata {
    const fields = payload as { addonSlug?: unknown; locale?: unknown };
    const metadata: { addonSlug?: string; locale?: string } = {};

    if (typeof fields.addonSlug === 'string' && fields.addonSlug.length > 0) {
        metadata.addonSlug = fields.addonSlug;
    }

    if (typeof fields.locale === 'string' && fields.locale.length > 0) {
        metadata.locale = fields.locale;
    }

    return metadata;
}
