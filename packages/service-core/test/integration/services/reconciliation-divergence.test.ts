import {
    domainEventModel,
    eq,
    providerLinks,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import { assertFreshForAct } from '@repo/payments';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReconciliationComparison } from '../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

describe('TEST:B11:7 divergence opens a mark without applying provider values', () => {
    // The real provider-state transition comparison is AC:B11:8 (HOS-1604); this test supplies the extension double.
    it.each([
        ['status', 'TRANSICION_NO_DECLARADA'],
        ['amount', 'DIVERGENCIA_DE_MONTO'],
        ['charge', 'COBRO_SIN_REGISTRAR']
    ] as const)('TEST:B11:7 records the %s divergence and accumulates its existing mark', async (family, reason) => {
        const { fake } = createReconciliationFake();
        const owned = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const [beforeSubscription] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, owned.subscription.id));
        const [beforeLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, owned.subscription.id));
        if (!beforeSubscription || !beforeLink) throw new Error('Fixture row/link missing');
        if (family === 'status') await fake.cancel({ authorizationId: owned.providerId! });
        const cancel = vi.spyOn(fake, 'cancel');
        cancel.mockClear();
        const changeAmount = vi.spyOn(fake, 'changeAmount');
        const pause = vi.spyOn(fake, 'pause');
        const resume = vi.spyOn(fake, 'resume');
        const charge = vi.spyOn(fake, 'charge');
        const refund = vi.spyOn(fake, 'refund');
        const hang = vi.fn(async () => {});
        const comparison: ReconciliationComparison = ({ read, act }) => {
            const { snapshot } = assertFreshForAct({ read, act });
            if (family === 'status' && snapshot.status !== 'cancelled') return [];
            return [
                {
                    reason,
                    ...(family === 'charge'
                        ? { payment: { source: 'PAYMENT' as const, id: crypto.randomUUID() } }
                        : {})
                }
            ];
        };
        const ports = {
            provider: fake,
            clock: reconciliationClock,
            comparisons: [comparison],
            ...(family === 'charge'
                ? { markPayments: { hang, countUnresolved: async () => 0 } }
                : {})
        };
        const correlationId = crypto.randomUUID();
        const run = () =>
            withSeededReconciliationInventory(() =>
                runReconciliationSweep({ correlationId }, ports)
            );
        const first = await run();
        const second = await run();
        expect(first).toMatchObject({ divergences: 1, marksOpened: 1, rowsFailed: 0 });
        expect(second).toMatchObject({ divergences: 1, marksAccumulated: 1, rowsFailed: 0 });
        expect(
            (
                await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, owned.subscription.id))
            )[0]
        ).toEqual(beforeSubscription);
        expect(
            (
                await getServiceTestDb()
                    .select()
                    .from(providerLinks)
                    .where(eq(providerLinks.subscriptionId, owned.subscription.id))
            )[0]
        ).toEqual(beforeLink);
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: owned.subscription.id }
        });
        expect(marks.filter((item) => item.reason === reason)).toHaveLength(1);
        expect(
            (await domainEventModel.findByCorrelationId({ correlationId })).filter(
                (event) => event.eventType === 'reconciliation.mark_opened'
            )
        ).toHaveLength(2);
        expect(cancel).not.toHaveBeenCalled();
        expect(changeAmount).not.toHaveBeenCalled();
        expect(pause).not.toHaveBeenCalled();
        expect(resume).not.toHaveBeenCalled();
        expect(charge).not.toHaveBeenCalled();
        expect(refund).not.toHaveBeenCalled();
        if (family === 'charge') expect(hang).toHaveBeenCalledTimes(2);
    });

    it('TEST:B11:7 makes a payment divergence without a registered payment port visibly fail only its row', async () => {
        const { fake } = createReconciliationFake();
        await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const comparison: ReconciliationComparison = () => [
            {
                reason: 'COBRO_SIN_REGISTRAR',
                payment: { source: 'PAYMENT', id: crypto.randomUUID() }
            }
        ];
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {},
                {
                    provider: fake,
                    clock: reconciliationClock,
                    comparisons: [comparison]
                }
            )
        );
        expect(summary.rowsFailed).toBe(1);
        expect(summary.failures).toHaveLength(1);
    });
});
