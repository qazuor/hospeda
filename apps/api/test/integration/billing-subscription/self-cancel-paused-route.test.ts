import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { PermissionEnum, SubscriptionCancellationPreviewResponseSchema } from '@repo/schemas';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfActive
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const pauseIds: string[] = [];
let app: ReturnType<typeof initApp>;
const headers = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });
const previewUrl = (id: string) =>
    `/api/v1/protected/billing-subscription/${id}/cancellation-preview`;
const actUrl = (id: string) => `/api/v1/protected/billing-subscription/${id}/cancellation`;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
afterEach(async () => {
    for (const id of pauseIds.splice(0))
        await getDb().delete(subscriptionPauses).where(eq(subscriptionPauses.subscriptionId, id));
    await retireSelfCancelRows();
});
afterAll(async () => {
    await testDb.teardown();
});

async function paused(reason: 'CUSTOMER_REQUEST' | 'COURTESY') {
    clock.set(NOW);
    const seeded = await seedSelfActive(fake, clock);
    await getDb()
        .update(subscriptions)
        .set({ status: 'PAUSED' })
        .where(eq(subscriptions.id, seeded.subscriptionId));
    await getDb()
        .insert(subscriptionPauses)
        .values({
            subscriptionId: seeded.subscriptionId,
            reason,
            requestedMonths: 2,
            startsAt: new Date('2026-10-01T12:00:00.000Z'),
            expectedEndAt: new Date('2026-12-01T12:00:00.000Z')
        });
    pauseIds.push(seeded.subscriptionId);
    return seeded;
}

describe('TEST:B8b:25 self-service S22 route', () => {
    it('cancels a PAUSED principal through the provider fake and persists CANCELLED', async () => {
        const seeded = await paused('CUSTOMER_REQUEST');
        const dedupKey = buildEmailDedupKey({
            recipient: seeded.ownerId,
            template: BEFORE_CANCEL_TEMPLATE_BY_KIND.DIRECT_CANCELLATION,
            occurrence: buildEventOccurrence({ eventId: seeded.subscriptionId })
        });
        await emailOutboxModel.enqueue({
            recipientUserId: seeded.ownerId,
            recipientEmail: `s22-${crypto.randomUUID()}@example.test`,
            template: BEFORE_CANCEL_TEMPLATE_BY_KIND.DIRECT_CANCELLATION,
            payload: { subscriptionId: seeded.subscriptionId },
            dedupKey
        });
        await getDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.dedupKey, dedupKey));
        const response = await app.request(actUrl(seeded.subscriptionId), {
            method: 'POST',
            headers: headers(seeded.ownerId)
        });
        expect(response.status).toBe(200);
        expect(((await response.json()) as { data: unknown }).data).toMatchObject({
            subscriptionId: seeded.subscriptionId,
            outcome: 'CANCELLED',
            serviceEndsAt: expect.any(String)
        });
        const [row] = await getDb()
            .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCELLED');
        expect(row?.serviceEndsAt?.toISOString().slice(0, 10)).toBe('2026-10-05');
        const provider = await fake.readAuthorization({ authorizationId: seeded.authorizationId });
        expect(provider.snapshot.status).toBe('cancelled');
    });

    it('previews a PAUSED COURTESY with the exact lost months and current end', async () => {
        const seeded = await paused('COURTESY');
        const response = await app.request(previewUrl(seeded.subscriptionId), {
            headers: headers(seeded.ownerId)
        });
        expect(response.status).toBe(200);
        const preview = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await response.json()) as { data: unknown }).data
        );
        expect(preview).toMatchObject({
            subscriptionId: seeded.subscriptionId,
            origin: 'PAUSED',
            serviceEndsAt: expect.any(String),
            basis: 'NOW',
            courtesyMonthsLost: 2,
            addons: []
        });
        if (preview.origin !== 'PAUSED') throw new Error('Expected paused preview');
        expect(preview.serviceEndsAt.slice(0, 10)).toBe('2026-10-05');
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('PAUSED');
    });
});
