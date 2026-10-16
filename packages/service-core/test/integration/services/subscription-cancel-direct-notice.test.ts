import { domainEventModel, emailOutbox, eq, providerLinks, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    retryOurCancellation,
    runOurCancellationRetry
} from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    trackSeededReconciliationRow,
    withSeededCancellationRetryInventory
} from './reconciliation-sweep-fixtures.js';
import {
    cancelActiveNow,
    seedCancelActive,
    unusedComplementPolicy
} from './support/cancel-active-fixtures.js';
import {
    retireCancelDirectRows,
    seedDirectCancellation
} from './support/cancel-direct-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const owner = (id: string): Actor => ({ id, roles: [], permissions: [] });
const clock = { now: () => cancelActiveNow };
const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy read');
    },
    listing: async () => {
        throw new Error('unexpected addon listing read');
    }
};
const acts = [
    { transition: 'S11', status: 'ACTIVE', template: 'billing.scheduled-cancellation' },
    { transition: 'S23', status: 'SUSPENDED', template: 'billing.direct-cancellation' },
    { transition: 'S24', status: 'GRACE_PERIOD', template: 'billing.direct-cancellation' }
] as const;

afterEach(retireCancelDirectRows);
afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

async function seedAct(act: (typeof acts)[number], fake: FakePaymentProvider) {
    if (act.transition === 'S11') return seedCancelActive({ fake, payment: 'payment' });
    return seedDirectCancellation({
        fake,
        status: act.status,
        preapproval: 'LIVE'
    });
}

async function invokeAct(
    act: (typeof acts)[number],
    seeded: Awaited<ReturnType<typeof seedAct>>,
    fake: FakePaymentProvider,
    beforeCancelNotice: ReturnType<typeof outboxBeforeCancelNotice>
) {
    if (act.transition === 'S11')
        return cancelActiveSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            {
                provider: fake,
                clock,
                beforeCancelNotice,
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: unusedComplementPolicy
            }
        );
    return cancelDirectSubscription(
        { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
        {
            provider: fake,
            clock,
            beforeCancelNotice,
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood
        }
    );
}

async function rowsFor(userId: string) {
    return getServiceTestDb()
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
}

async function assertNotice(act: (typeof acts)[number], userId: string, subscriptionId: string) {
    const rows = await rowsFor(userId);
    const owned = rows.filter(
        (row) => (row.payload as { subscriptionId?: string }).subscriptionId === subscriptionId
    );
    expect(owned).toHaveLength(1);
    expect(owned[0]).toMatchObject({
        template: act.template,
        payload: { subscriptionId }
    });
}

async function assertDecision(transition: string, subscriptionId: string) {
    const events = await domainEventModel.findByEntity({
        entityType: 'subscription',
        entityId: subscriptionId
    });
    expect(
        events.filter(
            (event) =>
                event.eventType === 'subscription.provider_cancellation_decided' &&
                event.reason === transition
        )
    ).toHaveLength(1);
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:2 correo antes de cancelar', () => {
    describe.each(acts)('$transition', (act) => {
        it('TEST:B8a:2 (a): defers on a transient notice failure and the next attempt cancels without a second notice', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedAct(act, fake);
            const cancel = vi.spyOn(fake, 'cancel');
            const pending = await invokeAct(act, seeded, fake, outboxBeforeCancelNotice());
            expect(pending).toMatchObject({
                outcome: act.transition === 'S11' ? 'SCHEDULED' : 'CANCELLED',
                cancelCall: 'NOTICE_PENDING'
            });
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.status).toBe(act.transition === 'S11' ? 'CANCEL_SCHEDULED' : 'CANCELLED');
            expect(
                cancel.mock.calls.filter(
                    ([call]) => call.authorizationId === seeded.authorizationId
                )
            ).toHaveLength(0);
            await assertDecision(act.transition, seeded.subscriptionId);
            await assertNotice(act, seeded.userId, seeded.subscriptionId);

            if (act.transition === 'S11') {
                const [subscription] = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.subscriptionId));
                const [providerLink] = await getServiceTestDb()
                    .select()
                    .from(providerLinks)
                    .where(eq(providerLinks.subscriptionId, seeded.subscriptionId));
                if (!subscription || !providerLink)
                    throw new Error('S11 retry row or provider link missing');
                const retried = await retryOurCancellation(
                    {
                        subscription,
                        providerLink,
                        decision: { transition: 'S11', decidedAt: cancelActiveNow },
                        correlationId: crypto.randomUUID()
                    },
                    {
                        provider: fake as unknown as PaymentProvider,
                        clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                    }
                );
                expect(retried.outcome).toBe('CONFIRMED');
            } else {
                trackSeededReconciliationRow(seeded.subscriptionId);
                const retried = await withSeededCancellationRetryInventory(() =>
                    runDirectRetry(fake)
                );
                expect(retried).toMatchObject({ confirmed: 1, rowsRead: 1, rowsFailed: 0 });
            }

            expect(
                cancel.mock.calls.filter(
                    ([call]) => call.authorizationId === seeded.authorizationId
                )
            ).toHaveLength(1);
            expect(
                (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                    .status
            ).toBe('cancelled');
            await assertNotice(act, seeded.userId, seeded.subscriptionId);
        });

        it('TEST:B8a:2 (b): cancels and escalates when the notice has no deliverable recipient', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedAct(act, fake);
            const cancel = vi.spyOn(fake, 'cancel');
            const result = await invokeAct(
                act,
                seeded,
                fake,
                outboxBeforeCancelNotice({ failWith: 'undeliverable:hard_bounce' })
            );
            expect(result).toMatchObject({
                cancelCall: 'SENT',
                escalated: 'NO_RECIPIENT'
            });
            expect(
                cancel.mock.calls.filter(
                    ([call]) => call.authorizationId === seeded.authorizationId
                )
            ).toHaveLength(1);
        });

        it('TEST:B8a:2 (c): cancels and escalates after definitive delivery exhaustion', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedAct(act, fake);
            const cancel = vi.spyOn(fake, 'cancel');
            const result = await invokeAct(
                act,
                seeded,
                fake,
                outboxBeforeCancelNotice({ failWith: 'delivery:exhausted' })
            );
            expect(result).toMatchObject({
                cancelCall: 'SENT',
                escalated: 'DELIVERY_EXHAUSTED'
            });
            expect(
                cancel.mock.calls.filter(
                    ([call]) => call.authorizationId === seeded.authorizationId
                )
            ).toHaveLength(1);
        });
    });
});

async function runDirectRetry(fake: FakePaymentProvider) {
    return runOurCancellationRetry(
        { correlationId: crypto.randomUUID(), pageSize: 50 },
        {
            provider: fake as unknown as PaymentProvider,
            clock,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
        }
    );
}
