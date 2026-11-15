import { emailOutbox, eq } from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cancelActiveSubscription } from '../../../../../packages/service-core/src/services/billing/subscription/cancel-active-subscription.service';
import { applyS12ToPrincipal } from '../../../../../packages/service-core/src/services/billing/subscription/service-end-s12';
import {
    closeNow,
    readCloseCase
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
import { startSettlementSuccession, withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: closeNow });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'webhook fixture needs an authorization' }]
});
const webhookSecret = 'b8b8-succession-settle-secret';
let app: ReturnType<typeof initApp>;
let server: FakeProviderServer;
let provider: MercadoPagoPaymentProvider;

beforeAll(async () => {
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

const settlementCase = (
    tx: Parameters<typeof startSettlementSuccession>[0],
    options: { complement?: boolean; courtesy?: boolean } = {}
) =>
    startSettlementSuccession(tx, {
        provider,
        clock,
        approve: async (authorizationId) => {
            await fake.approve({ authorizationId });
        },
        ...options
    });

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
            const ids = await settlementCase(tx, { complement: true });
            const oldId = ids.predecessorAuthorizationId;
            const successorId = ids.successorAuthorizationId;
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
                        notice.template === 'billing.succession-predecessor-cancel' &&
                        (notice.payload as { subscriptionId?: string }).subscriptionId ===
                            ids.predecessor.id
                )
            ).toHaveLength(1);
        });
    });

    it('(b) leaves the old subscription and authorization alive when checkout is abandoned', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await settlementCase(tx);
            const oldId = ids.predecessorAuthorizationId;
            server.mercadoPagoDeliveries({ webhookSecret });
            clock.advance({ ms: 4 * 24 * 60 * 60 * 1000 });
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
            const ids = await settlementCase(tx);
            const oldId = ids.predecessorAuthorizationId;
            await fake.cancel({ authorizationId: oldId });
            const successorId = ids.successorAuthorizationId;
            server.mercadoPagoDeliveries({ webhookSecret });
            expect((await deliverAuthorization(successorId)).status).toBe(200);
            expect((await readCloseCase(tx, ids)).predecessor?.status).toBe('CANCELLED');
            expect(oldCancelCalls(oldId)).toHaveLength(0);
        });
    });

    it('(e) reissues courtesy after S17 closes a live predecessor', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await settlementCase(tx, { courtesy: true });
            const successorId = ids.successorAuthorizationId;
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
            const ids = await settlementCase(tx, { courtesy: true });
            const oldId = ids.predecessorAuthorizationId;
            const successorId = ids.successorAuthorizationId;
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
            expect(oldCancelCalls(oldId)).toHaveLength(1);
            const second = await subscriptionSuccessionReevaluationJob.handler(context());
            expect(second.success).toBe(true);
            expect(second.details).toMatchObject({ selected: 0 });
            expect(oldCancelCalls(oldId)).toHaveLength(1);
        });
    });

    it('reissues courtesy when the predecessor already closed itself before activation', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await settlementCase(tx, { courtesy: true });
            const scheduled = await cancelActiveSubscription(
                {
                    actor: { id: ids.userId, roles: [], permissions: [] },
                    subscriptionId: ids.predecessor.id
                },
                {
                    provider,
                    clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    complements: {
                        addonPolicy: async () => {
                            throw new Error('unexpected addon policy');
                        },
                        listing: async () => {
                            throw new Error('unexpected listing');
                        }
                    }
                }
            );
            if (scheduled.outcome !== 'SCHEDULED') throw new Error('S11 did not schedule');
            const ended = await applyS12ToPrincipal(
                { tx, subscriptionId: ids.predecessor.id, now: scheduled.serviceEndsAt },
                {
                    clock,
                    successionCloser: getSuccessionCloser(),
                    orphanhood: {
                        addonPolicy: async () => {
                            throw new Error('unexpected addon policy');
                        },
                        listing: async () => {
                            throw new Error('unexpected listing');
                        }
                    }
                }
            );
            expect(ended.outcome).toBe('CANCELLED');
            const successorId = ids.successorAuthorizationId;
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
