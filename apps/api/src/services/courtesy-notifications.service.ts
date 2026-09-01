/**
 * Courtesy Notification Service (HOS-180)
 *
 * Sends the three emails a gifted subscriber receives: one when the courtesy is
 * granted, one when it starts, one when it ends.
 *
 * ## Why three and not one
 *
 * Granting and starting are separate moments. The gift begins at the end of the
 * period the subscriber already paid for, which can be weeks after an admin
 * grants it (spec OQ-4). One email at grant time would announce something that
 * has not happened; one at start time would arrive with no context. So: what
 * you were given, that it started, that it ended.
 *
 * ## The one that must never be late
 *
 * `sendCourtesyEndedNotification` has to reach the subscriber before or with the
 * resume, never after a charge lands. Someone who sees an unexpected charge
 * reads it as a bug, and a warning that arrives afterwards is not a warning.
 *
 * ## What must never happen
 *
 * A courtesy must never be routed to `subscription-paused.tsx`. Its copy blames
 * the subscriber's payment method (HOS-926), so a gifted subscriber would be
 * told their card failed — the worst possible email at the worst possible
 * moment (spec R-7). These three have their own `NotificationType` members and
 * their own templates precisely so the two can never be confused.
 *
 * @module services/courtesy-notifications
 */

import { billingPlans, billingSubscriptions, eq, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { readCourtesyFields } from '@repo/service-core';
import { getQZPayBilling } from '../middlewares/billing.js';
import { lookupCustomerDetails } from '../utils/customer-lookup.js';
import { apiLogger } from '../utils/logger.js';
import { sendNotification } from '../utils/notification-helper.js';

/** Everything the three emails need, resolved once. */
interface CourtesyRecipient {
    readonly email: string;
    readonly name: string;
    readonly userId: string | null;
    readonly customerId: string;
    readonly planName: string;
    readonly courtesyStartsAt: Date | null;
    readonly courtesyEndsAt: Date | null;
    readonly cycles: number | null;
}

/**
 * Formats a date the way a subscriber reading Spanish expects to see it.
 *
 * `es-AR` with a long month: "1 de octubre de 2026". A bare ISO string in a
 * billing email is the kind of detail that makes a gift read like a receipt.
 */
function formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

/**
 * Resolves the subscriber, their plan and their courtesy window.
 *
 * Returns `null` when anything essential is missing rather than sending a
 * half-empty email — a gift email with a blank plan name or a blank date is
 * worse than no email, because it cannot be un-sent.
 */
async function resolveRecipient(subscriptionId: string): Promise<CourtesyRecipient | null> {
    const db = getDb();
    const billing = getQZPayBilling();
    if (!billing) return null;

    const [row] = await db
        .select({
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId,
            metadata: billingSubscriptions.metadata
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscriptionId))
        .limit(1);

    if (!row) {
        apiLogger.warn({ subscriptionId }, 'Courtesy notification: subscription not found');
        return null;
    }

    const customer = await lookupCustomerDetails(billing, row.customerId);
    if (!customer?.email) {
        apiLogger.warn(
            { subscriptionId, customerId: row.customerId },
            'Courtesy notification: no recipient email'
        );
        return null;
    }

    const [plan] = await db
        .select({ name: billingPlans.name })
        .from(billingPlans)
        .where(eq(billingPlans.id, row.planId))
        .limit(1);

    const fields = readCourtesyFields(row.metadata);

    return {
        email: customer.email,
        name: customer.name,
        userId: customer.userId,
        customerId: row.customerId,
        planName: plan?.name ?? 'tu plan',
        courtesyStartsAt: fields.courtesyStartsAt,
        courtesyEndsAt: fields.courtesyEndsAt,
        cycles: fields.courtesyCyclesGranted
    };
}

/**
 * Sends the "we gifted you N cycles" email, immediately after a successful grant.
 *
 * @param args.subscriptionId - The gifted subscription.
 */
export async function sendCourtesyGrantedNotification(args: {
    readonly subscriptionId: string;
}): Promise<void> {
    const recipient = await resolveRecipient(args.subscriptionId);
    if (!recipient) return;

    await sendNotification({
        type: NotificationType.COURTESY_GRANTED,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        userId: recipient.userId,
        customerId: recipient.customerId,
        planName: recipient.planName,
        cycles: recipient.cycles ?? 1,
        startsAt: formatDate(recipient.courtesyStartsAt),
        endsAt: formatDate(recipient.courtesyEndsAt)
    });
}

/**
 * Sends the "your gift is running now" email when the window opens.
 *
 * @param args.subscriptionId - The gifted subscription.
 */
export async function sendCourtesyStartedNotification(args: {
    readonly subscriptionId: string;
}): Promise<void> {
    const recipient = await resolveRecipient(args.subscriptionId);
    if (!recipient) return;

    await sendNotification({
        type: NotificationType.COURTESY_STARTED,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        userId: recipient.userId,
        customerId: recipient.customerId,
        planName: recipient.planName,
        endsAt: formatDate(recipient.courtesyEndsAt)
    });
}

/**
 * Sends the "your gift ended, billing resumes" email.
 *
 * Called BEFORE any charge can land — see this module's header on why that
 * ordering is not cosmetic.
 *
 * Reads the window before the caller clears it, so the next billing date is
 * still available. A caller that clears first would send a blank date.
 *
 * @param args.subscriptionId - The subscription whose gift ended.
 */
export async function sendCourtesyEndedNotification(args: {
    readonly subscriptionId: string;
}): Promise<void> {
    const recipient = await resolveRecipient(args.subscriptionId);
    if (!recipient) return;

    await sendNotification({
        type: NotificationType.COURTESY_ENDED,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        userId: recipient.userId,
        customerId: recipient.customerId,
        planName: recipient.planName,
        nextBillingDate: formatDate(recipient.courtesyEndsAt)
    });
}
