/**
 * Persistence of the comp-grant fields across the retry round trip (HOS-1171).
 *
 * ## Why this module exists
 *
 * The second instance of the defect `addon-link-metadata.ts` was written for,
 * and the mechanism is identical: a notification that fails to send is written
 * to `billing_notification_log`, and `notification-retry.service.ts` REBUILDS
 * the payload from that row's `metadata` column. `metadata` is the only channel
 * through which anything type-specific survives to the retry, and
 * `logNotification` writes only envelope fields unless something like this
 * module adds more.
 *
 * ## Why it matters more here than for a CTA link
 *
 * `CompGranted` branches on `hadActiveBilling`. With it TRUE the email says we
 * cancelled the customer's automatic debit, that no further charges will be made
 * to their card, and to write to us if one appears anyway. With it FALSE — which
 * is what an unpersisted field degrades to under a `||` or a bare read — the
 * paragraph disappears entirely.
 *
 * So a retried comp email would tell someone whose preapproval we had JUST
 * hard-cancelled the "you never gave us a card" variant: no notice that their
 * card was cancelled, and no instruction for what to do if MercadoPago charges
 * them once more on the way down. `planName` would render as `undefined` in the
 * same breath.
 *
 * ## Reading it back
 *
 * The retry must use `??` and never `||` when defaulting `hadActiveBilling`: a
 * correctly-persisted `false` is falsy, and `||` would silently rewrite it to
 * the other variant — reintroducing the same class of bug from the read side.
 *
 * @module utils/comp-grant-metadata
 */

import { type NotificationPayload, NotificationType } from '../types/notification.types.js';

/**
 * Subset of `billing_notification_log.metadata` that carries the comp-grant
 * fields through a failed send and back out on retry.
 */
export interface CompGrantMetadata {
    /** Plan the customer was comped on. */
    readonly planName?: string;
    /** Whether a live MercadoPago preapproval was hard-cancelled by the grant. */
    readonly hadActiveBilling?: boolean;
}

/**
 * Extracts the comp-grant fields, and ONLY from a `COMP_GRANTED` payload.
 *
 * Returns an empty object for every other type, so the result can always be
 * spread into the metadata literal without adding keys for notifications that
 * have nothing to do with a comp.
 *
 * The type check is not a micro-optimisation. This is spread into EVERY log
 * row, and `planName` is a field several unrelated payloads also carry —
 * `TRIAL_ENDING_REMINDER`, `PAYMENT_FAILURE` and `RENEWAL_REMINDER` among them.
 * All three read `metadata.planName` back on retry with a `'Plan'` fallback, and
 * all three have always hit that fallback because nothing ever persisted it.
 * A shape-based copy would start persisting it for them too and quietly change
 * the wording of three production emails, in a change about comps, with nobody
 * having asked. That may be an improvement worth making; it is not this one's to
 * make, and a smoke run is the wrong place to find out.
 *
 * `hadActiveBilling` is copied whenever it is a boolean — including `false`,
 * which is a real answer and not an absent one.
 *
 * @param payload - The notification being logged.
 * @returns `{ planName?, hadActiveBilling? }` for a comp grant; `{}` otherwise.
 */
export function buildCompGrantMetadata(payload: NotificationPayload): CompGrantMetadata {
    if (payload.type !== NotificationType.COMP_GRANTED) {
        return {};
    }

    const fields = payload as { planName?: unknown; hadActiveBilling?: unknown };
    const metadata: { planName?: string; hadActiveBilling?: boolean } = {};

    if (typeof fields.planName === 'string' && fields.planName.length > 0) {
        metadata.planName = fields.planName;
    }

    if (typeof fields.hadActiveBilling === 'boolean') {
        metadata.hadActiveBilling = fields.hadActiveBilling;
    }

    return metadata;
}
