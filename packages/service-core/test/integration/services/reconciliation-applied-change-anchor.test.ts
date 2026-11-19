import { DomainEventModel, eq, type SelectSubscription, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { compareCreditedChargeAmount } from '../../../src/services/billing/reconciliation/sweep/comparisons/credited-charge-amount.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedCoveredPayment,
    seedPlanChange,
    seedPlanChangeTargetWithLimit
} from './support/plan-change-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

/** Price of the predecessor's monthly option seeded by `seedPlanChange`. */
const OLD_PRICE = 250000;
/** Price of the downgrade destination. */
const NEW_PRICE = 100000;
/** When the queued downgrade takes effect (the next charge date). */
const EFFECTIVE_AT = new Date('2026-10-01T13:00:00.000Z');
/** When the S38 cron actually applied it: one day late. */
const APPLIED_AT = new Date('2026-10-02T13:00:00.000Z');

async function reload(subscriptionId: string): Promise<SelectSubscription> {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('Subscription fixture missing');
    return row;
}

/** A card subscription at OLD_PRICE whose downgrade to NEW_PRICE S38 already applied. */
async function appliedDowngrade() {
    const seeded = await seedPlanChange({});
    const target = await seedPlanChangeTargetWithLimit({
        sourcePlanVersionId: seeded.planVersionId,
        targetLimit: 10,
        amountMinor: NEW_PRICE
    });
    await seedScheduledChange({
        subscriptionId: seeded.predecessor.id,
        effectiveAt: EFFECTIVE_AT,
        targetPlanVersionId: target.planVersionId,
        targetBillingOptionId: target.billingOptionId
    });
    const applied = await getServiceTestDb().transaction((tx) =>
        applyScheduledChangeInTx({ subscriptionId: seeded.predecessor.id, now: APPLIED_AT, tx })
    );
    expect(applied.outcome).toBe('APPLIED');
    return { seeded, target, subscription: await reload(seeded.predecessor.id) };
}

async function compare(input: {
    readonly subscription: SelectSubscription;
    readonly chargedMinor: number;
    readonly chargeCreatedAt: Date;
}) {
    const { payment } = await seedCoveredPayment({
        subscriptionId: input.subscription.id,
        amountMinor: input.chargedMinor
    });
    const addUndercharge = vi.fn(async () => undefined);
    const divergences = await compareCreditedChargeAmount({
        subscription: input.subscription,
        paymentId: payment.id,
        promoChargesRecorded: payment.promoChargesRecorded,
        chargeId: `charge-${crypto.randomUUID()}`,
        chargedMinor: input.chargedMinor,
        chargeCurrency: 'ARS',
        chargeCreatedAt: input.chargeCreatedAt,
        isAlreadyHung: async () => false,
        ports: {
            expectedAmounts: createCutExpectedAmountPolicy({ executor: getServiceTestDb() }),
            dailySummary: { addUndercharge }
        }
    });
    return { divergences, addUndercharge };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2345 a credited charge is compared with the plan in force when it was made',
    () => {
        it('does not flag a charge made at the previous plan price before an applied downgrade', async () => {
            const { subscription } = await appliedDowngrade();
            const { divergences, addUndercharge } = await compare({
                subscription,
                chargedMinor: OLD_PRICE,
                chargeCreatedAt: new Date('2026-09-01T13:00:00.000Z')
            });
            expect(divergences).toEqual([]);
            expect(addUndercharge).not.toHaveBeenCalled();
        });

        it('still flags a charge that really exceeds the price of the plan it was made under', async () => {
            const { subscription } = await appliedDowngrade();
            const { divergences } = await compare({
                subscription,
                chargedMinor: OLD_PRICE + 150000,
                chargeCreatedAt: new Date('2026-09-01T13:00:00.000Z')
            });
            expect(divergences).toHaveLength(1);
            expect(divergences[0]?.reason).toBe('IMPORTE_COBRADO_DE_MAS');
            expect(divergences[0]?.detail).toEqual(
                expect.arrayContaining([
                    { field: 'reconciliation_mark.expected_minor', new: OLD_PRICE },
                    { field: 'reconciliation_mark.proposed_refund_minor', new: 150000 }
                ])
            );
        });

        it('compares a charge from the effective instant on with the new plan, even before S38 ran', async () => {
            const { subscription } = await appliedDowngrade();
            const policy = createCutExpectedAmountPolicy({ executor: getServiceTestDb() });
            const atEffective = await policy.expectedAmount({
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: EFFECTIVE_AT }
            });
            const justBefore = await policy.expectedAmount({
                subscription,
                purpose: {
                    kind: 'PERIOD',
                    chargeCreatedAt: new Date(EFFECTIVE_AT.getTime() - 1)
                }
            });
            expect(atEffective).toMatchObject({ kind: 'COMPARABLE', amountMinor: NEW_PRICE });
            expect(justBefore).toMatchObject({ kind: 'COMPARABLE', amountMinor: OLD_PRICE });
            const { divergences } = await compare({
                subscription,
                chargedMinor: NEW_PRICE,
                chargeCreatedAt: new Date('2026-10-01T15:00:00.000Z')
            });
            expect(divergences).toEqual([]);
        });

        it('records the effective instant on the S38 event', async () => {
            const { subscription } = await appliedDowngrade();
            const [event] = (
                await new DomainEventModel().findByEntity({
                    entityType: 'subscription',
                    entityId: subscription.id
                })
            ).filter((row) => row.eventType === 'subscription.scheduled_change_applied');
            expect(event?.changes).toContainEqual({
                field: 'effective_at',
                new: EFFECTIVE_AT.toISOString()
            });
        });

        it('falls back to the application instant for an S38 event written without the effective instant', async () => {
            const { seeded, target, subscription } = await appliedDowngrade();
            const legacy = await new DomainEventModel().insert({
                eventType: 'subscription.scheduled_change_applied',
                entityType: 'subscription',
                entityId: subscription.id,
                actorType: 'job',
                correlationId: subscription.id,
                reason: 'S38',
                occurredAt: new Date('2026-08-01T13:00:00.000Z'),
                changes: [
                    {
                        field: 'plan_version_id',
                        old: target.planVersionId,
                        new: seeded.planVersionId
                    },
                    {
                        field: 'billing_option_id',
                        old: target.billingOptionId,
                        new: seeded.predecessorBillingOptionId
                    }
                ]
            });
            expect(legacy.id).toBeTruthy();
            const policy = createCutExpectedAmountPolicy({ executor: getServiceTestDb() });
            const beforeLegacy = await policy.expectedAmount({
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: new Date('2026-07-01T13:00:00.000Z') }
            });
            const betweenBoth = await policy.expectedAmount({
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: new Date('2026-09-01T13:00:00.000Z') }
            });
            expect(beforeLegacy).toMatchObject({ amountMinor: NEW_PRICE });
            expect(betweenBoth).toMatchObject({ amountMinor: OLD_PRICE });
        });
    }
);
