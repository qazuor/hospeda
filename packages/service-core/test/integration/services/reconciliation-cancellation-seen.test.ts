/** TEST:B11:26 — reconciliation records authorization observations through B4. */
import { eq, inArray, providerLinks, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import type { CancellationSeenAnnotator } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedCancellationDecision,
    seedSubscription,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const ids: string[] = [];
const t0 = new Date('2026-10-01T00:00:00.000Z');
afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
afterEach(async () => {
    if (ids.length) {
        const db = getServiceTestDb();
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, ids));
        ids.length = 0;
    }
});

async function liveRow(
    fake: ReturnType<typeof createReconciliationFake>['fake'],
    seen: Date | null = null
) {
    const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
    ids.push(seeded.subscription.id);
    if (seen)
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: seen })
            .where(eq(providerLinks.subscriptionId, seeded.subscription.id));
    return seeded;
}
async function run(
    fake: ReturnType<typeof createReconciliationFake>['fake'],
    cancellationSeen: CancellationSeenAnnotator | null = providerLinkCancellationSeen,
    retry = false
) {
    return withSeededReconciliationInventory(() =>
        withSeededCancellationRetryInventory(() =>
            runReconciliationSweep(
                {},
                {
                    provider: fake as unknown as PaymentProvider,
                    clock: reconciliationClock,
                    ...(cancellationSeen ? { cancellationSeen } : {}),
                    ...(retry
                        ? { cancellationRetry: { beforeCancelNotice: outboxBeforeCancelNotice() } }
                        : {})
                }
            )
        )
    );
}
async function seen(id: string) {
    const [row] = await getServiceTestDb()
        .select({ at: providerLinks.cancelledSeenAt })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, id));
    return row?.at;
}

describe('TEST:B11:26 sweep cancellation observation', () => {
    it('(a) stores the re-read instant for a cancelled authorization with an empty column', async () => {
        const { fake } = createReconciliationFake();
        const row = await liveRow(fake);
        await fake.cancel({ authorizationId: row.providerId! });
        await run(fake);
        expect(await seen(row.subscription.id)).toEqual(reconciliationClock.now());
    });

    it('(b) preserves an earlier instant when the sweep sees cancelled later', async () => {
        const { fake } = createReconciliationFake();
        const row = await liveRow(fake, t0);
        await fake.cancel({ authorizationId: row.providerId! });
        await run(fake);
        expect(await seen(row.subscription.id)).toEqual(t0);
    });

    it('(c) clears an earlier instant for a live read and makes no call for an empty one', async () => {
        const { fake } = createReconciliationFake();
        const earlier = await liveRow(fake, t0);
        const empty = await liveRow(fake);
        const annotate = vi.spyOn(providerLinkCancellationSeen, 'clearCancellationSeen');
        await run(fake);
        expect(await seen(earlier.subscription.id)).toBeNull();
        expect(await seen(empty.subscription.id)).toBeNull();
        expect(annotate).toHaveBeenCalledTimes(1);
        expect(annotate).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: earlier.subscription.id })
        );
    });

    it('(e) a throwing annotator does not fail the row or stop later observations', async () => {
        const { fake } = createReconciliationFake();
        const rows = [await liveRow(fake), await liveRow(fake)];
        for (const row of rows) await fake.cancel({ authorizationId: row.providerId! });
        let calls = 0;
        let successfullyAnnotated: string | undefined;
        const annotator = {
            annotateCancellationSeen: async (input: { readonly subscriptionId: string }) => {
                calls++;
                if (calls === 1) throw new Error('write failed');
                successfullyAnnotated = input.subscriptionId;
                await providerLinkCancellationSeen.annotateCancellationSeen({
                    subscriptionId: input.subscriptionId,
                    seenAt: reconciliationClock.now()
                });
            },
            clearCancellationSeen: async () => undefined
        };
        const summary = await run(fake, annotator);
        expect(summary.rowsFailed).toBe(0);
        expect(calls).toBe(2);
        expect(successfullyAnnotated).toBeDefined();
        expect(await seen(successfullyAnnotated!)).toEqual(reconciliationClock.now());
    });

    it('(d) annotates a terminal own read and annotates a live-loop read only once', async () => {
        const { fake } = createReconciliationFake();
        const terminal = await seedSubscription({ status: 'CANCELLED', withLink: true, fake });
        const scheduled = await seedSubscription({
            status: 'CANCEL_SCHEDULED',
            withLink: true,
            fake
        });
        ids.push(terminal.subscription.id, scheduled.subscription.id);
        await seedCancellationDecision({
            subscriptionId: terminal.subscription.id,
            transition: 'S12',
            decidedAt: t0
        });
        await seedCancellationDecision({
            subscriptionId: scheduled.subscription.id,
            transition: 'S11',
            decidedAt: t0
        });
        await fake.cancel({ authorizationId: terminal.providerId! });
        await fake.cancel({ authorizationId: scheduled.providerId! });
        const annotate = vi.spyOn(providerLinkCancellationSeen, 'annotateCancellationSeen');
        await run(fake, providerLinkCancellationSeen, true);
        expect(await seen(terminal.subscription.id)).toEqual(reconciliationClock.now());
        expect(await seen(scheduled.subscription.id)).toEqual(reconciliationClock.now());
        expect(
            annotate.mock.calls.filter(
                ([input]) => input.subscriptionId === scheduled.subscription.id
            )
        ).toHaveLength(1);
    });

    it('(f) omitting the port leaves the column unchanged', async () => {
        const { fake } = createReconciliationFake();
        const row = await liveRow(fake);
        await fake.cancel({ authorizationId: row.providerId! });
        await run(fake, null);
        expect(await seen(row.subscription.id)).toBeNull();
    });
});
