import {
    emailOutbox,
    eq,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { SubscriptionPlanChangeResponseSchema } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { suspendForArrears } from '../../../../../packages/service-core/src/services/billing/subscription/suspend-for-arrears.service';
import { initApp } from '../../../src/app';
import { subscriptionWindowExpiryJob } from '../../../src/cron/jobs/subscription-window-expiry.job';
import type { CronJobContext } from '../../../src/cron/types';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './revocation-route-fixtures';
import { startPlanChangeScenario, withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-10-05T12:00:00.000Z') });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'fixture signup' }]
});
const webhookSecret = 'b8b-plan-change-route-secret';
let server: FakeProviderServer;
let provider: MercadoPagoPaymentProvider;
let app: ReturnType<typeof initApp>;
const pathOf = (id: string) => `/api/v1/protected/billing-subscription/${id}/plan-change`;
const post = (id: string, ownerId: string, billingOptionId: string) =>
    app.request(pathOf(id), {
        method: 'POST',
        headers: actorHeaders({ id: ownerId, role: 'USER', permissions: [] }),
        body: JSON.stringify({ billingOptionId })
    });
const context = (): CronJobContext => ({
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined
    },
    startedAt: clock.now(),
    runId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    dryRun: false
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
    await testDb.setup();
    validateApiEnv();
    server = await startFakeProviderServer({ provider: fake, clock });
    provider = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    injectClock({ clock });
    injectPaymentProvider({ provider });
    app = initApp({ clock, paymentProvider: provider });
});
afterAll(async () => {
    await server.close();
    await testDb.teardown();
});

