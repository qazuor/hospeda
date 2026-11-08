import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, and, domainEventModel, eq, getDb } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports';
import { confirmOneTimeOrder } from './addon-instance-a2-one-time';
import type { A5Ports } from './addon-instance-a5';

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
