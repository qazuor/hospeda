import type { Clock } from '@repo/billing-verticals-contract';
import { eq, providerLinks, reconciliationMarkModel, subscriptions } from '@repo/db';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNextChargeSync } from '../../../src/services/billing/reconciliation/sweep/next-charge-sync.js';
import type { ReconciliationRowCheck } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { sendRenewalNotices } from '../../../src/services/billing/subscription/send-renewal-notices.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    clearRenewalOutbox,
    readNextChargeAt,
    readSubscriptionUpdatedAt,
    reconciliationCurrentDeadlines,
    renewalRows
} from './support/next-charge-sync-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];

function track(row: {
    readonly subscription: { readonly id: string; readonly userId: string | null };
}): void {
    if (!row.subscription.userId) throw new Error('Fixture subscription has no user');
    owned.push({ subscriptionId: row.subscription.id, userId: row.subscription.userId });
}

async function sweep(
    provider: ReturnType<typeof createReconciliationFake>['provider'],
    rowCheck: ReconciliationRowCheck = createNextChargeSync(),
    clock: Clock = reconciliationClock
) {
    return withSeededReconciliationInventory(() =>
        runReconciliationSweep(
            {},
            {
                provider,
                clock,
                rowChecks: [rowCheck]
            }
        )
    );
}

async function linkedActive(options: { class?: 'PRINCIPAL' | 'COMPLEMENTO' } = {}) {
    const { fake, provider } = createReconciliationFake();
    const seeded = await seedSubscription({
        status: 'ACTIVE',
        class: options.class,
        withLink: true,
        fake
    });
    track(seeded);
    if (!seeded.providerId) throw new Error('Provider fixture has no authorization id');
    const read = await fake.readAuthorization({ authorizationId: seeded.providerId });
    if (read.snapshot.nextChargeAt === null)
        throw new Error('Approved fake has no next charge date');
    return {
        ...seeded,
        fake,
        provider,
        providerId: seeded.providerId,
        providerDate: read.snapshot.nextChargeAt
    };
}

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        for (const mark of await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        })) {
            await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: row.userId,
                now: new Date()
            });
        }
        await clearRenewalOutbox(row.userId);
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.subscriptionId));
        await db
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
});

describe('TEST:1685:4 the sweep copies the provider next payment date', () => {
    it('copies the approved provider date onto an ACTIVE CARD PRINCIPAL without divergence or marks', async () => {
        const row = await linkedActive();
        const summary = await sweep(row.provider);
        expect(await readNextChargeAt(row.subscription.id)).toEqual(new Date(row.providerDate));
        expect(summary).toMatchObject({ rowsFailed: 0, divergences: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
            })
        ).toEqual([]);
    });

    it('copies a future provider date that was moved before the sweep', async () => {
        const row = await linkedActive();
        const moved = new Date('2026-10-20T15:00:00.000Z');
        row.fake.moveNextCharge({ authorizationId: row.providerId, at: moved });
        const summary = await sweep(row.provider);
        expect(await readNextChargeAt(row.subscription.id)).toEqual(moved);
        expect(summary).toMatchObject({ rowsFailed: 0, divergences: 0 });
    });

    it('updates after a provider move and leaves updated_at untouched on an unchanged third run', async () => {
        let instant = new Date('2026-10-11T12:00:00.000Z');
        const clock = { now: () => new Date(instant) };
        const { fake, provider } = createReconciliationFake(clock);
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        track(seeded);
        if (!seeded.providerId) throw new Error('Provider fixture has no authorization id');
        await sweep(provider, createNextChargeSync(), clock);
        const firstMove = new Date('2026-10-18T15:00:00.000Z');
        fake.moveNextCharge({ authorizationId: seeded.providerId, at: firstMove });
        instant = new Date(instant.getTime() + 1_000);
        await sweep(provider, createNextChargeSync(), clock);
        expect(await readNextChargeAt(seeded.subscription.id)).toEqual(firstMove);
        const before = await readSubscriptionUpdatedAt(seeded.subscription.id);
        instant = new Date(instant.getTime() + 1_000);
        await sweep(provider, createNextChargeSync(), clock);
        expect(await readSubscriptionUpdatedAt(seeded.subscription.id)).toEqual(before);
    });

    it.each([
        'paused',
        'cancelled'
    ] as const)('preserves the previous date when provider is %s', async (state) => {
        const row = await linkedActive();
        const previous = new Date('2026-10-25T15:00:00.000Z');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ nextChargeAt: previous })
            .where(eq(subscriptions.id, row.subscription.id));
        if (state === 'paused') await row.fake.pause({ authorizationId: row.providerId });
        else await row.fake.cancel({ authorizationId: row.providerId });
        await sweep(row.provider);
        expect(await readNextChargeAt(row.subscription.id)).toEqual(previous);
    });

    it.each([
        'GRACE_PERIOD',
        'SUSPENDED',
        'CANCEL_SCHEDULED'
    ] as const)('does not write a %s row when the provider is active', async (status) => {
        const { fake, provider } = createReconciliationFake();
        const row = await seedSubscription({ status, withLink: true, fake });
        track(row);
        const sync = vi.fn(async () => true);
        await sweep(provider, createNextChargeSync({ sync }));
        expect(sync).not.toHaveBeenCalled();
        expect(await readNextChargeAt(row.subscription.id)).toBeNull();
    });

    it('copies the provider date for an ACTIVE CARD COMPLEMENTO', async () => {
        const row = await linkedActive({ class: 'COMPLEMENTO' });
        await sweep(row.provider);
        expect(await readNextChargeAt(row.subscription.id)).toEqual(new Date(row.providerDate));
    });

    it('TEST:1685:5 enqueues a new renewal notice for each provider date after the sweep', async () => {
        const row = await linkedActive();
        const firstDate = new Date('2026-10-16T15:00:00.000Z');
        row.fake.moveNextCharge({ authorizationId: row.providerId, at: firstDate });
        await sweep(row.provider);
        const send = () =>
            sendRenewalNotices(
                { limit: 50 },
                {
                    clock: reconciliationClock,
                    readCurrentDeadlines: async () => reconciliationCurrentDeadlines()
                }
            );
        const firstResult = await send();
        expect(
            firstResult.rows.filter((item) => item.subscriptionId === row.subscription.id)
        ).toHaveLength(1);
        expect(await renewalRows(row.subscription.id)).toHaveLength(1);

        const secondDate = new Date('2026-10-15T15:00:00.000Z');
        row.fake.moveNextCharge({ authorizationId: row.providerId, at: secondDate });
        await sweep(row.provider);
        const secondResult = await send();
        expect(
            secondResult.rows.filter((item) => item.subscriptionId === row.subscription.id)
        ).toHaveLength(1);
        const rows = await renewalRows(row.subscription.id);
        expect(rows).toHaveLength(2);
        expect(rows.some((item) => item.payload.renewalDate === '2026-10-16')).toBe(true);
        expect(rows.some((item) => item.payload.renewalDate === '2026-10-15')).toBe(true);
    });
});
