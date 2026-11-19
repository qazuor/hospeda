import {
    billingDeadlineVersions,
    eq,
    inArray,
    payments,
    planMigrationSubscriptions,
    planMigrations,
    promoRedemptionCharges,
    promoRedemptions,
    receipts,
    type SelectSubscription,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { applyS37ClosureInTx } from '../../../src/services/billing/plan-migration/plan-migration-s37-card.js';
import { createPromoChargePolicy } from '../../../src/services/billing/promo/promo-charge-policy.js';
import { composePromoAmount } from '../../../src/services/billing/promo/promo-composition.js';
import { recordAmountMutationDecided } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-mutation-decision.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { queueDowngrade } from '../../../src/services/billing/subscription/request-plan-change-support.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedPlanChange,
    seedPlanChangeTargetWithLimit
} from './support/plan-change-fixtures.js';
import { retirePromoFixtures, seedPromoRedemption } from './support/promo-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';

const scopeIds: string[] = [];
const migrationIds: string[] = [];
afterEach(async () => {
    if (scopeIds.length) {
        await getServiceTestDb()
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.planMigrationSubscriptionId, scopeIds));
        await getServiceTestDb()
            .delete(planMigrationSubscriptions)
            .where(inArray(planMigrationSubscriptions.id, scopeIds.splice(0)));
    }
    if (migrationIds.length)
        await getServiceTestDb()
            .delete(planMigrations)
            .where(inArray(planMigrations.id, migrationIds.splice(0)));
    await retirePlanChanges();
    await retirePromoFixtures();
});
afterAll(closeServiceTestPool);

/** The origin monthly price `seedPlanChange` seeds. */
const OLD_PRICE = 250000;
const NEW_PRICE = 100000;
const EARLY_REDEEM = new Date('2026-09-01T13:00:00.000Z');
const DECIDED_AT = new Date('2026-09-15T13:00:00.000Z');
const LATE_REDEEM = new Date('2026-09-20T13:00:00.000Z');
const EFFECTIVE_AT = new Date('2026-10-01T13:00:00.000Z');
const DESTINATION_CHARGE = new Date('2026-10-01T14:00:00.000Z');
const APPLIED_AT = new Date('2026-10-02T13:00:00.000Z');
const percent = { discountKind: 'PERCENTAGE' as const, value: 20 };
const fixed = { discountKind: 'FIXED' as const, value: 10000 };

async function reload(subscriptionId: string): Promise<SelectSubscription> {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('Subscription fixture missing');
    return row;
}

async function seedPromo(
    seeded: Awaited<ReturnType<typeof seedPlanChange>>,
    input: {
        readonly discountKind: 'PERCENTAGE' | 'FIXED';
        readonly value: number;
        readonly charges: number | null;
        readonly redeemedAt: Date;
    }
) {
    const promo = await seedPromoRedemption({
        subscriptionId: seeded.predecessor.id,
        userId: seeded.user.id,
        discountKind: input.discountKind,
        value: input.value,
        remainingCharges: input.charges,
        redeemedAt: input.redeemedAt,
        durationKind: input.charges === null ? 'FOREVER' : 'N_CHARGES'
    });
    await getServiceTestDb()
        .update(promoRedemptions)
        .set({ initialCharges: input.charges })
        .where(eq(promoRedemptions.id, promo.redemptionId));
    return promo;
}

async function expected(subscriptionId: string, purpose: 'AUTHORIZATION' | Date) {
    return createCutExpectedAmountPolicy({ executor: getServiceTestDb() }).expectedAmount({
        subscription: await reload(subscriptionId),
        purpose:
            purpose === 'AUTHORIZATION'
                ? { kind: 'AUTHORIZATION' }
                : { kind: 'PERIOD', chargeCreatedAt: purpose }
    });
}

async function applyS38(subscriptionId: string) {
    const applied = await getServiceTestDb().transaction((tx) =>
        applyScheduledChangeInTx({ subscriptionId, now: APPLIED_AT, tx })
    );
    expect(applied.outcome).toBe('APPLIED');
}

/** A card subscription at OLD_PRICE with an early forever promo and a destination version. */
async function withEarlyPromo(destinationPrice: number) {
    const seeded = await seedPlanChange({ nextChargeAt: EFFECTIVE_AT });
    const target = await seedPlanChangeTargetWithLimit({
        sourcePlanVersionId: seeded.planVersionId,
        targetLimit: 10,
        amountMinor: destinationPrice
    });
    await seedPromo(seeded, { ...percent, charges: null, redeemedAt: EARLY_REDEEM });
    return { seeded, target };
}

