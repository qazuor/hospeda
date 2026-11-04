import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import {
    coveredPeriods,
    eq,
    idempotencyKeys,
    inArray,
    payments,
    promoCodes,
    promoRedemptions,
    providerLinks,
    subscriptionPauses,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { getServiceTestDb, getServiceTestPool } from '../helpers.js';
import {
    seedPredecessor,
    seedSuccessionChoice,
    successionClock,
    successionPorts,
    successionReturnUrl
} from './succession-fixtures.js';

const owned: Array<{ userId: string; predecessorId: string; promoCodeIds: string[] }> = [];

/** Seeds one S1/S2-shaped predecessor and programmable contract verdict. */
export async function seedPlanChange(input: {
    readonly status?: string;
    readonly providerState?: 'active' | 'cancelled';
    readonly rankRelation?: 'HIGHER' | 'LOWER';
}) {
    const choice = await seedSuccessionChoice();
    let targetPlanVersionId = choice.targetPlanVersionId;
    let targetBillingOptionId = choice.targetBillingOptionId;
    if (input.rankRelation) {
        const source = await getServiceTestPool().query<{ rank: number }>(
            'SELECT rank FROM plan_version WHERE id = $1',
            [choice.planVersionId]
        );
        const targetPlan = await getServiceTestPool().query<{ plan_id: string }>(
            'SELECT plan_id FROM plan_version WHERE id = $1',
            [choice.targetPlanVersionId]
        );
        const originRank = source.rows[0]?.rank;
        const planId = targetPlan.rows[0]?.plan_id;
        if (originRank === undefined || !planId) throw new Error('Rank fixture missing');
        const version = await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, true, false, 0, false) RETURNING id',
            [planId, 'accommodation', originRank + (input.rankRelation === 'HIGHER' ? 1 : -1)]
        );
        targetPlanVersionId = version.rows[0]?.id ?? '';
        const option = await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 500000, 'ARS') RETURNING id",
            [targetPlanVersionId]
        );
        targetBillingOptionId = option.rows[0]?.id ?? '';
    }
    const seeded = await seedPredecessor({
        userId: choice.user.id,
        planVersionId: choice.planVersionId,
        billingOptionId: choice.predecessorBillingOptionId,
        status: input.status ?? 'ACTIVE',
        providerState: input.providerState ?? 'active',
        honestAboutM1: true
    });
    const nextChargeAt = new Date('2026-11-11T13:00:00.000Z');
    await getServiceTestDb()
        .update(subscriptions)
        .set({ nextChargeAt })
        .where(eq(subscriptions.id, seeded.predecessor.id));
    if (input.status === 'PAUSED')
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: seeded.predecessor.id,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: 2,
                startsAt: new Date('2026-10-10T13:00:00.000Z'),
                expectedEndAt: new Date('2026-12-10T13:00:00.000Z')
            });
    const verticals = new VerticalsForBillingSimulator({ clock: successionClock });
    verticals.setPlanPolicy({
        planVersionId: targetPlanVersionId,
        policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
    });
    verticals.setPlanPolicy({
        planVersionId: choice.planVersionId,
        policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
    });
    owned.push({ userId: choice.user.id, predecessorId: seeded.predecessor.id, promoCodeIds: [] });
    return {
        ...choice,
        targetPlanVersionId,
        targetBillingOptionId,
        ...seeded,
        nextChargeAt,
        verticals,
        ports: {
            ...successionPorts(seeded.provider),
            planPolicy: verticals.planPolicy.bind(verticals),
            changeDirection: verticals.changeDirection.bind(verticals)
        },
        input: {
            actor: { id: choice.user.id },
            subscriptionId: seeded.predecessor.id,
            billingOptionId: targetBillingOptionId,
            returnUrl: successionReturnUrl,
            payerEmail: choice.user.email
        }
    };
}

/** Credits a paid monthly period covering the frozen clock. */
export async function seedCoveredPayment(input: {
    readonly subscriptionId: string;
    readonly amountMinor: number;
}) {
    const db = getServiceTestDb();
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: input.amountMinor,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'fake',
            providerFactId: crypto.randomUUID(),
            factAt: successionClock.now()
        })
        .returning();
    if (!payment) throw new Error('Payment fixture missing');
    const periodStart = new Date('2026-10-01T13:00:00.000Z');
    await db.insert(coveredPeriods).values({
        subscriptionId: input.subscriptionId,
        periodStart,
        paymentId: payment.id,
        creditedAt: periodStart
    });
    return { payment, periodStart };
}

/** Seeds an active promotion on this subscription. */
export async function seedPlanChangePromo(input: {
    readonly subscriptionId: string;
    readonly userId: string;
}) {
    const db = getServiceTestDb();
    const [code] = await db
        .insert(promoCodes)
        .values({
            code: `PLAN-${crypto.randomUUID()}`,
            discountKind: 'FIXED',
            value: 1000,
            allVerticals: true,
            stackable: true,
            usableWithAnotherActive: true,
            durationKind: 'N_CHARGES',
            durationCharges: 2,
            validFrom: new Date('2026-01-01T00:00:00Z')
        })
        .returning();
    if (!code) throw new Error('Promo fixture missing');
    const [redemption] = await db
        .insert(promoRedemptions)
        .values({
            promoCodeId: code.id,
            userId: input.userId,
            subscriptionId: input.subscriptionId,
            redeemedAt: successionClock.now(),
            remainingCharges: 2
        })
        .returning();
    if (!redemption) throw new Error('Redemption fixture missing');
    const owner = owned.find((item) => item.predecessorId === input.subscriptionId);
    owner?.promoCodeIds.push(code.id);
    return redemption;
}

/** Removes only mutable rows seeded by this fixture after each case. */
export async function retirePlanChanges(): Promise<void> {
    const db = getServiceTestDb();
    for (const item of owned.splice(0)) {
        const successorRows = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, item.predecessorId));
        const ids = [item.predecessorId, ...successorRows.map((row) => row.id)];
        await db
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.subscriptionId, ids));
        await db.delete(coveredPeriods).where(inArray(coveredPeriods.subscriptionId, ids));
        await db.delete(payments).where(inArray(payments.subscriptionId, ids));
        await db.delete(promoRedemptions).where(inArray(promoRedemptions.subscriptionId, ids));
        if (item.promoCodeIds.length)
            await db.delete(promoCodes).where(inArray(promoCodes.id, item.promoCodeIds));
        await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, ids));
        await db.delete(subscriptionPauses).where(inArray(subscriptionPauses.subscriptionId, ids));
        await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.subjectId, ids));
        await db
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, item.predecessorId));
        for (const successor of successorRows)
            await db.delete(subscriptions).where(eq(subscriptions.id, successor.id));
        await db.delete(subscriptions).where(eq(subscriptions.id, item.predecessorId));
        await db.delete(users).where(eq(users.id, item.userId));
    }
}
