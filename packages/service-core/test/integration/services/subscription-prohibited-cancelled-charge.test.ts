import { eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveSubscriptionSources } from '../../../src/services/billing/coverage/subscription-sources.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { noCreditedPayments } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { cancelActiveNow, unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    chargeOn,
    crossingClock,
    hungPaymentsOf,
    openMarksOf,
    recordOn,
    retireCancelCrossingRows,
    seedCrossingActive,
    seedCrossingDirect
} from './support/cancel-crossing-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { closeByS12, rowState } from './support/prohibited-transition-fixtures.js';

const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy read');
    },
    listing: async () => {
        throw new Error('unexpected addon listing read');
    }
};

async function seedAndCancel(transition: 'S12' | 'S23' | 'S24') {
    const { clock: mutableClock, setNow } = crossingClock(cancelActiveNow);
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: mutableClock,
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
                clock: mutableClock,
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
        return { fake, seeded, clock: mutableClock, setNow, cancelledAt: scheduled.serviceEndsAt };
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
            clock: mutableClock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood
        }
    );
    return { fake, seeded, clock: mutableClock, setNow, cancelledAt: cancelActiveNow };
}

afterEach(retireCancelCrossingRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8a:13 post-cancellation charges stay marked',
    () => {
        it.each([
            'S12',
            'S23',
            'S24'
        ] as const)('TEST:B8a:13 (c), %s: credits a later fact to the cancellation mark without reviving the row', async (transition) => {
            const {
                fake,
                seeded,
                clock: testClock,
                setNow,
                cancelledAt
            } = await seedAndCancel(transition);
            const before = await rowState(seeded.subscriptionId);
            const charge = await chargeOn({
                fake,
                authorizationId: seeded.authorizationId,
                at: new Date(cancelledAt.getTime() + 60 * 60 * 1000),
                setNow,
                reference: seeded.subscriptionId
            });
            const recorded = await recordOn({ fake, chargeId: charge.chargeId, clock: testClock });
            expect(recorded).toMatchObject({
                outcome: 'CREDITED',
                crossing: { outcome: 'MARKED' }
            });
            const after = await rowState(seeded.subscriptionId);
            expect(after.status).toBe('CANCELLED');
            expect(after.serviceEndsAt).toEqual(before.serviceEndsAt);
            const marks = (await openMarksOf(seeded.subscriptionId)).filter(
                (mark) => mark.reason === 'COBRO_POSTERIOR_A_LA_BAJA'
            );
            expect(marks).toHaveLength(1);
            expect(await hungPaymentsOf(marks[0]!.id)).toHaveLength(1);
            const [sourceRow] = await getServiceTestDb()
                .select({ userId: subscriptions.userId })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            const sources = await resolveSubscriptionSources({
                userId: sourceRow!.userId!,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock: testClock, payments: noCreditedPayments }
            });
            expect(sources.sources).toHaveLength(0);
        });
    }
);