/** Closes an S37 migration of the given reason through the real writer. */
async function closeS37(
    fixture: Awaited<ReturnType<typeof withEarlyPromo>>,
    reason: 'RETIREMENT' | 'PRICE_INCREASE',
    status: 'PENDIENTE' | 'CLOSE' = 'CLOSE'
) {
    const db = getServiceTestDb();
    const [deadline] = await db
        .select({ version: billingDeadlineVersions.version })
        .from(billingDeadlineVersions)
        .limit(1);
    if (!deadline) throw new Error('Billing deadline fixture missing');
    const [migration] = await db
        .insert(planMigrations)
        .values({
            vertical: 'accommodation',
            sourcePlanVersionId: fixture.seeded.planVersionId,
            targetPlanVersionId: fixture.target.planVersionId,
            reason,
            announcedAt: new Date('2026-07-01T00:00:00.000Z'),
            noticeDays: 60,
            deadlineVersion: deadline.version,
            signedBy: fixture.seeded.user.id
        })
        .returning();
    if (!migration) throw new Error('Migration fixture missing');
    migrationIds.push(migration.id);
    const [scope] = await db
        .insert(planMigrationSubscriptions)
        .values({
            planMigrationId: migration.id,
            subscriptionId: fixture.seeded.predecessor.id,
            applicationDate: EFFECTIVE_AT,
            status: 'PENDIENTE'
        })
        .returning();
    if (!scope) throw new Error('Migration scope fixture missing');
    scopeIds.push(scope.id);
    if (status === 'PENDIENTE') return scope;
    const closed = await db.transaction((tx) =>
        applyS37ClosureInTx({ tx, scopeId: scope.id, now: DECIDED_AT })
    );
    expect(closed.kind).toBe('CLOSED');
    return scope;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2352 the destination charge is priced the same before and after S38',
    () => {
        it('(4a) downgrade: a promo redeemed after the queue prices the destination charge on both sides', async () => {
            const fixture = await withEarlyPromo(NEW_PRICE);
            await queueDowngrade({
                subscriptionId: fixture.seeded.predecessor.id,
                targetPlanVersionId: fixture.target.planVersionId,
                targetBillingOptionId: fixture.target.billingOptionId,
                effectiveAt: EFFECTIVE_AT,
                now: DECIDED_AT
            });
            await seedPromo(fixture.seeded, { ...fixed, charges: null, redeemedAt: LATE_REDEEM });
            const before = await expected(fixture.seeded.predecessor.id, DESTINATION_CHARGE);
            await applyS38(fixture.seeded.predecessor.id);
            const after = await expected(fixture.seeded.predecessor.id, DESTINATION_CHARGE);
            const amountMinor = composePromoAmount({
                listAmountMinor: NEW_PRICE,
                promos: [fixed]
            }).amountMinor;
            expect(before).toMatchObject({ kind: 'COMPARABLE', amountMinor });
            expect(after).toMatchObject({ kind: 'COMPARABLE', amountMinor });
        });

        it('(4b) RETIREMENT: S37 ends the promos, a later one still prices both sides', async () => {
            const fixture = await withEarlyPromo(NEW_PRICE);
            await closeS37(fixture, 'RETIREMENT');
            await seedPromo(fixture.seeded, { ...fixed, charges: null, redeemedAt: LATE_REDEEM });
            const before = await expected(fixture.seeded.predecessor.id, DESTINATION_CHARGE);
            await applyS38(fixture.seeded.predecessor.id);
            const after = await expected(fixture.seeded.predecessor.id, DESTINATION_CHARGE);
            const amountMinor = composePromoAmount({
                listAmountMinor: NEW_PRICE,
                promos: [fixed]
            }).amountMinor;
            expect(before).toMatchObject({ kind: 'COMPARABLE', amountMinor });
            expect(after).toMatchObject({ kind: 'COMPARABLE', amountMinor });
        });

        it('(4c) PRICE_INCREASE: the promos survive and price both sides', async () => {
            const fixture = await withEarlyPromo(300000);
            await closeS37(fixture, 'PRICE_INCREASE');
            await seedPromo(fixture.seeded, { ...fixed, charges: null, redeemedAt: LATE_REDEEM });
            const before = await expected(fixture.seeded.predecessor.id, DESTINATION_CHARGE);
            await applyS38(fixture.seeded.predecessor.id);
            const after = await expected(fixture.seeded.predecessor.id, DESTINATION_CHARGE);
            const amountMinor = composePromoAmount({
                listAmountMinor: 300000,
                promos: [percent, fixed]
            }).amountMinor;
            expect(before).toMatchObject({ kind: 'COMPARABLE', amountMinor });
            expect(after).toMatchObject({ kind: 'COMPARABLE', amountMinor });
        });

        it('(8) authorization keeps today state: queued downgrade and the S37 decided window', async () => {
            const queued = await withEarlyPromo(NEW_PRICE);
            await queueDowngrade({
                subscriptionId: queued.seeded.predecessor.id,
                targetPlanVersionId: queued.target.planVersionId,
                targetBillingOptionId: queued.target.billingOptionId,
                effectiveAt: EFFECTIVE_AT,
                now: DECIDED_AT
            });
            await seedPromo(queued.seeded, { ...fixed, charges: null, redeemedAt: LATE_REDEEM });
            expect(await expected(queued.seeded.predecessor.id, 'AUTHORIZATION')).toMatchObject({
                kind: 'COMPARABLE',
                amountMinor: NEW_PRICE,
                source: 'SCHEDULED_CHANGE'
            });

            const decided = await withEarlyPromo(NEW_PRICE);
            const scope = await closeS37(decided, 'RETIREMENT', 'PENDIENTE');
            await getServiceTestDb().transaction((tx) =>
                recordAmountMutationDecided({
                    subscriptionId: decided.seeded.predecessor.id,
                    transition: 'S37',
                    decidedAt: DECIDED_AT,
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID(),
                    changes: [{ field: 'plan_migration_subscription.id', new: scope.id }],
                    tx
                })
            );
            expect(await expected(decided.seeded.predecessor.id, 'AUTHORIZATION')).toMatchObject({
                kind: 'COMPARABLE',
                amountMinor: NEW_PRICE,
                source: 'MIGRATION_DECIDED'
            });
            expect(await expected(decided.seeded.predecessor.id, DESTINATION_CHARGE)).toMatchObject(
                {
                    kind: 'COMPARABLE',
                    amountMinor: composePromoAmount({
                        listAmountMinor: OLD_PRICE,
                        promos: [percent]
                    }).amountMinor,
                    source: 'ANCHORED'
                }
            );
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2352 P1 judges a late credit by the plan and promos of its charge instant',
    () => {
        it('(9) a pre-S38 discounted charge credited after S38 spends its promo', async () => {
            const seeded = await seedPlanChange({});
            const target = await seedPlanChangeTargetWithLimit({
                sourcePlanVersionId: seeded.planVersionId,
                targetLimit: 10,
                amountMinor: NEW_PRICE
            });
            const promo = await seedPromo(
                { ...seeded },
                { ...percent, charges: 2, redeemedAt: EARLY_REDEEM }
            );
            await seedScheduledChange({
                subscriptionId: seeded.predecessor.id,
                effectiveAt: EFFECTIVE_AT,
                targetPlanVersionId: target.planVersionId,
                targetBillingOptionId: target.billingOptionId
            });
            await applyS38(seeded.predecessor.id);
            const chargeCreatedAt = new Date('2026-09-10T13:00:00.000Z');
            const amount = composePromoAmount({
                listAmountMinor: OLD_PRICE,
                promos: [percent]
            }).amountMinor;
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: seeded.predecessor.id,
                    amount,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: 'fake',
                    providerFactId: `late-credit-${crypto.randomUUID()}`,
                    factAt: chargeCreatedAt
                })
                .returning();
            await creditPayment(
                { paymentId: pending!.id, chargeCreatedAt },
                {
                    clock: { now: () => APPLIED_AT },
                    promoCharges: createPromoChargePolicy(),
                    promoExhaustion: { runS30: vi.fn(async () => undefined) }
                }
            );
            const [after] = await getServiceTestDb()
                .select({ remainingCharges: promoRedemptions.remainingCharges })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, promo.redemptionId));
            expect(after?.remainingCharges).toBe(1);
            expect(
                await getServiceTestDb()
                    .select({ paymentId: promoRedemptionCharges.paymentId })
                    .from(promoRedemptionCharges)
                    .where(eq(promoRedemptionCharges.redemptionId, promo.redemptionId))
            ).toEqual([{ paymentId: pending!.id }]);
            // P1 issued a receipt; it would block the fixture's payment cleanup.
            await getServiceTestDb().delete(receipts).where(eq(receipts.paymentId, pending!.id));
        });
    }
);
