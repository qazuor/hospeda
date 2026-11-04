import {
    addonInstances,
    billingOptions,
    courtesyGrants,
    type DrizzleClient,
    eq,
    payments,
    promoCodes,
    promoRedemptions,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { createPaymentReconciliationMarkPayments } from '../../../../src/services/billing/payment/payment-ledger';
import { retainPaymentForSuccession } from '../../../../src/services/billing/subscription/succession-retained-payment';
import { seedOrphanInstance } from './addon-orphan-fixtures';
import { frozenClock, seedCoveragePlanVersion, seedCoverageUser } from './coverage-fixtures';

/** Fixed S18 instant and the real payment-mark adapter. */
export const closeNow = new Date('2026-11-12T12:00:00.000Z');
/** The S18 ports for real-database tests. */
export const closePorts = {
    clock: frozenClock(closeNow),
    markPayments: createPaymentReconciliationMarkPayments(frozenClock(closeNow))
};

/** Seed the same subscription and closed COURTESY pause shapes left by a cancellation writer. */
export async function seedCloseCase(
    tx: DrizzleClient,
    input: {
        readonly predecessorStatus?: 'CANCELLED' | 'CHARGE_DECLINED' | 'ACTIVE';
        readonly successorStatus?: 'ACTIVE' | 'PENDING_AUTHORIZATION' | 'GRACE_PERIOD';
        readonly successorCycle?: 'monthly' | 'annual';
        readonly complement?: boolean;
        readonly courtesy?: boolean;
        readonly promo?: boolean;
        readonly retention?: 'OPEN' | 'RELEASED';
    }
) {
    const user = await seedCoverageUser(tx);
    const option = await seedCoveragePlanVersion(tx, 'accommodation');
    const [annual] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: option.planVersionId,
            cycle: 'annual',
            amount: 2500000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!annual) throw new Error('Annual option missing');
    const [predecessor] = await tx
        .insert(subscriptions)
        .values({
            userId: user.userId,
            vertical: 'accommodation',
            planVersionId: option.planVersionId,
            billingOptionId: option.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: input.predecessorStatus ?? 'CANCELLED'
        })
        .returning();
    if (!predecessor) throw new Error('Predecessor missing');
    const [successor] = await tx
        .insert(subscriptions)
        .values({
            userId: user.userId,
            vertical: 'accommodation',
            planVersionId: option.planVersionId,
            billingOptionId: input.successorCycle === 'annual' ? annual.id : option.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: input.successorStatus ?? 'ACTIVE',
            succeedsId: predecessor.id
        })
        .returning();
    if (!successor) throw new Error('Successor missing');
    await tx
        .update(subscriptions)
        .set({ succeededById: successor.id })
        .where(eq(subscriptions.id, predecessor.id));
    let addonId: string | null = null;
    if (input.complement) {
        const addon = await seedOrphanInstance(tx, {
            ownerId: user.userId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: predecessor.id
        });
        addonId = addon.instanceId;
    }
    let grantId: string | null = null;
    if (input.courtesy) {
        const startsAt = new Date('2026-10-01T12:00:00.000Z');
        const endsAt = new Date('2027-01-22T12:00:00.000Z');
        await tx.insert(subscriptionPauses).values({
            subscriptionId: predecessor.id,
            reason: 'COURTESY',
            startsAt,
            expectedEndAt: endsAt,
            actualEndAt: closeNow
        });
        const [grant] = await tx
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: user.userId,
                grantedBy: user.userId,
                subscriptionId: predecessor.id,
                months: 4,
                startsAt,
                endsAt,
                reason: 'fixture'
            })
            .returning({ id: courtesyGrants.id });
        if (!grant) throw new Error('Courtesy grant missing');
        grantId = grant.id;
    }
    let redemptionId: string | null = null;
    if (input.promo) {
        const [code] = await tx
            .insert(promoCodes)
            .values({
                code: `s18-${crypto.randomUUID()}`,
                discountKind: 'FIXED',
                value: 100,
                allVerticals: true,
                stackable: false,
                usableWithAnotherActive: false,
                durationKind: 'N_CHARGES',
                durationCharges: 3
            })
            .returning({ id: promoCodes.id });
        if (!code) throw new Error('Promo code missing');
        const [redemption] = await tx
            .insert(promoRedemptions)
            .values({
                promoCodeId: code.id,
                userId: user.userId,
                redeemedAt: closeNow,
                subscriptionId: predecessor.id,
                remainingCharges: 2
            })
            .returning({ id: promoRedemptions.id });
        if (!redemption) throw new Error('Promo redemption missing');
        redemptionId = redemption.id;
    }
    let paymentId: string | null = null;
    if (input.retention) {
        const [payment] = await tx
            .insert(payments)
            .values({
                subscriptionId: predecessor.id,
                amount: 250000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `s18-${crypto.randomUUID()}`,
                factAt: closeNow
            })
            .returning({ id: payments.id });
        if (!payment) throw new Error('Payment missing');
        paymentId = payment.id;
        await tx
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.id, predecessor.id))
            .for('update');
        await retainPaymentForSuccession({
            subscriptionId: predecessor.id,
            payment: { source: 'PAYMENT', id: payment.id },
            unpaidSince: new Date('2026-11-01T12:00:00Z'),
            now: closeNow,
            tx
        });
        if (input.retention === 'RELEASED')
            await tx
                .update(successionRetainedPayments)
                .set({ releasedAt: closeNow, releaseReason: 'REVOCATION_REFUNDED' })
                .where(eq(successionRetainedPayments.paymentId, payment.id));
    }
    return {
        predecessor,
        successor,
        addonId,
        grantId,
        redemptionId,
        paymentId,
        userId: user.userId
    };
}

/** Read only the rows seeded by this case. */
export async function readCloseCase(
    tx: DrizzleClient,
    ids: Awaited<ReturnType<typeof seedCloseCase>>
) {
    const [predecessor] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, ids.predecessor.id));
    const [successor] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, ids.successor.id));
    const [addon] = ids.addonId
        ? await tx.select().from(addonInstances).where(eq(addonInstances.id, ids.addonId))
        : [];
    const [grant] = ids.grantId
        ? await tx.select().from(courtesyGrants).where(eq(courtesyGrants.id, ids.grantId))
        : [];
    const [redemption] = ids.redemptionId
        ? await tx.select().from(promoRedemptions).where(eq(promoRedemptions.id, ids.redemptionId))
        : [];
    const [retention] = ids.paymentId
        ? await tx
              .select()
              .from(successionRetainedPayments)
              .where(eq(successionRetainedPayments.paymentId, ids.paymentId))
        : [];
    const marks = await tx
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, ids.predecessor.id));
    const hung = marks.length
        ? await tx
              .select()
              .from(reconciliationMarkPayments)
              .where(eq(reconciliationMarkPayments.markId, marks[0]!.id))
        : [];
    return { predecessor, successor, addon, grant, redemption, retention, marks, hung };
}
