/**
 * Comp-grant notification service (HOS-1171).
 *
 * Sends the one email a customer receives when an operator grants them a
 * permanently-complimentary subscription. Modelled on
 * `courtesy-notifications.service.ts`, which is the closest sibling: same
 * resolve-then-send shape, same "return null rather than send a half-empty
 * email" rule, same fire-and-forget contract at the call site.
 *
 * ## One email, not three
 *
 * Courtesy needs three because granting, starting and ending are three separate
 * moments. A comp has exactly one: it takes effect the instant it is granted and
 * it never ends. There is nothing to announce later.
 *
 * ## The sentence this exists for
 *
 * A comp granted to someone who was already paying HARD-CANCELS their
 * MercadoPago preapproval — the card is gone, permanently, and this mail may be
 * the only place they are told. `hadActiveBilling` carries that fact into the
 * template so the paragraph appears for the customer it applies to and for
 * nobody else.
 *
 * ## What must never happen
 *
 * A comp must never be routed to `courtesy-granted.tsx`. That template names a
 * start date, an end date, and promises billing resumes automatically with the
 * same card. All three are false here, and the last one is false in the
 * dangerous direction: it tells someone to expect a charge that cannot arrive,
 * on a preapproval that no longer exists.
 *
 * @module services/comp-notifications
 */

import { billingPlans, billingSubscriptions, eq, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { getQZPayBilling } from '../middlewares/billing.js';
import { lookupCustomerDetails } from '../utils/customer-lookup.js';
import { apiLogger } from '../utils/logger.js';
import { sendNotification } from '../utils/notification-helper.js';

/** Everything the comp email needs, resolved once. */
interface CompRecipient {
    readonly email: string;
    readonly name: string;
    readonly userId: string | null;
    readonly customerId: string;
    readonly planName: string;
}

/**
 * Resolves the recipient and the plan they were comped on.
 *
 * Returns `null` when anything essential is missing rather than sending a
 * half-empty email: a grant mail with a blank plan name is worse than no mail,
 * because it cannot be un-sent.
 */
async function resolveRecipient(subscriptionId: string): Promise<CompRecipient | null> {
    const db = getDb();
    const billing = getQZPayBilling();
    if (!billing) return null;

    const [row] = await db
        .select({
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscriptionId))
        .limit(1);

    if (!row) {
        apiLogger.warn({ subscriptionId }, 'Comp notification: subscription not found');
        return null;
    }

    const customer = await lookupCustomerDetails(billing, row.customerId);
    if (!customer?.email) {
        apiLogger.warn(
            { subscriptionId, customerId: row.customerId },
            'Comp notification: no recipient email'
        );
        return null;
    }

    const [plan] = await db
        .select({ name: billingPlans.name })
        .from(billingPlans)
        .where(eq(billingPlans.id, row.planId))
        .limit(1);

    return {
        email: customer.email,
        name: customer.name,
        userId: customer.userId,
        customerId: row.customerId,
        planName: plan?.name ?? 'tu plan'
    };
}

/**
 * Sends the "your plan is free from now on" email, right after a successful grant.
 *
 * @param args.subscriptionId - The freshly-created comp subscription.
 * @param args.hadActiveBilling - Whether a live preapproval was hard-cancelled
 *   to make room for this grant. Decides whether the template says anything
 *   about the customer's card at all.
 */
export async function sendCompGrantedNotification(args: {
    readonly subscriptionId: string;
    readonly hadActiveBilling: boolean;
}): Promise<void> {
    const recipient = await resolveRecipient(args.subscriptionId);
    if (!recipient) return;

    await sendNotification({
        type: NotificationType.COMP_GRANTED,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        userId: recipient.userId,
        customerId: recipient.customerId,
        planName: recipient.planName,
        hadActiveBilling: args.hadActiveBilling
    });
}
