import {
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    subscriptions
} from '@repo/db';
import { OwnSubscriptionsResponseSchema, PermissionEnum } from '@repo/schemas';
import {
    enqueuePaidAfterCancellationNotice,
    PAID_AFTER_CANCELLATION_TEMPLATE
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfState,
    seedUser
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const path = '/api/v1/protected/billing-subscription/';
let app: ReturnType<typeof initApp>;
const headers = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });
beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
});
afterEach(async () => {
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

async function readRow(ownerId: string, id: string) {
    const response = await app.request(path, { headers: headers(ownerId) });
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(OwnSubscriptionsResponseSchema.safeParse((body as { data: unknown }).data).success).toBe(
        true
    );
    return (
        body as { data: { subscriptions: Array<Record<string, unknown>> } }
    ).data.subscriptions.find((row) => row.id === id)!;
}

async function markWithRealHelper(id: string, recurringAddonsCut: boolean) {
    await getDb().transaction(async (tx) => {
        const [subscription] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, id));
        if (!subscription?.serviceEndsAt) throw new Error('Expected fixture service end');
        await enqueuePaidAfterCancellationNotice({
            tx,
            subscription,
            serviceEndsAt: subscription.serviceEndsAt,
            recurringAddonsCut
        });
    });
}

describe('TEST:1623:8 paid-after-cancellation mark in own list', () => {
    it.each([true, false])('returns the helper mark with recurringAddonsCut=%s', async (cut) => {
        const row = await seedSelfState('CANCEL_SCHEDULED');
        await markWithRealHelper(row.subscriptionId, cut);
        const listed = await readRow(row.ownerId, row.subscriptionId);
        expect(listed.paidAfterCancellation).toEqual({ recurringAddonsCut: cut });
        expect(listed.serviceEndsAt).toBe('2026-11-05T12:00:00.000Z');
    });
    it('uses the live subscription column date and ignores a mark on ACTIVE', async () => {
        const row = await seedSelfState('CANCEL_SCHEDULED');
        await markWithRealHelper(row.subscriptionId, true);
        await getDb()
            .update(emailOutbox)
            .set({
                payload: {
                    subscriptionId: row.subscriptionId,
                    recurringAddonsCut: true,
                    serviceEndsAt: '2030-01-01T00:00:00.000Z'
                }
            })
            .where(
                and(
                    eq(emailOutbox.recipientUserId, row.ownerId),
                    eq(emailOutbox.template, PAID_AFTER_CANCELLATION_TEMPLATE)
                )
            );
        const listed = await readRow(row.ownerId, row.subscriptionId);
        expect(listed.serviceEndsAt).toBe('2026-11-05T12:00:00.000Z');
        expect(listed.paidAfterCancellation).toEqual({ recurringAddonsCut: true });
        const active = await seedSelfState('ACTIVE');
        await getDb()
            .update(subscriptions)
            .set({ serviceEndsAt: new Date('2026-11-05T12:00:00.000Z') })
            .where(eq(subscriptions.id, active.subscriptionId));
        await markWithRealHelper(active.subscriptionId, true);
        expect(
            (await readRow(active.ownerId, active.subscriptionId)).paidAfterCancellation
        ).toBeNull();
    });
    it('returns null for owner cancellation and a mark addressed to another recipient', async () => {
        const own = await seedSelfState('CANCEL_SCHEDULED');
        expect((await readRow(own.ownerId, own.subscriptionId)).paidAfterCancellation).toBeNull();
        const foreign = await seedSelfState('CANCEL_SCHEDULED');
        const otherOwner = await seedUser('other-paid-after-cancellation-recipient');
        const template = PAID_AFTER_CANCELLATION_TEMPLATE;
        await emailOutboxModel.enqueue({
            recipientUserId: otherOwner,
            recipientEmail: `other-${crypto.randomUUID()}@example.test`,
            template,
            payload: { subscriptionId: foreign.subscriptionId, recurringAddonsCut: true },
            dedupKey: buildEmailDedupKey({
                recipient: otherOwner,
                template,
                occurrence: buildEventOccurrence({ eventId: foreign.subscriptionId })
            })
        });
        expect(
            (await readRow(foreign.ownerId, foreign.subscriptionId)).paidAfterCancellation
        ).toBeNull();
    });
});
