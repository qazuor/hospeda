/**
 * RES-04 — the real Mercado Pago receiver accepts the same signed delivery twice
 * without repeating its observable effects.
 */

import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { readSubscriptionStatus } from '../../fixtures/billing-signup-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    E2E_RECEIVER_PATH,
    E2E_WEBHOOK_SECRET,
    startE2eFakeProvider
} from '../../fixtures/fake-provider-server.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const clock = createAdjustableClock({ start: new Date() });

test.describe('RES-04: duplicate signed webhook is idempotent @p0 @resilience @billing @clock', () => {
    test.describe.configure({ mode: 'serial', timeout: 120_000 });

    const userIdsToCleanup: string[] = [];
    let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;

    test.beforeAll(async () => {
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() }),
            clock
        });
        await execSQL(
            `INSERT INTO billing_deadline_version (version, "values")
             VALUES (1, $1::jsonb) ON CONFLICT (version) DO NOTHING`,
            [
                JSON.stringify({
                    '10': { cardHours: 72, manualDays: 7 },
                    '11': { noticeDays: 60, contactDays: [30, 7] },
                    '12': { noticeDays: 60, contactDays: [30, 7] },
                    '13': { daysBefore: [5, 1] },
                    '14': { daysBefore: 7 },
                    '15': { hoursRemaining: 24 },
                    '16': { days: 7 },
                    '17': { days: 7 },
                    '18': { days: 180 },
                    '19': { minutes: 60 }
                })
            ]
        );
    });

    test.afterAll(async () => {
        try {
            if (userIdsToCleanup.length > 0) {
                await execSQL(
                    `DELETE FROM provider_link
                      WHERE subscription_id IN (
                          SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])
                      )`,
                    [userIdsToCleanup]
                );
                await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
                userIdsToCleanup.length = 0;
            }
        } finally {
            await fakeServer?.close();
        }
    });

    test('accepts two identical signed deliveries and records effects only once', async () => {
        // Arrange
        if (!fakeServer) throw new Error('RES-04 fake provider server was not started');
        const user = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(user.id);
        await markProfileCompleted({ userId: user.id });
        const billingOptionId = await monthlyOptionForSlug('owner-basico');
        const started = await fetch(`${API_URL}/api/v1/protected/billing/subscriptions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: user.sessionCookie },
            body: JSON.stringify({
                billingOptionId,
                payerEmail: `mp-${crypto.randomUUID()}@example.test`
            })
        });
        const startedBody = (await started.json()) as {
            data?: { subscriptionId?: string; authorizationId?: string };
            error?: { message?: string };
        };
        expect(
            fakeServer.requests().length,
            `subscription signup must reach fake provider; error=${startedBody.error?.message ?? 'none'}`
        ).toBeGreaterThan(0);
        expect(started.status, `subscription signup failed: ${startedBody.error?.message}`).toBe(
            201
        );
        const subscriptionId = startedBody.data?.subscriptionId;
        const authorizationId = startedBody.data?.authorizationId;
        expect(subscriptionId, 'signup must return its subscription id').toBeTruthy();
        expect(authorizationId, 'signup must return its authorization id').toBeTruthy();
        await fakeServer.provider.approve({ authorizationId: authorizationId ?? '' });
        const generated = fakeServer.mercadoPagoDeliveries({
            webhookSecret: E2E_WEBHOOK_SECRET
        });
        const delivery = generated.deliveries.find((item) => item.channel === 'WEBHOOKS');
        expect(delivery, 'approval must produce a signed WEBHOOKS delivery').toBeDefined();
        if (!delivery || !subscriptionId) throw new Error('RES-04 signed delivery was not created');

        const postDelivery = () =>
            fetch(`${API_URL}${E2E_RECEIVER_PATH}?${delivery.query}`, {
                method: 'POST',
                headers: delivery.headers,
                body: delivery.body
            });
        const countOutboxRows = async () => {
            const rows = await execSQL<{ count: string }>(
                'SELECT COUNT(*)::text AS count FROM email_outbox WHERE recipient_user_id = $1',
                [user.id]
            );
            return Number(rows[0]?.count ?? 0);
        };

        // Act: the first delivery must apply the approval and enqueue an effect.
        const first = await postDelivery();
        const firstBody = await first.text();
        expect(
            first.status,
            `first signed webhook returned ${first.status}: ${firstBody}`
        ).toBeGreaterThanOrEqual(200);
        expect(
            first.status,
            `first signed webhook returned ${first.status}: ${firstBody}`
        ).toBeLessThan(300);
        const firstStatus = await readSubscriptionStatus({ subscriptionId });
        const firstOutboxCount = await countOutboxRows();

        // Assert first-delivery positive control and exact duplicate invariants.
        expect(firstStatus, 'first delivery must activate the subscription').toBe('ACTIVE');
        expect(
            firstOutboxCount,
            'first delivery must enqueue an email outbox effect'
        ).toBeGreaterThan(0);

        const second = await postDelivery();
        const secondBody = await second.text();
        expect(
            second.status,
            `duplicate signed webhook returned ${second.status}: ${secondBody}`
        ).toBeGreaterThanOrEqual(200);
        expect(
            second.status,
            `duplicate signed webhook returned ${second.status}: ${secondBody}`
        ).toBeLessThan(300);
        expect(
            await readSubscriptionStatus({ subscriptionId }),
            'duplicate delivery must leave subscription ACTIVE'
        ).toBe('ACTIVE');
        expect(
            await countOutboxRows(),
            'duplicate delivery must not add another email outbox effect'
        ).toBe(firstOutboxCount);
    });
});
