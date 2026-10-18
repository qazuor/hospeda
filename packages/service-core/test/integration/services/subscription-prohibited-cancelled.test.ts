import { SUBSCRIPTION_STATUSES } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { refuseUndeclaredSubscriptionTransition } from '../../../src/services/billing/subscription/refuse-undeclared-transition.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { cancelActiveNow, unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    retireCancelCrossingRows,
    seedCrossingActive,
    seedCrossingDirect
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
const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy read');
    },
    listing: async () => {
        throw new Error('unexpected addon listing read');
    }
};
const destinations = SUBSCRIPTION_STATUSES.filter((status) => status !== 'CANCELLED');

async function seedCancelled(transition: 'S12' | 'S23' | 'S24') {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M8', why: 'TEST:B8a:13 charges an authorization after cancellation' }]
    });
    if (transition === 'S12') {
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
        const scheduled = await rowState(seeded.subscriptionId);
        if (!scheduled.serviceEndsAt) throw new Error('S11 row has no service end');
        await closeByS12({
            subscriptionId: seeded.subscriptionId,
            clock: { now: () => scheduled.serviceEndsAt! },
            at: scheduled.serviceEndsAt
        });
        return { fake, seeded };
    }

    const seeded = await seedCrossingDirect({
        fake,
        status: transition === 'S23' ? 'SUSPENDED' : 'GRACE_PERIOD',
        preapproval: 'LIVE'
    });
    await cancelDirectSubscription(
        {
            actor: { id: seeded.userId, roles: [], permissions: [] },
            subscriptionId: seeded.subscriptionId
        },
        {
            provider: fake,
            clock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood
        }
    );
    return { fake, seeded };
}

afterEach(retireCancelCrossingRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:13 CANCELLED rows never revive', () => {
    describe.each(['S12', 'S23', 'S24'] as const)('%s cancellation', (transition) => {
        it(`TEST:B8a:13 (a), ${transition}: refuses every destination and accumulates one mark`, async () => {
            const { seeded } = await seedCancelled(transition);
            const before = await rowState(seeded.subscriptionId);
            const results = [];
            for (const to of destinations) {
                results.push(
                    await refuseUndeclaredSubscriptionTransition({
                        subscriptionId: seeded.subscriptionId,
                        to,
                        attemptedBy: `TEST:B8a:13:${transition}`,
                        actor: { type: 'job' }
                    })
                );
            }
            expect(results.map((result) => result.outcome)).toEqual(
                destinations.map(() => 'REFUSED')
            );
            expect(
                results.map((result) => result.outcome === 'REFUSED' && result.prohibition)
            ).toEqual(destinations.map(() => 'PROH:B:2'));
            expect(
                results.map((result) => result.outcome === 'REFUSED' && result.markOutcome)
            ).toEqual(['OPENED', ...destinations.slice(1).map(() => 'ACCUMULATED')]);
            const markIds = results.flatMap((result) =>
                result.outcome === 'REFUSED' ? [result.markId] : []
            );
            expect(new Set(markIds).size).toBe(1);
            expect(await rowState(seeded.subscriptionId)).toEqual(before);
            expect(
                (await transitionMarksOf(seeded.subscriptionId)).filter(
                    (mark) => mark.liftedAt === null
                )
            ).toHaveLength(1);
            const events = await transitionAttemptEvents(seeded.subscriptionId);
            const eventDestinations = events
                .map(
                    (event) =>
                        (event.changes ?? []).find(
                            (change) => change.field === 'subscription.status'
                        )?.new
                )
                .sort();
            expect(eventDestinations).toEqual([...destinations].sort());
        });

        it(`TEST:B8a:13 (b), ${transition}: S2 does not activate a cancelled row`, async () => {
            const { fake, seeded } = await seedCancelled(transition);
            expect(
                await activateSubscription(seeded.subscriptionId, {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    touristVipInheritance: noTouristVip
                })
            ).toEqual({ activated: false, subscriptionId: seeded.subscriptionId });
            expect((await rowState(seeded.subscriptionId)).status).toBe('CANCELLED');
        });
    });
});
