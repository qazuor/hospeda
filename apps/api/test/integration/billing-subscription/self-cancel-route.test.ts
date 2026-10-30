import { domainEventModel, eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { PermissionEnum, SubscriptionCancellationResponseSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    presetSelfCancelNotice,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfActive,
    seedSelfDirectCard,
    seedSelfState
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
const pathOf = (id: string) => `/api/v1/protected/billing-subscription/${id}/cancellation`;
const previewPathOf = (id: string) =>
    `/api/v1/protected/billing-subscription/${id}/cancellation-preview`;
const ownerHeaders = (id: string) => actorHeaders({ id, role: 'USER', permissions: [] });
const ownerReadHeaders = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });
const post = (id: string, headers: Record<string, string>) =>
    app.request(pathOf(id), { method: 'POST', headers });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
    audit.mockClear();
});
afterEach(async () => {
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

describe('TEST:1617:1 self cancellation through the protected route', () => {
    it('(a) ACTIVE schedules the S11 date shown by its preview', async () => {
        const seeded = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...seeded, status: 'sent' });
        const shown = await app.request(previewPathOf(seeded.subscriptionId), {
            headers: ownerReadHeaders(seeded.ownerId)
        });
        expect(shown.status).toBe(200);
        const preview = ((await shown.json()) as { data: { serviceEndsAt: string } }).data;
        const response = await post(seeded.subscriptionId, ownerHeaders(seeded.ownerId));
        expect(response.status).toBe(200);
        const body = SubscriptionCancellationResponseSchema.parse(
            ((await response.json()) as { data: unknown }).data
        );
        expect(body).toMatchObject({ outcome: 'SCHEDULED', serviceEndsAt: preview.serviceEndsAt });
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCEL_SCHEDULED');
        expect(row?.serviceEndsAt?.toISOString()).toBe(preview.serviceEndsAt);
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, seeded.subscriptionId));
        expect(link).toBeDefined();
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: seeded.subscriptionId
        });
        expect(
            events.some(
                (event) =>
                    event.eventType === 'subscription.provider_cancellation_decided' &&
                    event.reason === 'S11'
            )
        ).toBe(true);
        expect(audit).toHaveBeenCalled();
    });

    it('(b) repeating an ACTIVE cancellation is already scheduled', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const first = await post(seeded.subscriptionId, ownerHeaders(seeded.ownerId));
        const expected = ((await first.json()) as { data: { serviceEndsAt: string } }).data
            .serviceEndsAt;
        const before = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        const second = await post(seeded.subscriptionId, ownerHeaders(seeded.ownerId));
        expect(second.status).toBe(200);
        expect(((await second.json()) as { data: unknown }).data).toMatchObject({
            outcome: 'ALREADY_SCHEDULED',
            serviceEndsAt: expected
        });
        const after = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(after[0]?.status).toBe(before[0]?.status);
        expect(after[0]?.serviceEndsAt?.toISOString()).toBe(expected);
    });

    it('(c) SUSPENDED ends today through S23', async () => {
        const seeded = await seedSelfDirectCard('SUSPENDED', fake, clock);
        const response = await post(seeded.subscriptionId, ownerHeaders(seeded.ownerId));
        expect(response.status).toBe(200);
        const body = (
            (await response.json()) as { data: { outcome: string; serviceEndsAt: string } }
        ).data;
        expect(body.outcome).toBe('CANCELLED');
        expect(new Date(body.serviceEndsAt).toISOString().slice(0, 10)).toBe(
            NOW.toISOString().slice(0, 10)
        );
        const event = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: seeded.subscriptionId
        });
        expect(event.some((entry) => entry.reason === 'S23')).toBe(true);
    });

    it('(d) GRACE_PERIOD ends today and retains its grace facts', async () => {
        const seeded = await seedSelfDirectCard('GRACE_PERIOD', fake, clock);
        const response = await post(seeded.subscriptionId, ownerHeaders(seeded.ownerId));
        expect(response.status).toBe(200);
        const result = SubscriptionCancellationResponseSchema.parse(
            ((await response.json()) as { data: unknown }).data
        );
        expect(result.outcome).toBe('CANCELLED');
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCELLED');
        expect(row?.serviceEndsAt?.toISOString()).toBe(result.serviceEndsAt);
        expect(row?.graceStartedAt).not.toBeNull();
        expect(row?.graceEndsAt).not.toBeNull();
        const event = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: seeded.subscriptionId
        });
        expect(event.some((entry) => entry.reason === 'S24')).toBe(true);
    });

    it('(e) PAUSED is rejected without changing the row', async () => {
        const seeded = await seedSelfState('PAUSED');
        const response = await post(seeded.subscriptionId, ownerHeaders(seeded.ownerId));
        expect(response.status).toBe(409);
        expect(((await response.json()) as { error: { reason: string } }).error.reason).toBe(
            'CANCELLATION_STATE_NOT_ALLOWED'
        );
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('PAUSED');
    });

    it('(f) waits for our notice before provider cancellation, but proceeds after exhaustion', async () => {
        const transient = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...transient, status: 'pending' });
        const cancel = vi.spyOn(fake, 'cancel');
        const waiting = await post(transient.subscriptionId, ownerHeaders(transient.ownerId));
        expect(waiting.status).toBe(200);
        expect(cancel).not.toHaveBeenCalled();

        cancel.mockClear();
        const exhausted = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...exhausted, status: 'failed' });
        const proceeded = await post(exhausted.subscriptionId, ownerHeaders(exhausted.ownerId));
        expect(proceeded.status).toBe(200);
        expect(cancel).toHaveBeenCalled();
    });

    it('(g)(h) common and staff actors cannot cancel another owner row', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const common = await seedSelfState('ACTIVE');
        const commonResponse = await post(seeded.subscriptionId, ownerHeaders(common.ownerId));
        expect(commonResponse.status).toBe(404);
        const staffResponse = await post(
            seeded.subscriptionId,
            actorHeaders({
                id: common.ownerId,
                role: 'ADMIN',
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            })
        );
        expect(staffResponse.status, await staffResponse.clone().text()).toBe(404);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
    });

    it('(i) rejects a malformed subscription id and (j) requires a session', async () => {
        expect((await post('not-a-uuid', ownerHeaders(crypto.randomUUID()))).status).toBe(400);
        expect(
            (
                await app.request(pathOf(crypto.randomUUID()), {
                    method: 'POST',
                    headers: actorHeaders()
                })
            ).status
        ).toBe(401);
    });
});
