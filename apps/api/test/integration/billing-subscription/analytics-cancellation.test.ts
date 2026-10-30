import { eq, getDb, subscriptions } from '@repo/db';
import { CancellationReasonEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import {
    createAnalyticsFactSink,
    resetAnalyticsFactSinkForTests,
    setAnalyticsFactSinkForTests
} from '../../../src/utils/analytics/analytics-facts';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfActive,
    seedSelfDirectCard,
    seedSelfState
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
const headers = (id: string) => actorHeaders({ id, role: 'USER', permissions: [] });
const adminHeaders = (id: string) =>
    actorHeaders({
        id,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
    });
const url = (id: string) => `/api/v1/protected/billing-subscription/${id}/cancellation`;
const adminUrl = (id: string) => `/api/v1/admin/billing-subscription/${id}/cancellation`;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => clock.set(NOW));
afterEach(async () => {
    resetAnalyticsFactSinkForTests();
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

describe('TEST:1878:11, TEST:1878:21, TEST:1878:23 cancellation analytics', () => {
    it('persists S11 reason and emits the committed scheduled fact', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const response = await app.request(url(seeded.subscriptionId), {
            method: 'POST',
            headers: { ...headers(seeded.ownerId), 'content-type': 'application/json' },
            body: JSON.stringify({ reason: CancellationReasonEnum.TOO_EXPENSIVE })
        });
        expect(response.status).toBe(200);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.cancellationReason).toBe(CancellationReasonEnum.TOO_EXPENSIVE);
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture.mock.calls[0]?.[0]).toMatchObject({
            name: 'billing_cancel_scheduled',
            distinctId: seeded.ownerId,
            properties: { reason: 'TOO_EXPENSIVE' }
        });
    });

    it('AC-11 AC-23 admin cancellation persists the reason and emits one ADMIN fact after commit', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const response = await app.request(adminUrl(seeded.subscriptionId), {
            method: 'POST',
            headers: {
                ...adminHeaders('00000000-0000-4000-8000-000000000099'),
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                expectedOrigin: 'ACTIVE',
                reason: CancellationReasonEnum.TOO_EXPENSIVE
            })
        });
        expect(response.status).toBe(200);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.cancellationReason).toBe(CancellationReasonEnum.TOO_EXPENSIVE);
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture.mock.calls[0]?.[0]).toMatchObject({
            name: 'billing_cancel_scheduled',
            distinctId: seeded.ownerId,
            properties: { actor_kind: 'ADMIN', reason: 'TOO_EXPENSIVE' }
        });
    });

    it('AC-12 does not emit an admin cancellation fact when the origin is rejected', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const response = await app.request(adminUrl(seeded.subscriptionId), {
            method: 'POST',
            headers: {
                ...adminHeaders('00000000-0000-4000-8000-000000000098'),
                'content-type': 'application/json'
            },
            body: JSON.stringify({ expectedOrigin: 'SUSPENDED' })
        });
        expect(response.status).toBe(409);
        expect(capture).not.toHaveBeenCalled();
    });

    it('rejects an admin cancellation without a body and does not publish it as optional', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const response = await app.request(adminUrl(seeded.subscriptionId), {
            method: 'POST',
            headers: adminHeaders('00000000-0000-4000-8000-000000000097')
        });
        expect(response.status).toBe(400);
        expect(response.status).not.toBe(500);
        const errorBody = (await response.json()) as {
            error?: { code?: string };
        };
        expect(errorBody.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        const docs = await app.request('/docs/openapi.json', {
            headers: { 'user-agent': 'vitest' }
        });
        const document = (await docs.json()) as {
            paths: Record<string, { post?: { requestBody?: { required?: boolean } } }>;
        };
        const requestBody =
            document.paths['/api/v1/admin/billing-subscription/{subscriptionId}/cancellation']?.post
                ?.requestBody;
        expect(requestBody).toBeDefined();
        expect(Object.hasOwn(requestBody ?? {}, 'required')).toBe(false);
    });

    it('AC-21 accepts no body, keeps NULL, and omits the reason property', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const response = await app.request(url(seeded.subscriptionId), {
            method: 'POST',
            headers: headers(seeded.ownerId)
        });
        expect(response.status).toBe(200);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.cancellationReason).toBeNull();
        expect(capture.mock.calls[0]?.[0]).toMatchObject({ name: 'billing_cancel_scheduled' });
        expect(capture.mock.calls[0]?.[0].properties).not.toHaveProperty('reason');
    });

    it('AC-22 rejects a reason outside the enum without changing the subscription', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const response = await app.request(url(seeded.subscriptionId), {
            method: 'POST',
            headers: { ...headers(seeded.ownerId), 'content-type': 'application/json' },
            body: JSON.stringify({ reason: 'NOT_AN_ACCEPTED_REASON' })
        });
        expect(response.status).toBe(400);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(row?.cancellationReason).toBeNull();
    });

    it('TEST:1878:11 persists and emits a direct S23 cancellation', async () => {
        const seeded = await seedSelfDirectCard('SUSPENDED', fake, clock);
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const response = await app.request(url(seeded.subscriptionId), {
            method: 'POST',
            headers: { ...headers(seeded.ownerId), 'content-type': 'application/json' },
            body: JSON.stringify({ reason: CancellationReasonEnum.SEASONAL_PAUSE })
        });
        expect(response.status).toBe(200);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.cancellationReason).toBe(CancellationReasonEnum.SEASONAL_PAUSE);
        expect(capture.mock.calls[0]?.[0]).toMatchObject({
            name: 'billing_subscription_cancelled',
            properties: {
                reason: 'SEASONAL_PAUSE',
                path: 'DIRECT_FROM_SUSPENDED',
                was_scheduled: false
            }
        });
    });

    it('does not write a reason or emit for ALREADY_SCHEDULED and ALREADY_CANCELLED', async () => {
        const scheduled = await seedSelfState('CANCEL_SCHEDULED');
        const cancelled = await seedSelfState('CANCELLED');
        await getDb()
            .update(subscriptions)
            .set({ cancellationReason: 'OTHER' })
            .where(eq(subscriptions.id, scheduled.subscriptionId));
        await getDb()
            .update(subscriptions)
            .set({ cancellationReason: 'OTHER' })
            .where(eq(subscriptions.id, cancelled.subscriptionId));
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        for (const row of [scheduled, cancelled]) {
            const response = await app.request(url(row.subscriptionId), {
                method: 'POST',
                headers: { ...headers(row.ownerId), 'content-type': 'application/json' },
                body: JSON.stringify({ reason: 'TOO_EXPENSIVE' })
            });
            expect(response.status).toBe(200);
            expect(
                (
                    await getDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, row.subscriptionId))
                )[0]?.cancellationReason
            ).toBe('OTHER');
        }
        expect(capture).not.toHaveBeenCalled();
    });
});
