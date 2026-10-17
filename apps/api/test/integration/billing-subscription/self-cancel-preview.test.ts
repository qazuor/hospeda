import { eq, getDb, subscriptions } from '@repo/db';
import { PermissionEnum, SubscriptionCancellationPreviewResponseSchema } from '@repo/schemas';
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
    seedSelfActive,
    seedSelfPreviewAddon,
    seedSelfState,
    seedUser
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
const pathOf = (id: string) => `/api/v1/protected/billing-subscription/${id}/cancellation`;
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

describe('TEST:1617:2 cancellation preview through its route', () => {
    it('(a) ACTIVE preview has the same date the act writes and the preview itself does not write', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const [before] = await getDb()
            .select({
                status: subscriptions.status,
                serviceEndsAt: subscriptions.serviceEndsAt,
                graceEndsAt: subscriptions.graceEndsAt
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        const response = await app.request(pathOf(seeded.subscriptionId), {
            headers: headers(seeded.ownerId)
        });
        expect(response.status).toBe(200);
        const preview = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await response.json()) as { data: unknown }).data
        );
        expect(preview.origin).toBe('ACTIVE');
        expect(preview.addons).toEqual([]);
        const [afterPreview] = await getDb()
            .select({
                status: subscriptions.status,
                serviceEndsAt: subscriptions.serviceEndsAt,
                graceEndsAt: subscriptions.graceEndsAt
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(afterPreview).toEqual(before);
        const act = await app.request(pathOf(seeded.subscriptionId), {
            method: 'POST',
            headers: headers(seeded.ownerId)
        });
        expect(act.status).toBe(200);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.serviceEndsAt?.toISOString()).toBe(
            preview.origin === 'ACTIVE' ? preview.serviceEndsAt : undefined
        );
    });

    it('(b) GRACE_PERIOD reports this row grace end and SUSPENDED ends today', async () => {
        const grace = await seedSelfState('GRACE_PERIOD');
        const suspended = await seedSelfState('SUSPENDED');
        const graceResponse = await app.request(pathOf(grace.subscriptionId), {
            headers: headers(grace.ownerId)
        });
        const graceBody = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await graceResponse.json()) as { data: unknown }).data
        );
        expect(graceBody).toMatchObject({
            origin: 'GRACE_PERIOD',
            graceEndsAt: '2026-10-11T12:00:00.000Z'
        });
        const suspendedResponse = await app.request(pathOf(suspended.subscriptionId), {
            headers: headers(suspended.ownerId)
        });
        const suspendedBody = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await suspendedResponse.json()) as { data: unknown }).data
        );
        expect(suspendedBody).toMatchObject({ origin: 'SUSPENDED', addons: [] });
    });

    it('(c) CANCEL_SCHEDULED returns its persisted date', async () => {
        const seeded = await seedSelfState('CANCEL_SCHEDULED');
        const response = await app.request(pathOf(seeded.subscriptionId), {
            headers: headers(seeded.ownerId)
        });
        const body = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await response.json()) as { data: unknown }).data
        );
        expect(body).toMatchObject({
            origin: 'CANCEL_SCHEDULED',
            serviceEndsAt: '2026-11-05T12:00:00.000Z',
            addons: []
        });
    });

    it('(d)-(f) previews do not write and report recurrent addon timing by source state', async () => {
        const active = await seedSelfActive(fake, clock);
        const activeAddon = await seedSelfPreviewAddon({
            ownerId: active.ownerId,
            targetId: active.subscriptionId,
            status: 'ACTIVE'
        });
        const pendingAddon = await seedSelfPreviewAddon({
            ownerId: active.ownerId,
            targetId: active.subscriptionId,
            status: 'PENDING_AUTHORIZATION'
        });
        await seedSelfPreviewAddon({
            ownerId: active.ownerId,
            targetId: active.subscriptionId,
            status: 'ACTIVE',
            chargeKind: 'UNA_VEZ'
        });
        const before = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, active.subscriptionId));
        const response = await app.request(pathOf(active.subscriptionId), {
            headers: headers(active.ownerId)
        });
        expect(response.status).toBe(200);
        const body = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await response.json()) as { data: unknown }).data
        );
        expect(body.origin).toBe('ACTIVE');
        expect(body.addons).toEqual([
            expect.objectContaining({
                addonInstanceId: activeAddon.instanceId,
                name: 'Preview addon',
                price: 5000,
                currency: 'ARS',
                whenOff: 'CHARGE_CUT_TODAY'
            }),
            expect.objectContaining({
                addonInstanceId: pendingAddon.instanceId,
                whenOff: 'AT_SERVICE_END'
            })
        ]);
        expect(
            await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, active.subscriptionId))
        ).toEqual(before);

        const grace = await seedSelfState('GRACE_PERIOD');
        const graceAddon = await seedSelfPreviewAddon({
            ownerId: grace.ownerId,
            targetId: grace.subscriptionId,
            status: 'ACTIVE'
        });
        const graceResponse = await app.request(pathOf(grace.subscriptionId), {
            headers: headers(grace.ownerId)
        });
        const graceBody = SubscriptionCancellationPreviewResponseSchema.parse(
            ((await graceResponse.json()) as { data: unknown }).data
        );
        expect(graceBody.addons).toEqual([
            expect.objectContaining({
                addonInstanceId: graceAddon.instanceId,
                whenOff: 'TODAY'
            })
        ]);
    });

    it('(g) hides another owner from ordinary and billing staff; PAUSED is rejected', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const stranger = await seedUser('preview-stranger');
        const staff = actorHeaders({
            id: stranger,
            role: 'ADMIN',
            permissions: [
                PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
                PermissionEnum.BILLING_VIEW_OWN
            ]
        });
        for (const requestHeaders of [headers(stranger), staff]) {
            const response = await app.request(pathOf(seeded.subscriptionId), {
                headers: requestHeaders
            });
            expect(response.status).toBe(404);
        }
        const paused = await seedSelfState('PAUSED');
        const pausedResponse = await app.request(pathOf(paused.subscriptionId), {
            headers: headers(paused.ownerId)
        });
        expect(pausedResponse.status).toBe(409);
    });
});
