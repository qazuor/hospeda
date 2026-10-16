import { and, coverageLosses, emailOutbox, eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    arrearsPauseDecision,
    graceExpiredOccurrenceId,
    providerPauseObservedOccurrenceId,
    providerPauseOnActiveOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { providerPauseFixture } from './support/provider-pause-fixtures.js';
import { paymentFor } from './support/succession-retention-fixtures.js';
import { arrearsMails, row } from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: { readonly subscriptionIds: readonly string[]; readonly userId: string }[] = [];

afterEach(async () => {
    const cases = seeded.splice(0);
    for (const own of cases) {
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, own.userId));
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(eq(coverageLosses.userId, own.userId));
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, own.subscriptionIds[0] ?? ''));
    }
});

describe('HOS-1559 TEST:B7:6 AC:B7:9 — provider pause is S6 second event', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — ACTIVE paused without our PUT suspends and emits REMOVED after commit',
        async () => {
            const s = await providerPauseFixture();
            seeded.push(s.seeded);
            await s.pause();
            const suspendedAt = s.fixture.clock.now();

            await s.runSweepDay();

            expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(
                await s.provider.readAuthorization({
                    authorizationId: s.fixture.started.authorizationId
                })
            ).toMatchObject({ snapshot: { status: 'cancelled' } });
            expect(s.beforeCancel).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'ARREARS_SUSPENSION',
                    occurrenceId: providerPauseOnActiveOccurrenceId({
                        subscriptionId: s.subscriptionId,
                        nextChargeAt: s.subscription.nextChargeAt
                    })
                })
            );
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coverageLosses)
                    .where(
                        and(
                            eq(coverageLosses.userId, s.fixture.user.id),
                            eq(coverageLosses.vertical, 'accommodation')
                        )
                    )
            ).toHaveLength(1);
            expect(s.coverage).toEqual([
                {
                    event: {
                        userId: s.fixture.user.id,
                        vertical: 'accommodation',
                        sourceType: 'SUBSCRIPTION',
                        change: 'REMOVED'
                    },
                    statusCommitted: 'SUSPENDED'
                }
            ]);
            expect((await row(s.subscriptionId)).graceStartedAt).toEqual(suspendedAt);
            expect((await row(s.subscriptionId)).graceEndsAt).toEqual(suspendedAt);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId))
            ).toEqual([]);
            expect((await row(s.subscriptionId)).status).not.toBe('PAUSED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'a2 — NOT_YET_SENT defers; SENT next day dedupes the same occurrence',
        async () => {
            const s = await providerPauseFixture({ deliver: false });
            seeded.push(s.seeded);
            await s.pause();
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect(s.cancel).not.toHaveBeenCalled();
            s.setDeliver(true);
            s.fixture.clock.advance({ ms: 86_400_000 });
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — unexpired GRACE_PERIOD pause uses its grace occurrence and keeps the clock',
        async () => {
            const s = await providerPauseFixture({ grace: true });
            seeded.push(s.seeded);
            await s.pause();
            await s.runPauseCheck();
            const suspended = await row(s.subscriptionId);
            const graceStartedAt = s.subscription.graceStartedAt;
            if (graceStartedAt === null) throw new Error('Expected grace start');
            expect(suspended.status).toBe('SUSPENDED');
            expect(suspended.graceStartedAt).toEqual(s.subscription.graceStartedAt);
            expect(s.beforeCancel).toHaveBeenCalledWith(
                expect.objectContaining({
                    occurrenceId: providerPauseObservedOccurrenceId({
                        subscriptionId: s.subscriptionId,
                        graceStartedAt
                    })
                })
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — expired grace is taken only by GRACE_EXPIRED once',
        async () => {
            const s = await providerPauseFixture({ grace: true });
            seeded.push(s.seeded);
            await s.pause();
            const endsAt = s.subscription.graceEndsAt;
            if (!endsAt) throw new Error('Expected grace end');
            s.fixture.clock.advance({
                ms: endsAt.getTime() + 3_600_000 - s.fixture.clock.now().getTime()
            });
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(s.beforeCancel).not.toHaveBeenCalled();
            await s.runSweepDay();
            expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.beforeCancel).toHaveBeenCalledWith(
                expect.objectContaining({
                    occurrenceId: graceExpiredOccurrenceId({
                        subscriptionId: s.subscriptionId,
                        graceEndsAt: endsAt
                    })
                })
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — an authorized ACTIVE row does not read the period',
        async () => {
            const s = await providerPauseFixture();
            seeded.push(s.seeded);
            const listCharges = vi.spyOn(s.fixture.provider, 'listCharges');
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect(listCharges).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'h — MANUAL principal is not suspended by the provider pause sweep',
        async () => {
            const s = await providerPauseFixture();
            seeded.push(s.seeded);
            await getServiceTestDb()
                .update(subscriptions)
                .set({ paymentMethod: 'MANUAL' })
                .where(eq(subscriptions.id, s.subscriptionId));
            await s.pause();
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — a charged grace period runs S5 instead of S6',
        async () => {
            const s = await providerPauseFixture({ grace: true, approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.advanceToAttempt(2);
            await s.pause();
            await s.runSweepDay();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect((await row(s.subscriptionId)).graceStartedAt).toBeNull();
            expect((await paymentFor(s.failedChargeId ?? '')).status).toBe('SUCCEEDED');
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e2 — a charged ACTIVE period runs P1 instead of S6',
        async () => {
            const s = await providerPauseFixture({ activeApprovedCycle: true });
            seeded.push(s.seeded);
            s.advanceToAttempt(2);
            await s.pause();
            await s.runSweepDay();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect((await paymentFor(s.failedChargeId ?? '')).status).toBe('SUCCEEDED');
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — unreadable period leaves S6 for a later sweep',
        async () => {
            const s = await providerPauseFixture();
            seeded.push(s.seeded);
            await s.pause();
            vi.spyOn(s.fixture.provider, 'listCharges').mockRejectedValue(new Error('read failed'));
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect(s.cancel).not.toHaveBeenCalled();
            expect(s.beforeCancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'i — a charged back period is not charged for S6',
        async () => {
            const s = await providerPauseFixture({ grace: true, approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.advanceToAttempt(2);
            const chargeId = s.failedChargeId;
            if (!chargeId) throw new Error('Failed charge fixture missing charge id');
            const settled = await recordChargeFact({ chargeId }, s.ports);
            expect(settled.outcome).toBe('CREDITED');
            await s.fixture.provider.chargeBack({ chargeId });
            await s.pause();
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it('pure decision shares the grace-expiry occurrence when the clock is already due', async () => {
        const s = await providerPauseFixture({ grace: true });
        seeded.push(s.seeded);
        const due = arrearsPauseDecision({
            subscription: { ...s.subscription, graceEndsAt: new Date(0) },
            at: new Date()
        });
        expect(due?.event).toBe('GRACE_EXPIRED');
    });
});
