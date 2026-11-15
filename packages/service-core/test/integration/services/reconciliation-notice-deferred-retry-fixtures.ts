import { providerLinks, reconciliationInventoryModel } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { vi } from 'vitest';
import type { ProviderCancellationTransition } from '../../../src/services/billing/reconciliation/provider-cancellation-decision.js';
import type { BeforeCancelNoticeStatus } from '../../../src/services/billing/reconciliation/sweep/before-cancel-notice-status.port.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from './helpers.js';
import {
    seedCancellationDecision,
    seedSubscription,
    trackSeededReconciliationRow
} from './reconciliation-sweep-fixtures.js';

/** Fixed clock shared by the fake provider and the deferred retry pass. */
export const retryNow = new Date('2029-04-10T12:00:00.000Z');
export const retryClock = { now: () => retryNow };

/** Creates a fake provider and mutable notice double for the seeded rows. */
export function deferredRetryHarness(existingFake?: FakePaymentProvider) {
    const fake =
        existingFake ??
        new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock: retryClock });
    const notices = new Map<string, BeforeCancelNoticeStatus>();
    const read = vi.fn(
        async ({ subscriptionId }: { subscriptionId: string; userId: string; kind: string }) =>
            notices.get(subscriptionId) ?? { state: 'ABSENT' as const, settledAgeMs: null }
    );
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => 'SENT');
    const cancel = vi.spyOn(fake, 'cancel');
    const ports = {
        provider: fake as unknown as PaymentProvider,
        clock: retryClock,
        beforeCancelNotice: { beforeCancel },
        noticeStatus: { read }
    };
    return { fake, notices, read, beforeCancel, cancel, ports };
}

/** Seeds one terminal, linked row with its recorded cancellation decision. */
export async function seedDeferredRetryRow(input: {
    readonly fake: FakePaymentProvider;
    readonly transition: ProviderCancellationTransition;
    readonly decidedAt?: Date;
    readonly pending?: boolean;
}) {
    const seeded = await seedSubscription({
        status: 'ABANDONED',
        withLink: !input.pending,
        fake: input.fake
    });
    let providerId = seeded.providerId;
    if (input.pending) {
        const auth = await input.fake.authorize({
            reference: seeded.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'deferred retry integration fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `payer-${crypto.randomUUID()}@example.test`
        });
        providerId = auth.authorizationId;
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: seeded.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId
        });
    }
    if (!providerId) throw new Error('Expected authorization');
    await seedCancellationDecision({
        subscriptionId: seeded.subscription.id,
        transition: input.transition,
        decidedAt: input.decidedAt ?? new Date(retryNow.getTime() - 120_000)
    });
    return { subscription: seeded.subscription, providerId };
}

/** Seeds a recipientless receipt tombstone in the retry inventory. */
export async function seedDeferredRetryTombstone() {
    const row = await getServiceTestDb().transaction(async (tx) => {
        const tombstone = await reconciliationInventoryModel.insertReceiptTombstone({ tx });
        await reconciliationInventoryModel.insertProviderLink({
            subscriptionId: tombstone.id,
            provider: 'MERCADO_PAGO',
            providerId: `tombstone-${crypto.randomUUID()}`,
            tx
        });
        return tombstone;
    });
    trackSeededReconciliationRow(row.id);
    await seedCancellationDecision({
        subscriptionId: row.id,
        transition: 'RECEPTION_TOMBSTONE',
        decidedAt: new Date(retryNow.getTime() - 120_000)
    });
    return row;
}
