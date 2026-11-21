import type { DrizzleClient } from '@repo/db';
import { addonInstances, eq } from '@repo/db';

/**
 * How the payment of a one-time add-on instance is refunded (HOS-2179 §5.11, T-5).
 *
 * - `PAYMENT`: an instance bought on a payment page. It has a page and no order; its payment
 *   is an ordinary provider charge refunded through `refund` and confirmed by re-reading the
 *   charge, exactly like a subscription payment.
 * - `NONE`: anything else. An instance with a provider order was bought through `/v1/orders`;
 *   the order refund channel was retired with the order path (HOS-2179 T-7, zero such
 *   instances in staging and production when it was retired), so its refund is not sent. A
 *   REQUESTED refund is declined via action 14; a CONFIRMED one with a live call has no exit.
 *   An instance with neither, or both,
 *   proves no channel at all. Both fail closed.
 */
export type AddonRefundChannel = 'PAYMENT' | 'NONE';

/**
 * Chooses the refund channel from what the instance actually holds, never from its product
 * or its age. The payment row of a one-time instance names the instance and no subscription
 * (`ck_payment_one_subject`), so the `PAYMENT` channel reuses the subscription-payment path
 * unchanged: none of its readers needs a subscription (HOS-2179 R-7).
 *
 * @param input.providerOrderId - The instance's provider order, if any
 * @param input.paymentPageId - The instance's payment page, if any
 * @returns The channel
 */
export function resolveAddonRefundChannel(input: {
    readonly providerOrderId: string | null;
    readonly paymentPageId: string | null;
}): { readonly channel: AddonRefundChannel } {
    const hasOrder = input.providerOrderId !== null;
    const hasPage = input.paymentPageId !== null;
    if (hasPage && !hasOrder) return { channel: 'PAYMENT' };
    return { channel: 'NONE' };
}

/**
 * Reads an add-on instance and resolves its refund channel.
 *
 * @param input.db - The connection or transaction to read with
 * @param input.addonInstanceId - The instance the refunded payment hangs from
 * @param input.lock - `share` to hold the instance row until the caller's transaction ends
 * @returns The channel
 */
export async function readAddonRefundChannel(input: {
    readonly db: DrizzleClient;
    readonly addonInstanceId: string;
    readonly lock?: 'share';
}): Promise<{ readonly channel: AddonRefundChannel }> {
    const query = input.db
        .select({
            providerOrderId: addonInstances.providerOrderId,
            paymentPageId: addonInstances.paymentPageId
        })
        .from(addonInstances)
        .where(eq(addonInstances.id, input.addonInstanceId))
        .limit(1);
    const [instance] = input.lock === 'share' ? await query.for('share') : await query;
    if (!instance) return { channel: 'NONE' };
    return resolveAddonRefundChannel(instance);
}
