import { coveredPeriods, eq, payments, providerLinks, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
    ClosedChargeSnapshot,
    ClosedChargeSnapshots
} from '../../../src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshot.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

const DAY = 86_400_000;
const subscriptionIds: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const id of subscriptionIds.splice(0)) {
        await db.delete(coveredPeriods).where(eq(coveredPeriods.subscriptionId, id));
        await db.update(payments).set({ status: 'FAILED' }).where(eq(payments.subscriptionId, id));
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, id));
        await db.update(subscriptions).set({ status: 'ABANDONED' }).where(eq(subscriptions.id, id));
    }
});

/** Two approved, unregistered charges a month apart; the older one is the candidate for a snapshot. */
async function seedTwoCharges() {
    let nowMs = Date.parse('2026-08-01T12:00:00.000Z');
    const clock = { now: () => new Date(nowMs) };
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M8', why: 'an approved test charge must be visible immediately' }]
    });
    const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
    subscriptionIds.push(seeded.subscription.id);
    const older = await fake.charge({
        authorizationId: seeded.providerId!,
        amount: { amountMinor: 250000, currency: 'ARS' },
        reference: `${seeded.subscription.id}-older`
    });
    nowMs += 31 * DAY;
    const latest = await fake.charge({
        authorizationId: seeded.providerId!,
        amount: { amountMinor: 250000, currency: 'ARS' },
        reference: `${seeded.subscription.id}-latest`
    });
    nowMs += 60 * 60 * 1000;
    return { fake, clock, older, latest };
}

function closedFor(input: {
    readonly chargeId: string;
    readonly refundedAmountMinor: number;
    readonly chargedBack?: boolean;
}): ClosedChargeSnapshot {
    return {
        chargeId: input.chargeId,
        providerCreatedAt: '2026-08-01T12:00:00.000Z',
        status: 'approved',
        purpose: 'charge',
        authorizationId: null,
        reference: null,
        amountMinor: 250000,
        currency: 'ARS',
        refundedAmountMinor: input.refundedAmountMinor,
        chargedBack: input.chargedBack ?? false
    };
}

async function sweepWith(input: {
    readonly fake: FakePaymentProvider;
    readonly clock: { now(): Date };
    readonly closed: readonly ClosedChargeSnapshot[];
}) {
    const reads: string[] = [];
    const provider = input.fake as unknown as PaymentProvider;
    const counting = new Proxy(provider, {
        get(target, property) {
            const value = Reflect.get(target, property, target);
            if (property !== 'readCharge')
                return typeof value === 'function' ? value.bind(target) : value;
            return async (args: { chargeId: string }) => {
                reads.push(args.chargeId);
                return (target as PaymentProvider).readCharge(args);
            };
        }
    });
    const closedChargeSnapshots: ClosedChargeSnapshots = {
        find: async ({ chargeIds }) =>
            input.closed.filter((item) => chargeIds.includes(item.chargeId))
    };
    const summary = await withSeededReconciliationInventory(() =>
        runReconciliationSweep(
            { mode: 'single' },
            {
                provider: counting,
                clock: input.clock,
                comparisons: [
                    createPeriodChargesComparison({ provider: counting, closedChargeSnapshots })
                ]
            }
        )
    );
    return { summary, reads };
}

describe('HOS-1999 B3 period charges comparison over closed snapshots', () => {
    it('does not read a closed charge live and still compares it (kills a snapshot that is skipped)', async () => {
        const { fake, clock, older, latest } = await seedTwoCharges();
        const { summary, reads } = await sweepWith({
            fake,
            clock,
            closed: [closedFor({ chargeId: older.chargeId, refundedAmountMinor: 0 })]
        });
        expect(reads).toEqual([latest.chargeId]);
        // The closed approved charge has no ledger payment, exactly like a live one: two divergences.
        expect(summary).toMatchObject({ divergences: 2, rowsFailed: 0 });
    });

    it('skips a closed charge refunded in full (AC-12: the rewritten snapshot is seen)', async () => {
        const seeded = await seedTwoCharges();
        const run = await sweepWith({
            ...seeded,
            closed: [closedFor({ chargeId: seeded.older.chargeId, refundedAmountMinor: 250000 })]
        });
        expect(run.summary).toMatchObject({ divergences: 1, rowsFailed: 0 });
    });

    it('skips a closed charge that was charged back', async () => {
        const seeded = await seedTwoCharges();
        const run = await sweepWith({
            ...seeded,
            closed: [
                closedFor({
                    chargeId: seeded.older.chargeId,
                    refundedAmountMinor: 0,
                    chargedBack: true
                })
            ]
        });
        expect(run.summary).toMatchObject({ divergences: 1, rowsFailed: 0 });
    });

    it('re-reads the latest charge live even when its snapshot is closed (AC-31)', async () => {
        const { fake, clock, older, latest } = await seedTwoCharges();
        const { reads } = await sweepWith({
            fake,
            clock,
            closed: [
                closedFor({ chargeId: older.chargeId, refundedAmountMinor: 0 }),
                {
                    ...closedFor({ chargeId: latest.chargeId, refundedAmountMinor: 0 }),
                    providerCreatedAt: '2026-09-01T12:00:00.000Z'
                }
            ]
        });
        expect(reads).toEqual([latest.chargeId]);
    });
});
