import { emailOutbox, eq, providerLinks, subscriptions } from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    closeNow,
    readCloseCase,
    seedCloseCase
} from '../../../../../packages/service-core/test/integration/services/support/succession-close-fixtures';
import { initApp } from '../../../src/app';
import { subscriptionSuccessionReevaluationJob } from '../../../src/cron/jobs/subscription-succession-reevaluation.job';
import type { CronJobContext } from '../../../src/cron/types';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { getSuccessionCloser } from '../../../src/utils/billing-succession-ports';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: closeNow });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'webhook fixture needs an authorization' }]
});
const webhookSecret = 'b8b8-succession-settle-secret';
let app: ReturnType<typeof initApp>;
let server: FakeProviderServer;

beforeAll(async () => {
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
    await testDb.setup();
    validateApiEnv();
    server = await startFakeProviderServer({ provider: fake, clock });
    const provider = new MercadoPagoPaymentProvider({
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
beforeEach(() => clock.set({ at: closeNow }));

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

async function authorization(reference: string, approve = false) {
    const created = await fake.authorize({
        reference,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Succession settlement test',
        returnUrl: 'https://example.test/return'
    });
    if (approve) await fake.approve({ authorizationId: created.authorizationId });
    return created.authorizationId;
}

function oldCancelCalls(authorizationId: string) {
    return server
        .requests()
        .filter(
            (request) =>
                request.method === 'PUT' &&
                request.path === `/preapproval/${authorizationId}` &&
                typeof request.body === 'object' &&
                request.body !== null &&
                'status' in request.body &&
                request.body.status === 'cancelled'
        );
}

async function deliverAuthorization(authorizationId: string) {
    server.mercadoPagoDeliveries({ webhookSecret });
    await fake.approve({ authorizationId });
    clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    const delivery = server
        .mercadoPagoDeliveries({ webhookSecret })
        .deliveries.find(
            (candidate) => new URLSearchParams(candidate.query).get('data.id') === authorizationId
        );
    if (!delivery) throw new Error('Missing successor authorization delivery');
    return app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
        method: 'POST',
        headers: { ...delivery.headers, 'user-agent': delivery.headers['user-agent'] ?? 'vitest' },
        body: delivery.body
    });
}

describe('TEST:B8b:8 TEST:B8b:24 real S17/S9 after activation', () => {
    it('(a, c) cancels the predecessor only after the authorization webhook and closes once', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'ACTIVE',
                successorStatus: 'PENDING_AUTHORIZATION',
                complement: true
            });
            const oldId = await authorization(ids.predecessor.id, true);
            const successorId = await authorization(ids.successor.id);
            await tx.insert(providerLinks).values([
                { subscriptionId: ids.predecessor.id, provider: 'MERCADO_PAGO', providerId: oldId },
                {
                    subscriptionId: ids.successor.id,
                    provider: 'MERCADO_PAGO',
                    providerId: successorId
                }
            ]);
            server.mercadoPagoDeliveries({ webhookSecret });
            await beforeCancelNotice.beforeCancel({
                subscriptionId: ids.predecessor.id,
                userId: ids.userId,
                kind: 'SUCCESSION_PREDECESSOR'
            });
            await tx
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.recipientUserId, ids.userId));
            expect((await readCloseCase(tx, ids)).predecessor?.status).toBe('ACTIVE');
            expect((await fake.readAuthorization({ authorizationId: oldId })).snapshot.status).toBe(
                'active'
            );
            expect(oldCancelCalls(oldId)).toHaveLength(0);
            const response = await deliverAuthorization(successorId);
            const rows = await readCloseCase(tx, ids);
            expect(response.status).toBe(200);
            expect(rows.predecessor?.status).toBe('CANCELLED');
            expect(rows.predecessor?.succeededById).toBe(ids.successor.id);
            expect(rows.successor?.succeedsId).toBeNull();
            expect(rows.addon?.targetId).toBe(ids.successor.id);
            expect((await fake.readAuthorization({ authorizationId: oldId })).snapshot.status).toBe(
                'cancelled'
            );
            expect(oldCancelCalls(oldId)).toHaveLength(1);
            const notices = await tx
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, ids.userId));
            expect(
                notices.filter(
                    (notice) =>
                        (notice.payload as { subscriptionId?: string }).subscriptionId ===
                        ids.predecessor.id
                )
            ).toHaveLength(1);
        });
    });

    it('(b) leaves the old subscription and authorization alive when checkout is abandoned', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'ACTIVE',
                successorStatus: 'PENDING_AUTHORIZATION'
            });
            const oldId = await authorization(ids.predecessor.id, true);
            const successorId = await authorization(ids.successor.id);
            await tx.insert(providerLinks).values([
                { subscriptionId: ids.predecessor.id, provider: 'MERCADO_PAGO', providerId: oldId },
                {
                    subscriptionId: ids.successor.id,
                    provider: 'MERCADO_PAGO',
                    providerId: successorId
                }
            ]);
            server.mercadoPagoDeliveries({ webhookSecret });
            clock.advance({ ms: 4 * 24 * 60 * 60 * 1000 });
            await tx
                .update(subscriptions)
                .set({
                    authorizationWindowDeadlineVersion: 1,
                    authorizationWindowEndsAt: new Date(closeNow.getTime() + 60 * 60 * 1000)
                })
                .where(eq(subscriptions.id, ids.successor.id));
            const { subscriptionWindowExpiryJob } = await import(
                '../../../src/cron/jobs/subscription-window-expiry.job'
            );
            await subscriptionWindowExpiryJob.handler(context());
            const rows = await readCloseCase(tx, ids);
            expect(rows.successor?.status).toBe('ABANDONED');
            expect(rows.predecessor?.status).toBe('ACTIVE');
            expect((await fake.readAuthorization({ authorizationId: oldId })).snapshot.status).toBe(
                'active'
            );
            expect(oldCancelCalls(oldId)).toHaveLength(0);
        });
    });

    it('(d) does not cancel an already cancelled predecessor preapproval again', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'ACTIVE',
                successorStatus: 'PENDING_AUTHORIZATION'
            });
            const oldId = await authorization(ids.predecessor.id, true);
            await fake.cancel({ authorizationId: oldId });
            const successorId = await authorization(ids.successor.id);
            await tx.insert(providerLinks).values([
                { subscriptionId: ids.predecessor.id, provider: 'MERCADO_PAGO', providerId: oldId },
                {
                    subscriptionId: ids.successor.id,
                    provider: 'MERCADO_PAGO',
                    providerId: successorId
                }
            ]);
            server.mercadoPagoDeliveries({ webhookSecret });
            expect((await deliverAuthorization(successorId)).status).toBe(200);
            expect((await readCloseCase(tx, ids)).predecessor?.status).toBe('CANCELLED');
            expect(oldCancelCalls(oldId)).toHaveLength(0);
        });
    });

    it('(e) reissues courtesy after S17 closes a live predecessor', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'ACTIVE',
                successorStatus: 'PENDING_AUTHORIZATION',
                courtesy: true
            });
            const oldId = await authorization(ids.predecessor.id, true);
            const successorId = await authorization(ids.successor.id);
            await tx.insert(providerLinks).values([
                { subscriptionId: ids.predecessor.id, provider: 'MERCADO_PAGO', providerId: oldId },
                {
                    subscriptionId: ids.successor.id,
                    provider: 'MERCADO_PAGO',
                    providerId: successorId
                }
            ]);
            server.mercadoPagoDeliveries({ webhookSecret });
            await beforeCancelNotice.beforeCancel({
                subscriptionId: ids.predecessor.id,
                userId: ids.userId,
                kind: 'SUCCESSION_PREDECESSOR'
            });
            await tx
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.recipientUserId, ids.userId));
            expect((await deliverAuthorization(successorId)).status).toBe(200);
            const rows = await readCloseCase(tx, ids);
            expect(rows.successor?.status).toBe('PAUSED');
            expect(rows.grant).toMatchObject({
                subscriptionId: ids.successor.id,
                balanceMonths: null
            });
        });
    });

    it('(f) retries a deferred S17 and S9 through the job', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'ACTIVE',
                successorStatus: 'PENDING_AUTHORIZATION',
                courtesy: true
            });
            const oldId = await authorization(ids.predecessor.id, true);
            const successorId = await authorization(ids.successor.id);
            await tx.insert(providerLinks).values([
                { subscriptionId: ids.predecessor.id, provider: 'MERCADO_PAGO', providerId: oldId },
                {
                    subscriptionId: ids.successor.id,
                    provider: 'MERCADO_PAGO',
                    providerId: successorId
                }
            ]);
            server.mercadoPagoDeliveries({ webhookSecret });
            expect((await deliverAuthorization(successorId)).status).toBe(200);
            expect((await readCloseCase(tx, ids)).predecessor?.status).toBe('ACTIVE');
            await tx
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.recipientUserId, ids.userId));
            expect((await subscriptionSuccessionReevaluationJob.handler(context())).success).toBe(
                true
            );
            const rows = await readCloseCase(tx, ids);
            expect(rows.predecessor?.status).toBe('CANCELLED');
            expect(rows.successor?.status).toBe('PAUSED');
            expect(rows.grant).toMatchObject({
                subscriptionId: ids.successor.id,
                balanceMonths: null
            });
        });
    });

    it('reissues courtesy when the predecessor already closed itself before activation', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'CANCELLED',
                successorStatus: 'PENDING_AUTHORIZATION',
                courtesy: true
            });
            await getSuccessionCloser().closeSuccession({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const successorId = await authorization(ids.successor.id);
            await tx.insert(providerLinks).values({
                subscriptionId: ids.successor.id,
                provider: 'MERCADO_PAGO',
                providerId: successorId
            });
            server.mercadoPagoDeliveries({ webhookSecret });
            expect((await deliverAuthorization(successorId)).status).toBe(200);
            const rows = await readCloseCase(tx, ids);
            expect(rows.successor?.status).toBe('PAUSED');
            expect(rows.grant).toMatchObject({
                subscriptionId: ids.successor.id,
                balanceMonths: null
            });
        });
    });
});
