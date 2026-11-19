import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, and, domainEventModel, eq, getDb } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports';
import { confirmOneTimeOrder } from './addon-instance-a2-one-time';
import type { A5Ports } from './addon-instance-a5';
import { confirmOneTimePageByReference } from './confirm-one-time-page-by-reference';

const abandonInputSchema = z.object({
    instanceId: z.uuid(),
    expectedProviderOrderId: z.string().min(1).nullable(),
    now: z.date()
});
const expireInputSchema = z.object({
    instanceId: z.uuid(),
    providerOrderId: z.string().min(1).nullable()
});

/** Closes a pending one-time addon without touching its stored provider order id. */
export async function abandonOneTimeAddon(input: {
    readonly instanceId: string;
    readonly expectedProviderOrderId: string | null;
    readonly now: Date;
}): Promise<boolean> {
    abandonInputSchema.parse(input);
    return getDb().transaction(async (tx) => {
        const [instance] = await tx
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, input.instanceId))
            .limit(1)
            .for('update');
        if (
            instance?.status !== 'PENDING_AUTHORIZATION' ||
            instance.providerOrderId !== input.expectedProviderOrderId
        )
            return false;
        const [updated] = await tx
            .update(addonInstances)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(addonInstances.id, instance.id),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: addonInstances.id });
        if (!updated) throw new Error('A3 one-time state changed under lock');
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: instance.id,
            actorType: 'job',
            actorId: null,
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
            occurredAt: input.now,
            tx
        });
        return true;
    });
}

/** A3 only confirms an existing order; an unanswered read leaves the instance pending. */
export async function expireOneTimeAddon(
    input: { readonly instanceId: string; readonly providerOrderId: string | null },
    ports: A5Ports & {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly coverageNotices: CoverageNotices;
    }
): Promise<'ACTIVATED' | 'ABANDONED' | 'DEFERRED'> {
    expireInputSchema.parse(input);
    if (input.providerOrderId) {
        const result = await confirmOneTimeOrder({ instanceId: input.instanceId }, ports);
        if (result.outcome === 'ACTIVATED') return 'ACTIVATED';
        if (result.outcome === 'UNKNOWN' || result.outcome === 'NOT_APPLICABLE') return 'DEFERRED';
    }
    return (await abandonOneTimeAddon({
        instanceId: input.instanceId,
        expectedProviderOrderId: input.providerOrderId,
        now: ports.clock.now()
    }))
        ? 'ABANDONED'
        : 'DEFERRED';
}

/**
 * A3 for a payment page purchase (HOS-2179 §5.4): it only confirms, never creates. It searches
 * the payments by the purchase's reference and re-reads each id (through A2); an approved one
 * activates the purchase. Only when every id re-read is not an approved payment does the
 * purchase become `ABANDONED`. A search or a read that does not answer, or an approved payment
 * that cannot activate, leaves it pending for the next run.
 *
 * There is no page to close here (§5.7): A3 selects a page purchase only once its stored page
 * expiry plus the margin has passed, so the page already takes no payment (RP19). A purchase
 * without a stored expiry never recorded a page id.
 *
 * @param input.instanceId - The pending page purchase whose window elapsed
 * @param ports - A2's ports plus the coverage notices
 * @returns What this run did
 */
export async function expireOneTimePageAddon(
    input: { readonly instanceId: string },
    ports: A5Ports & {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly coverageNotices: CoverageNotices;
    }
): Promise<'ACTIVATED' | 'ABANDONED' | 'DEFERRED'> {
    z.object({ instanceId: z.uuid() }).parse(input);
    const found = await confirmOneTimePageByReference(input, ports);
    if (found === 'ACTIVATED') return 'ACTIVATED';
    if (found !== 'NONE_APPROVED') return 'DEFERRED';
    const abandoned = await abandonOneTimeAddon({
        instanceId: input.instanceId,
        expectedProviderOrderId: null,
        now: ports.clock.now()
    });
    return abandoned ? 'ABANDONED' : 'DEFERRED';
}