describe('TEST:B8b:8 TEST:B8b:24 succession declared through the route', () => {
    it('succeeds a card principal suspended by S6 and mirrors a provider pause through the route', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            await fake.pause({ authorizationId: row.authorizationId });
            const suspension = await suspendForArrears(
                {
                    subscriptionId: row.subscriptionId,
                    event: 'PROVIDER_PAUSE_OBSERVED',
                    occurrenceId: `route-suspension-${row.subscriptionId}`
                },
                {
                    provider,
                    clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' }
                }
            );
            expect(suspension).toMatchObject({ outcome: 'SUSPENDED', cancelCall: 'SENT' });
            const [suspended] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(suspended).toMatchObject({
                status: 'SUSPENDED',
                paymentMethod: 'CARD',
                class: 'PRINCIPAL'
            });
            expect(
                (await fake.readAuthorization({ authorizationId: row.authorizationId })).snapshot
                    .status
            ).toBe('cancelled');

            const response = await post(row.subscriptionId, row.userId, row.targetOptionId);
            expect(response.status, await response.clone().text()).toBe(200);
            const result = SubscriptionPlanChangeResponseSchema.parse(
                ((await response.json()) as { data: unknown }).data
            );
            expect(result.outcome).toBe('SUCCESSION');
            if (result.outcome !== 'SUCCESSION') throw new Error('Expected succession');
            const [successor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, result.subscriptionId));
            const [predecessor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(successor?.status).toBe('PENDING_AUTHORIZATION');
            expect(successor?.succeedsId).toBe(row.subscriptionId);
            expect(successor?.firstChargeAt?.getTime()).toBe(clock.now().getTime());
            expect(predecessor?.status).toBe('SUSPENDED');
            expect(predecessor?.succeededById).toBe(result.subscriptionId);
            const [link] = await tx
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, result.subscriptionId));
            if (!link) throw new Error('Successor provider link missing');
            const oldCancellationCalls = server
                .requests()
                .filter(
                    (request) =>
                        request.method === 'PUT' &&
                        request.path === `/preapproval/${row.authorizationId}`
                ).length;
            await fake.approve({ authorizationId: link.providerId });
            clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
            const delivery = server
                .mercadoPagoDeliveries({ webhookSecret })
                .deliveries.find(
                    (candidate) =>
                        new URLSearchParams(candidate.query).get('data.id') === link.providerId
                );
            if (!delivery) throw new Error('Successor authorization delivery missing');
            const webhook = await app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
                method: 'POST',
                headers: {
                    ...delivery.headers,
                    'user-agent': delivery.headers['user-agent'] ?? 'vitest'
                },
                body: delivery.body
            });
            expect(webhook.status).toBe(200);
            const [closed] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(closed?.status).toBe('CANCELLED');
            expect(
                server
                    .requests()
                    .filter(
                        (request) =>
                            request.method === 'PUT' &&
                            request.path === `/preapproval/${row.authorizationId}`
                    )
            ).toHaveLength(oldCancellationCalls);
        });

        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            await fake.pause({ authorizationId: row.authorizationId });
            const response = await post(row.subscriptionId, row.userId, row.targetOptionId);
            expect(response.status).toBe(422);
            const notices = await tx
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, row.userId));
            expect(notices.some((notice) => notice.template === 'billing.arrears-suspension')).toBe(
                true
            );
            const [predecessor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(predecessor?.status).toBe('ACTIVE');
        });
    });

    it('(e) keeps the ACTIVE predecessor until authorization', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            server.mercadoPagoDeliveries({ webhookSecret });
            const response = await post(row.subscriptionId, row.userId, row.targetOptionId);
            expect(response.status, await response.clone().text()).toBe(200);
            const result = SubscriptionPlanChangeResponseSchema.parse(
                ((await response.json()) as { data: unknown }).data
            );
            expect(result.outcome).toBe('SUCCESSION');
            if (result.outcome !== 'SUCCESSION') throw new Error('Expected succession');
            expect(result.checkoutUrl).toContain('https://payments-fake.invalid/approve/');
            const [successor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, result.subscriptionId));
            const [predecessor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(successor?.status).toBe('PENDING_AUTHORIZATION');
            expect(successor?.succeedsId).toBe(row.subscriptionId);
            expect(successor?.firstChargeAt?.getTime()).toBeGreaterThan(
                successor?.authorizationWindowEndsAt?.getTime() ?? Number.MAX_VALUE
            );
            expect(predecessor?.status).toBe('ACTIVE');
            expect(
                (await fake.readAuthorization({ authorizationId: row.authorizationId })).snapshot
                    .status
            ).toBe('active');
        });
    });

    it('(d) rejects a second upgrade while succession is in progress', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            server.mercadoPagoDeliveries({ webhookSecret });
            expect((await post(row.subscriptionId, row.userId, row.targetOptionId)).status).toBe(
                200
            );
            const second = await post(row.subscriptionId, row.userId, row.targetOptionId);
            expect(second.status).toBe(409);
            expect(
                ((await second.json()) as { error: { details: { reason: string } } }).error.details
                    .reason
            ).toBe('SUCCESSION_IN_PROGRESS');
        });
    });

    it('(f)(g) downgrades through the provider and permits regret', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                direction: 'DOWN',
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            const [before] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            const downgrade = await post(row.subscriptionId, row.userId, row.targetOptionId);
            expect(downgrade.status, await downgrade.clone().text()).toBe(200);
            const down = SubscriptionPlanChangeResponseSchema.parse(
                ((await downgrade.json()) as { data: unknown }).data
            );
            expect(down.outcome).toBe('DOWNGRADE');
            if (down.outcome !== 'DOWNGRADE') throw new Error('Expected downgrade');
            expect(new Date(down.effectiveAt).getTime()).toBeGreaterThan(clock.now().getTime());
            const queued = await tx
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.subscriptionId, row.subscriptionId));
            expect(queued).toHaveLength(1);
            const [after] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(after?.planVersionId).toBe(before?.planVersionId);
            expect(
                server
                    .requests()
                    .some(
                        (request) =>
                            request.method === 'PUT' &&
                            request.path === `/preapproval/${row.authorizationId}`
                    )
            ).toBe(true);
            expect(
                (await fake.readAuthorization({ authorizationId: row.authorizationId })).snapshot
                    .amount
            ).toEqual({ amountMinor: down.amountMinor, currency: 'ARS' });
            const regret = await post(row.subscriptionId, row.userId, row.sourceOptionId);
            expect(regret.status, await regret.clone().text()).toBe(200);
            const result = SubscriptionPlanChangeResponseSchema.parse(
                ((await regret.json()) as { data: unknown }).data
            );
            expect(result.outcome).toBe('REGRET');
        });
    });

    it('(h) abandons checkout after the expiry job while the predecessor stays ACTIVE', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            server.mercadoPagoDeliveries({ webhookSecret });
            const response = await post(row.subscriptionId, row.userId, row.targetOptionId);
            const result = SubscriptionPlanChangeResponseSchema.parse(
                ((await response.json()) as { data: unknown }).data
            );
            if (result.outcome !== 'SUCCESSION') throw new Error('Expected succession');
            clock.advance({ ms: 4 * 24 * 60 * 60 * 1000 });
            await subscriptionWindowExpiryJob.handler(context());
            const [successor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, result.subscriptionId));
            const [predecessor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(successor?.status).toBe('ABANDONED');
            expect(predecessor?.status).toBe('ACTIVE');
            expect(
                (await fake.readAuthorization({ authorizationId: row.authorizationId })).snapshot
                    .status
            ).toBe('active');
        });
    });

    it('(i) authorizes through the webhook, then cancels the predecessor', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            server.mercadoPagoDeliveries({ webhookSecret });
            const response = await post(row.subscriptionId, row.userId, row.targetOptionId);
            const result = SubscriptionPlanChangeResponseSchema.parse(
                ((await response.json()) as { data: unknown }).data
            );
            if (result.outcome !== 'SUCCESSION') throw new Error('Expected succession');
            const [link] = await tx
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, result.subscriptionId));
            if (!link) throw new Error('Successor provider link missing');
            await beforeCancelNotice.beforeCancel({
                subscriptionId: row.subscriptionId,
                userId: row.userId,
                kind: 'SUCCESSION_PREDECESSOR'
            });
            await tx
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.recipientUserId, row.userId));
            await fake.approve({ authorizationId: link.providerId });
            clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
            const delivery = server
                .mercadoPagoDeliveries({ webhookSecret })
                .deliveries.find(
                    (candidate) =>
                        new URLSearchParams(candidate.query).get('data.id') === link.providerId
                );
            if (!delivery) throw new Error('Successor authorization delivery missing');
            const webhook = await app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
                method: 'POST',
                headers: {
                    ...delivery.headers,
                    'user-agent': delivery.headers['user-agent'] ?? 'vitest'
                },
                body: delivery.body
            });
            expect(webhook.status).toBe(200);
            const [predecessor] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(predecessor?.status).toBe('CANCELLED');
            expect(
                (await fake.readAuthorization({ authorizationId: row.authorizationId })).snapshot
                    .status
            ).toBe('cancelled');
        });
    });
});
