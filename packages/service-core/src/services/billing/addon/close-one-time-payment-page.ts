import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, and, eq, getDb } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';

const logger = createLogger('one-time-payment-page-close');

const inputSchema = z.object({ instanceId: z.uuid() });

/** What closing a purchase's payment page did. */
export type CloseOneTimePaymentPageOutcome =
    /** The page re-read by id no longer takes payments; the instance records its expiry. */
    | 'CLOSED'
    /** No page, a page already expired, or a purchase still waiting on its page. */
    | 'NOT_NEEDED'
    /** The provider did not answer, or the re-read still shows an open page. Retry later. */
    | 'UNCONFIRMED';

/**
 * Closes the payment page of a one-time purchase that no longer waits on it, after its first
 * approved payment or its abandonment (HOS-2179 §5.7). It moves the page's expiry to now and
 * confirms by re-reading the page by id (INV:D5: accepted is not applied). The durable decision
 * is the instance leaving `PENDING_AUTHORIZATION`, committed before this call; the provider call
 * is a repeatable expiry move, so a retry after a lost answer is safe. A page whose purchase is
 * still pending is never closed: the customer may be paying on it.
 *
 * Closing protects only as far as the provider honours it (R-3): a second payment is still
 * possible (RP18) and is the duplicate check's case (§5.8).
 *
 * @param input.instanceId - The one-time instance
 * @param ports - Provider and clock
 * @returns The outcome; never throws for a provider failure
 */
export async function closeOneTimePaymentPage(
    input: { readonly instanceId: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<CloseOneTimePaymentPageOutcome> {
    inputSchema.parse(input);
    const [instance] = await getDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instanceId))
        .limit(1);
    if (
        !instance ||
        instance.status === 'PENDING_AUTHORIZATION' ||
        instance.paymentPageId === null ||
        instance.paymentPageExpiresAt === null ||
        instance.paymentPageExpiresAt.getTime() <= ports.clock.now().getTime()
    )
        return 'NOT_NEEDED';
    const paymentPageId = instance.paymentPageId;
    try {
        await ports.provider.closeOneTimePayment({ paymentPageId });
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readOneTimePayment({ paymentPageId });
        const { snapshot, readAt } = assertFreshForAct({ read, act });
        if (
            snapshot.paymentPageId !== paymentPageId ||
            snapshot.expiresAt === null ||
            Date.parse(snapshot.expiresAt) > readAt.getTime()
        )
            return 'UNCONFIRMED';
        await getDb()
            .update(addonInstances)
            .set({ paymentPageExpiresAt: new Date(snapshot.expiresAt) })
            .where(
                and(
                    eq(addonInstances.id, instance.id),
                    eq(addonInstances.paymentPageId, paymentPageId)
                )
            );
        return 'CLOSED';
    } catch (error) {
        logger.warn(
            {
                instanceId: instance.id,
                paymentPageId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Payment page close not confirmed'
        );
        return 'UNCONFIRMED';
    }
}
