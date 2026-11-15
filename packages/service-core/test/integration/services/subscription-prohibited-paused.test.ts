import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { refuseUndeclaredSubscriptionTransition } from '../../../src/services/billing/subscription/refuse-undeclared-transition.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    pausedNow,
    retirePausedCancellationRows,
    seedPausedCancellation
} from './support/cancel-paused-fixtures.js';
import {
    rowState,
    transitionAttemptEvents,
    transitionMarksOf
} from './support/prohibited-transition-fixtures.js';

const fakeProvider = () =>
    new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock: { now: () => pausedNow } });
const attempt = (
    subscriptionId: string,
    to: 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCEL_SCHEDULED' | 'ACTIVE' | 'CANCELLED',
    exception?: 'S6_CHARGEBACK_ON_COURTESY' | 'S22_UNCONSUMED_CREDIT'
) =>
    refuseUndeclaredSubscriptionTransition({
        subscriptionId,
        to,
        attemptedBy: 'TEST:B8b:6',
        actor: { type: 'job' },
        ...(exception ? { exception } : {})
    });

afterEach(retirePausedCancellationRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:6 PROH:B:4 paused destinations', () => {
    it.each([
        'GRACE_PERIOD',
        'SUSPENDED',
        'CANCEL_SCHEDULED'
    ] as const)('refuses PAUSED to %s and preserves the seeded row with rule 1 detail', async (to) => {
        const seeded = await seedPausedCancellation({ fake: fakeProvider() });
        const before = await rowState(seeded.subscriptionId);
        const result = await attempt(seeded.subscriptionId, to);
        expect(result).toMatchObject({
            outcome: 'REFUSED',
            prohibition: 'PROH:B:4',
            from: 'PAUSED',
            to
        });
        expect(await rowState(seeded.subscriptionId)).toEqual(before);
        const marks = await transitionMarksOf(seeded.subscriptionId);
        expect(marks).toHaveLength(1);
        const events = await transitionAttemptEvents(seeded.subscriptionId);
        expect(events).toHaveLength(1);
        expect(events[0]?.changes).toEqual(
            expect.arrayContaining([
                { field: 'subscription.status', old: 'PAUSED', new: to },
                { field: 'subscription.prohibition', new: 'PROH:B:4' },
                { field: 'subscription.attempted_by', new: 'TEST:B8b:6' }
            ])
        );
    });

    it.each(['ACTIVE', 'CANCELLED'] as const)('observes PAUSED to %s as permitted', async (to) => {
        const seeded = await seedPausedCancellation({ fake: fakeProvider() });
        expect(await attempt(seeded.subscriptionId, to)).toMatchObject({
            outcome: 'NOT_PROHIBITED'
        });
    });

    it('permits S22 credit only for PAUSED to CANCEL_SCHEDULED (real writer: TEST:B8b:5 c)', async () => {
        const seeded = await seedPausedCancellation({ fake: fakeProvider() });
        expect(
            await attempt(seeded.subscriptionId, 'CANCEL_SCHEDULED', 'S22_UNCONSUMED_CREDIT')
        ).toMatchObject({ outcome: 'NOT_PROHIBITED' });
        expect(
            await attempt(seeded.subscriptionId, 'SUSPENDED', 'S22_UNCONSUMED_CREDIT')
        ).toMatchObject({ outcome: 'REFUSED', prohibition: 'PROH:B:4' });
    });

    it('permits S6 courtesy chargeback in the catalog; S6 writer remains pending (D-4)', async () => {
        const seeded = await seedPausedCancellation({ fake: fakeProvider(), reason: 'COURTESY' });
        expect(
            await attempt(seeded.subscriptionId, 'SUSPENDED', 'S6_CHARGEBACK_ON_COURTESY')
        ).toMatchObject({ outcome: 'NOT_PROHIBITED' });
        expect(await rowState(seeded.subscriptionId)).toMatchObject({ status: 'PAUSED' });
    });
});
