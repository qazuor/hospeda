import { type DrizzleClient, eq, manualPayments, subscriptions } from '@repo/db';
import type { AddonOrphanhoodPorts } from '../../../../src/services/billing/addon/addon-orphanhood-ports';
import { orphanPorts } from './addon-orphan-fixtures';
import { closeNow, seedCloseCase } from './succession-close-fixtures';

/** S31 clock, aligned with the shared S18 fixture rows. */
export const cutNow = closeNow;
/** S31 test ports with real DB backed addon policy and no seeded listing candidates. */
export function successorCutPorts(tx: DrizzleClient): {
    readonly clock: { now: () => Date };
    readonly orphanhood: AddonOrphanhoodPorts;
} {
    return { clock: { now: () => cutNow }, orphanhood: orphanPorts(tx).ports };
}
/** Wraps the immutable S18 fixture and gives the predecessor its S6/S12 terminal shape. */
export async function seedSuccessorCutCase(
    tx: DrizzleClient,
    input: {
        readonly predecessorStatus: 'SUSPENDED' | 'CANCELLED';
        readonly successorStatus: 'PENDING_AUTHORIZATION' | 'ACTIVE' | 'CANCELLED' | 'GRACE_PERIOD';
        readonly paymentMethod?: 'CARD' | 'MANUAL';
        readonly courtesy?: boolean;
        readonly complement?: boolean;
        readonly promo?: boolean;
        readonly retention?: 'OPEN' | 'RELEASED';
    }
) {
    const ids = await seedCloseCase(tx, {
        predecessorStatus: input.predecessorStatus === 'SUSPENDED' ? 'ACTIVE' : 'CANCELLED',
        successorStatus: input.successorStatus === 'CANCELLED' ? 'ACTIVE' : input.successorStatus,
        courtesy: input.courtesy,
        complement: input.complement,
        promo: input.promo,
        retention: input.retention
    });
    await tx
        .update(subscriptions)
        .set({ status: input.predecessorStatus })
        .where(eq(subscriptions.id, ids.predecessor.id));
    if (input.successorStatus === 'CANCELLED')
        await tx
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, ids.successor.id));
    if (input.paymentMethod)
        await tx
            .update(subscriptions)
            .set({ paymentMethod: input.paymentMethod })
            .where(eq(subscriptions.id, ids.successor.id));
    if (input.paymentMethod === 'MANUAL' && input.successorStatus === 'PENDING_AUTHORIZATION') {
        await tx.insert(manualPayments).values({
            subscriptionId: ids.successor.id,
            periodStart: cutNow,
            status: 'AWAITING',
            entry: 'INSTALLMENT'
        });
    }
    return ids;
}
