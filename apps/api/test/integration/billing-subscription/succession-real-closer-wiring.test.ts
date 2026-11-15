import { eq, providerLinks, subscriptions } from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    closeNow,
    readCloseCase,
    seedCloseCase
} from '../../../../../packages/service-core/test/integration/services/support/succession-close-fixtures';
import { initApp } from '../../../src/app';
import { buildMercadoPagoNoticePorts } from '../../../src/routes/webhooks/mercadopago-ports';
import { getSuccessionCloser } from '../../../src/utils/billing-succession-ports';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './self-cancel-fixtures';
import { withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: closeNow });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'authorization creation must reach the webhook fixture' }]
});
const webhookSecret = 'b8b24-s18-test-secret';
let app: ReturnType<typeof initApp>;
let server: FakeProviderServer;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
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

describe('TEST:B8b:24 real S18 composition', () => {
    it('branch 1 activates a pending successor and closes its retained predecessor', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, {
                successorStatus: 'PENDING_AUTHORIZATION',
                retention: 'OPEN'
            });
            const created = await fake.authorize({
                reference: ids.successor.id,
                amount: { amountMinor: 250000, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'Succession test',
                returnUrl: 'https://example.test/return'
            });
            await tx.insert(providerLinks).values({
                subscriptionId: ids.successor.id,
                provider: 'MERCADO_PAGO',
                providerId: created.authorizationId
            });
            server.mercadoPagoDeliveries({ webhookSecret });
            await fake.approve({ authorizationId: created.authorizationId });
            clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
            const delivery = server
                .mercadoPagoDeliveries({ webhookSecret })
                .deliveries.find(
                    (candidate) =>
                        new URLSearchParams(candidate.query).get('data.id') ===
                        created.authorizationId
                );
            if (!delivery) throw new Error('Missing successor authorization delivery');
            const response = await app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
                method: 'POST',
                headers: {
                    ...delivery.headers,
                    'user-agent': delivery.headers['user-agent'] ?? 'vitest'
                },
                body: delivery.body
            });
            const rows = await readCloseCase(tx, ids);
            expect(response.status).toBe(200);
            expect(rows.predecessor?.succeededById).toBe(ids.successor.id);
            expect(rows.successor?.succeedsId).toBeNull();
            expect(rows.retention).toMatchObject({ releaseReason: 'SUCCESSION_CLOSED' });
            expect(rows.marks).toMatchObject([
                { reason: 'REEMBOLSO_POR_CONFIRMAR', subscriptionId: ids.predecessor.id }
            ]);
            expect(rows.hung).toMatchObject([{ paymentId: ids.paymentId }]);
        });
    });

    it('branch 5 delegates a provider cancellation on grace to the real closer', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, { retention: 'OPEN' });
            await tx
                .update(subscriptions)
                .set({
                    status: 'GRACE_PERIOD',
                    graceStartedAt: new Date('2026-11-01T12:00:00.000Z'),
                    graceEndsAt: new Date('2026-11-20T12:00:00.000Z')
                })
                .where(eq(subscriptions.id, ids.predecessor.id));
            const ports = buildMercadoPagoNoticePorts();
            await ports.delegates.delegate({
                pair: 'CANCELLED_ON_GRACE',
                subscriptionId: ids.predecessor.id,
                readAt: clock.now(),
                cancelledSeenAt: clock.now()
            });
            const rows = await readCloseCase(tx, ids);
            expect(rows.predecessor?.status).toBe('CANCELLED');
            expect(rows.predecessor?.succeededById).toBe(ids.successor.id);
            expect(rows.successor?.succeedsId).toBeNull();
            expect(rows.retention).toMatchObject({ releaseReason: 'SUCCESSION_CLOSED' });
            expect(rows.marks).toMatchObject([{ reason: 'REEMBOLSO_POR_CONFIRMAR' }]);
            expect(rows.hung).toMatchObject([{ paymentId: ids.paymentId }]);
        });
    });

    it('moves a complement and records the remaining courtesy months', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, { complement: true, courtesy: true });
            await getSuccessionCloser().closeSuccession({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const rows = await readCloseCase(tx, ids);
            expect(rows.addon?.targetId).toBe(ids.successor.id);
            expect(rows.grant).toMatchObject({ balanceMonths: 3 });
        });
    });

    it('branch 6 closes the retained predecessor through the owner cancellation route', async () => {
        await withCompositionRollback(async (tx) => {
            const ids = await seedCloseCase(tx, { retention: 'OPEN' });
            await tx
                .update(subscriptions)
                .set({
                    status: 'GRACE_PERIOD',
                    graceStartedAt: new Date('2026-11-01T12:00:00.000Z'),
                    graceEndsAt: new Date('2026-11-20T12:00:00.000Z')
                })
                .where(eq(subscriptions.id, ids.predecessor.id));
            const response = await app.request(
                `/api/v1/protected/billing-subscription/${ids.predecessor.id}/cancellation`,
                {
                    method: 'POST',
                    headers: actorHeaders({ id: ids.userId, role: 'USER', permissions: [] })
                }
            );
            const rows = await readCloseCase(tx, ids);
            expect(response.status).toBe(200);
            expect(rows.predecessor?.status).toBe('CANCELLED');
            expect(rows.predecessor?.succeededById).toBe(ids.successor.id);
            expect(rows.successor?.succeedsId).toBeNull();
            expect(rows.retention).toMatchObject({ releaseReason: 'SUCCESSION_CLOSED' });
            expect(rows.marks).toMatchObject([{ reason: 'REEMBOLSO_POR_CONFIRMAR' }]);
            expect(rows.hung).toMatchObject([{ paymentId: ids.paymentId }]);
        });
    });
});
