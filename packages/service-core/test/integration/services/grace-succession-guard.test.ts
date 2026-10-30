import { coverageLosses, eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    providerPauseOnActiveOccurrenceId,
    successorProviderCancelledOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { createProviderPauseCheck } from '../../../src/services/billing/reconciliation/sweep/provider-pause-check.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    paymentFor,
    predecessorInGrace,
    retentionsOf,
    retireSuccessionCases,
    type SeededSuccession,
    seedLiveSuccessor,
    subscriptionRow
} from './support/succession-retention-fixtures.js';
import { sweepInput } from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: SeededSuccession[] = [];

afterEach(async () => {
    const cases = seeded.splice(0);
    await retireSuccessionCases(cases);
    for (const own of cases)
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(eq(coverageLosses.userId, own.userId));
});

describe('HOS-1559 AC:B7:11 (la rama de los otros eventos de TEST:B7:7) — S6 waits for succession', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — first event waits for the successor, then suspends after it dies',
        async () => {
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            s.expireClock();
            await s.runCheck();
            const waiting = await subscriptionRow(s.subscriptionId);
            expect(waiting.status).toBe('GRACE_PERIOD');
            expect(waiting.graceEndsAt).toEqual(s.graceEndsAt);
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
            expect(s.coverageSeen).toEqual([]);
            expect(await s.runS6()).toEqual({
                outcome: 'NOT_APPLICABLE',
                reason: 'SUCCESSION_IN_PROGRESS'
            });

            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ABANDONED' })
                .where(eq(subscriptions.id, s.successor.id));
            await s.runCheck();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.cancel).toHaveBeenCalledTimes(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — second event on ACTIVE waits for a live successor',
        async () => {
            const fixture = await graceWithFailedCycle();
            const subscriptionId = fixture.started.subscriptionId;
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ACTIVE', graceStartedAt: null, graceEndsAt: null })
                .where(eq(subscriptions.id, subscriptionId));
            const successor = await seedLiveSuccessor(fixture, subscriptionId);
            seeded.push({
                subscriptionIds: [subscriptionId, successor.id],
                userId: fixture.user.id
            });
            await fixture.provider.pause({ authorizationId: fixture.started.authorizationId });
            const cancel = vi.spyOn(fixture.provider, 'cancel');
            const beforeCancel = vi.fn(outboxBeforeCancelNotice({ deliver: true }).beforeCancel);
            const beforeCancelNotice = { beforeCancel };
            const ports = {
                provider: fixture.provider,
                clock: fixture.clock,
                beforeCancelNotice,
                payments: creditedPaymentsFromLedger,
                planPolicy: fixture.planPolicy,
                coverageNotices: fixture.coverageNotices
            };
            const runPauseCheck = async () =>
                createProviderPauseCheck(ports)(
                    await sweepInput(subscriptionId, fixture.provider, fixture.clock)
                );
            await runPauseCheck();
            expect((await subscriptionRow(subscriptionId)).status).toBe('ACTIVE');
            expect(cancel).not.toHaveBeenCalled();

            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ABANDONED' })
                .where(eq(subscriptions.id, successor.id));
            await runPauseCheck();
            expect((await subscriptionRow(subscriptionId)).status).toBe('SUSPENDED');
            const parent = await subscriptionRow(subscriptionId);
            expect(beforeCancel).toHaveBeenCalledWith(
                expect.objectContaining({
                    occurrenceId: providerPauseOnActiveOccurrenceId({
                        subscriptionId,
                        nextChargeAt: parent.nextChargeAt
                    })
                })
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — fifth event is guarded too (seeded row; succession cannot start from GRACE_PERIOD)',
        async () => {
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            const result = await suspendForArrears(
                {
                    subscriptionId: s.subscriptionId,
                    event: 'SUCCESSOR_PROVIDER_CANCELLED',
                    occurrenceId: successorProviderCancelledOccurrenceId({
                        subscriptionId: s.subscriptionId,
                        graceStartedAt: s.graceStartedAt
                    })
                },
                {
                    provider: s.fixture.provider,
                    clock: s.fixture.clock,
                    beforeCancelNotice: { beforeCancel: s.beforeCancel }
                }
            );
            expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'SUCCESSION_IN_PROGRESS' });
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — S19 retention guard runs before succession guard',
        async () => {
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            const recorded = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                s.chargePorts
            );
            expect(recorded).toMatchObject({ exit: { outcome: 'RETAINED_FOR_S19' } });
            const payment = await paymentFor(s.fixture.chargeId);
            expect(await retentionsOf(s.subscriptionId)).toMatchObject([
                { paymentId: payment.id, releasedAt: null }
            ]);
            expect(await s.runS6()).toEqual({
                outcome: 'NOT_APPLICABLE',
                reason: 'RETAINED_PAYMENT'
            });
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );
});
