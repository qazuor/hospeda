import { subscriptionModel } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { reactivateFromGrace } from '../../../src/services/billing/subscription/exit-grace.service.js';
import { refuseUndeclaredSubscriptionTransition } from '../../../src/services/billing/subscription/refuse-undeclared-transition.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { cancelActiveNow, unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    retireCancelCrossingRows,
    seedCrossingActive
} from './support/cancel-crossing-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    closeByS12,
    rowState,
    transitionAttemptEvents,
    transitionMarksOf
} from './support/prohibited-transition-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const clock = { now: () => cancelActiveNow };

async function seedScheduled() {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M8', why: 'TEST:B8a:12 seeds S11 rows' }]
    });
    const seeded = await seedCrossingActive({ fake, payment: 'payment' });
    await cancelActiveSubscription(
        {
            actor: { id: seeded.userId, roles: [], permissions: [] },
            subscriptionId: seeded.subscriptionId
        },
        {
            provider: fake,
            clock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            complements: unusedComplementPolicy,
            coverageNotices: { emitCoverageChanged: async () => undefined }
        }
    );
    return { fake, seeded };
}

afterEach(retireCancelCrossingRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8a:12 CANCEL_SCHEDULED to ACTIVE is prohibited',
    () => {
        it('TEST:B8a:12 (a,b): refuses and accumulates the rule 1 mark without changing the row', async () => {
            const { seeded } = await seedScheduled();
            const before = await rowState(seeded.subscriptionId);
            const first = await refuseUndeclaredSubscriptionTransition({
                subscriptionId: seeded.subscriptionId,
                to: 'ACTIVE',
                attemptedBy: 'TEST:B8a:12',
                actor: { type: 'job' }
            });
            expect(first).toMatchObject({
                outcome: 'REFUSED',
                prohibition: 'PROH:B:1',
                from: 'CANCEL_SCHEDULED',
                to: 'ACTIVE',
                markOutcome: 'OPENED'
            });
            expect(await rowState(seeded.subscriptionId)).toEqual(before);
            const marks = await transitionMarksOf(seeded.subscriptionId);
            expect(marks.filter((mark) => mark.liftedAt === null)).toHaveLength(1);
            const opened = await transitionAttemptEvents(seeded.subscriptionId);
            const statusChange = (opened[0]?.changes ?? []).find(
                (change) => change.field === 'subscription.status'
            );
            expect(statusChange).toEqual({
                field: 'subscription.status',
                old: 'CANCEL_SCHEDULED',
                new: 'ACTIVE'
            });
            expect(opened[0]?.changes).toEqual(
                expect.arrayContaining([
                    { field: 'subscription.prohibition', new: 'PROH:B:1' },
                    { field: 'subscription.attempted_by', new: 'TEST:B8a:12' }
                ])
            );

            const second = await refuseUndeclaredSubscriptionTransition({
                subscriptionId: seeded.subscriptionId,
                to: 'ACTIVE',
                attemptedBy: 'TEST:B8a:12',
                actor: { type: 'job' }
            });
            expect(second).toMatchObject({ outcome: 'REFUSED', markOutcome: 'ACCUMULATED' });
            expect(
                second.outcome === 'REFUSED' && first.outcome === 'REFUSED' ? second.markId : null
            ).toBe(first.outcome === 'REFUSED' ? first.markId : null);
            expect(
                (await transitionMarksOf(seeded.subscriptionId)).filter(
                    (mark) => mark.liftedAt === null
                )
            ).toHaveLength(1);
            expect(await transitionAttemptEvents(seeded.subscriptionId)).toHaveLength(2);
        });

        it('TEST:B8a:12 (c): S2 refuses before reading the provider and opens the rule 1 mark', async () => {
            const { fake, seeded } = await seedScheduled();
            const before = await rowState(seeded.subscriptionId);
            const readAuthorization = vi.spyOn(fake, 'readAuthorization');
            const result = await activateSubscription(seeded.subscriptionId, {
                provider: fake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice(),
                touristVipInheritance: noTouristVip
            });
            expect(result).toEqual({ activated: false, subscriptionId: seeded.subscriptionId });
            expect(await rowState(seeded.subscriptionId)).toEqual(before);
            expect(readAuthorization).not.toHaveBeenCalled();
            const marks = await transitionMarksOf(seeded.subscriptionId);
            expect(marks.filter((mark) => mark.liftedAt === null)).toHaveLength(1);
            const attempts = await transitionAttemptEvents(seeded.subscriptionId);
            expect(attempts).toHaveLength(1);
            expect(attempts[0]?.actorType).toBe('provider');
            expect(attempts[0]?.changes).toEqual(
                expect.arrayContaining([{ field: 'subscription.attempted_by', new: 'S2' }])
            );
        });

        it('TEST:B8a:12 (d): existing ACTIVE writers keep their source-state guards', async () => {
            const { seeded } = await seedScheduled();
            const before = await rowState(seeded.subscriptionId);
            expect(
                await subscriptionModel.activatePendingAuthorization({
                    subscriptionId: seeded.subscriptionId,
                    now: clock.now()
                })
            ).toBe(false);
            expect(await rowState(seeded.subscriptionId)).toEqual(before);
            expect(
                await reactivateFromGrace({
                    subscriptionId: seeded.subscriptionId,
                    now: clock.now()
                })
            ).toBe(false);
            expect(await rowState(seeded.subscriptionId)).toEqual(before);
        });

        it('TEST:B8a:12 (e): a declared destination is observed without writing a mark', async () => {
            const { seeded } = await seedScheduled();
            const beforeCount = (await transitionMarksOf(seeded.subscriptionId)).length;
            const result = await refuseUndeclaredSubscriptionTransition({
                subscriptionId: seeded.subscriptionId,
                to: 'CANCELLED',
                attemptedBy: 'TEST:B8a:12',
                actor: { type: 'job' }
            });
            expect(result).toMatchObject({ outcome: 'NOT_PROHIBITED', from: 'CANCEL_SCHEDULED' });
            expect(await transitionMarksOf(seeded.subscriptionId)).toHaveLength(beforeCount);
        });

        it('TEST:B8a:12 (f): declared S12 still closes the scheduled row at service end', async () => {
            const { seeded } = await seedScheduled();
            const before = await rowState(seeded.subscriptionId);
            if (!before.serviceEndsAt) throw new Error('scheduled row has no service end');
            const result = await closeByS12({
                subscriptionId: seeded.subscriptionId,
                clock: { now: () => before.serviceEndsAt! },
                at: before.serviceEndsAt
            });
            expect(result.outcome).toBe('CANCELLED');
            expect((await rowState(seeded.subscriptionId)).status).toBe('CANCELLED');
        });

        it('TEST:B8a:12 (g): reports a missing seeded subscription', async () => {
            const subscriptionId = crypto.randomUUID();
            const result = await refuseUndeclaredSubscriptionTransition({
                subscriptionId,
                to: 'ACTIVE',
                attemptedBy: 'TEST:B8a:12',
                actor: { type: 'job' }
            });
            expect(result).toEqual({ outcome: 'NOT_FOUND', subscriptionId });
        });
    }
);
