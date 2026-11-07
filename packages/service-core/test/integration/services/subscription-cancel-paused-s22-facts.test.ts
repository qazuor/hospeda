import { eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { CancellationReasonEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { BillingFact } from '../../../src/services/billing/facts/billing-fact-sink.js';
import { cancelPausedSubscription } from '../../../src/services/billing/subscription/cancel-paused-subscription.service.js';
import { previewSubscriptionCancellation } from '../../../src/services/billing/subscription/cancellation-preview.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    pausedNow,
    retirePausedCancellationRows,
    seedPausedCancellation
} from './support/cancel-paused-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const clock = { now: () => pausedNow };
const owner = (id: string) => ({ id, roles: [], permissions: [] });
const fakeProvider = () => new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
const ports = (provider: FakePaymentProvider) => ({
    provider,
    clock,
    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
    coverageNotices: { emitCoverageChanged: async () => undefined },
    orphanhood: {
        addonPolicy: async () => {
            throw new Error('unexpected addon policy read');
        },
        listing: async () => {
            throw new Error('unexpected addon listing read');
        }
    },
    complements: unusedComplementPolicy
});

afterEach(retirePausedCancellationRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:25 S22 committed analytics facts', () => {
    it('emits the complete DIRECT_FROM_PAUSED fact for a direct cancellation', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({ fake });
        const facts: BillingFact[] = [];
        const result = await cancelPausedSubscription(
            {
                actor: owner(seeded.userId),
                subscriptionId: seeded.subscriptionId,
                reason: CancellationReasonEnum.TOO_EXPENSIVE
            },
            {
                ...ports(fake),
                billingFacts: {
                    emit: (fact) => {
                        facts.push(fact);
                    }
                }
            }
        );
        expect(result.outcome).toBe('CANCELLED');
        expect(facts).toEqual([
            {
                kind: 'SUBSCRIPTION_CANCELLED',
                userId: seeded.userId,
                vertical: 'accommodation',
                subscriptionId: seeded.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'USER',
                occurredAt: pausedNow,
                cancelledBy: 'USER',
                path: 'DIRECT_FROM_PAUSED',
                wasScheduled: false,
                reason: 'TOO_EXPENSIVE'
            }
        ]);
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCELLED');
    });

    it('emits CANCEL_SCHEDULED on CREDIT and keeps the same outcome without a sink', async () => {
        const facts: BillingFact[] = [];
        const firstChargeAt = new Date('2026-12-01T00:00:00.000Z');
        const firstFake = fakeProvider();
        const first = await seedPausedCancellation({
            fake: firstFake,
            reason: 'COURTESY',
            credit: {
                firstChargeAt,
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        const preview = await previewSubscriptionCancellation(
            { actor: owner(first.userId), subscriptionId: first.subscriptionId },
            { clock, complements: unusedComplementPolicy }
        );
        expect(preview).toMatchObject({
            origin: 'PAUSED',
            serviceEndsAt: firstChargeAt.toISOString(),
            basis: 'CREDIT',
            courtesyMonthsLost: 2
        });
        const withSink = await cancelPausedSubscription(
            { actor: owner(first.userId), subscriptionId: first.subscriptionId },
            {
                ...ports(firstFake),
                billingFacts: {
                    emit: (fact) => {
                        facts.push(fact);
                    }
                }
            }
        );
        expect(withSink).toMatchObject({
            outcome: 'SCHEDULED',
            basis: 'CREDIT',
            serviceEndsAt: firstChargeAt
        });
        expect(facts).toEqual([
            {
                kind: 'CANCEL_SCHEDULED',
                userId: first.userId,
                vertical: 'accommodation',
                subscriptionId: first.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'USER',
                occurredAt: pausedNow,
                serviceEndsAt: firstChargeAt,
                basis: 'CREDIT'
            }
        ]);
        const secondFake = fakeProvider();
        const second = await seedPausedCancellation({
            fake: secondFake,
            reason: 'COURTESY',
            credit: {
                firstChargeAt,
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        const withoutSink = await cancelPausedSubscription(
            { actor: owner(second.userId), subscriptionId: second.subscriptionId },
            ports(secondFake)
        );
        expect(withoutSink).toMatchObject({
            outcome: 'SCHEDULED',
            basis: 'CREDIT',
            serviceEndsAt: firstChargeAt
        });
        expect(facts).toHaveLength(1);
    });
});
