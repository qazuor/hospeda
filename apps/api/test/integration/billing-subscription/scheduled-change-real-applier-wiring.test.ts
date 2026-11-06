import {
    and,
    type DrizzleClient,
    domainEvent,
    eq,
    manualPayments,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { PermissionEnum } from '@repo/schemas';
import {
    activateSubscription,
    creditedPaymentsFromLedger,
    recordChargeFact,
    startSubscription
} from '@repo/service-core';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    seedCoveragePlanVersion,
    seedCoverageUser
} from '../../../../../packages/service-core/test/integration/services/support/coverage-fixtures';
import { initApp } from '../../../src/app';
import { manualInstallmentOpenJob } from '../../../src/cron/jobs/manual-installment-open.job';
import type { CronJobContext } from '../../../src/cron/types';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, clock, fake, NOW, seedManualRoute } from './manual-payment-route-fixtures';
import { withCompositionRollback } from './succession-wiring-fixtures';

let app: ReturnType<typeof initApp>;
const webhookSecret = 'b8b24-wiring-test-secret';

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
afterAll(() => testDb.teardown());

/** A destination version and a queue entry on a row seeded by this test. */
async function queueChange(tx: DrizzleClient, subscriptionId: string) {
    const [source] = await tx
        .select({ vertical: subscriptions.vertical })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!source?.vertical) throw new Error('Missing subscription vertical');
    const target = await seedCoveragePlanVersion(tx, source.vertical);
    await tx.insert(subscriptionScheduledChanges).values({
        subscriptionId,
        targetPlanVersionId: target.planVersionId,
        targetBillingOptionId: target.billingOptionId,
        effectiveAt: new Date(NOW.getTime() - 86_400_000)
    });
    return target;
}

async function stateOf(tx: DrizzleClient, subscriptionId: string) {
    const [row] = await tx.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    const queue = await tx
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
    const events = await tx
        .select()
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'subscription.scheduled_change_applied')
            )
        );
    return { row, queue, events };
}

describe('TEST:B8b:24 real S38 composition', () => {
    it('webhook S7 applies an overdue change on a suspended card row', async () => {
        await withCompositionRollback(async (tx) => {
            const cardClock = createAdjustableClock({
                start: new Date('2026-10-01T03:00:00.000Z')
            });
            const provider = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: cardClock,
                honestAbout: [
                    { lie: 'M1', why: 'the fixture needs a created authorization' },
                    { lie: 'M8', why: 'the fixture needs an approved first charge' }
                ],
                withoutBehaviour: [{ behaviour: 'RP12', why: 'subscription billing fixture' }]
            });
            const server = await startFakeProviderServer({ provider, clock: cardClock });
            const httpProvider = new MercadoPagoPaymentProvider({
                clock: cardClock,
                baseUrl: server.url,
                accessToken: 'test-token'
            });
            injectClock({ clock: cardClock });
            injectPaymentProvider({ provider: httpProvider });
            const webhookApp = initApp({ clock: cardClock, paymentProvider: httpProvider });
            const user = await seedCoverageUser(tx);
            const source = await seedCoveragePlanVersion(tx, 'accommodation');
            const ports = {
                provider,
                clock: cardClock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                touristVipInheritance: { inherits: async () => false },
                payments: creditedPaymentsFromLedger,
                planPolicy: async () => ({
                    graceDays: 7,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            };
            const started = await startSubscription(
                {
                    userId: user.userId,
                    billingOptionId: source.billingOptionId,
                    returnUrl: 'https://example.test/return'
                },
                ports
            );
            await provider.approve({ authorizationId: started.authorizationId });
            await activateSubscription(started.subscriptionId, ports);
            provider.takeDeliveries();
            const firstCharge = await provider.charge({
                authorizationId: started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: started.subscriptionId
            });
            const firstRecorded = await recordChargeFact({ chargeId: firstCharge.chargeId }, ports);
            expect(firstRecorded.outcome).toBe('CREDITED');
            cardClock.advance({ ms: 31 * 86_400_000 });
            const { chargeId } = await provider.failChargeCycle({
                authorizationId: started.authorizationId,
                declineReason: 'issuer_declined',
                approveOnAttempt: 2
            });
            const declined = await recordChargeFact({ chargeId }, ports);
            expect(declined.outcome).toBe('GRACE');
            server.mercadoPagoDeliveries({ webhookSecret });
            await tx
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, started.subscriptionId));
            const target = await queueChange(tx, started.subscriptionId);
            const read = await provider.readCharge({ chargeId });
            const createdAt = Date.parse(read.snapshot.createdAt);
            const expiresAt = Date.parse(read.snapshot.expiresAt ?? read.snapshot.createdAt);
            cardClock.advance({
                ms: Math.max(0, createdAt + (expiresAt - createdAt) / 4 - cardClock.now().getTime())
            });
            expect((await provider.readCharge({ chargeId })).snapshot.status).toBe('approved');
            cardClock.advance({ ms: FAKE_NOTICE_DELAY_MS });
            const seen: string[] = [];
            const unsubscribe = getCoverageNotices().onCoverageChanged((event) => {
                if (event.userId === user.userId) seen.push(event.change);
            });
            try {
                const delivery = server
                    .mercadoPagoDeliveries({ webhookSecret })
                    .deliveries.find(
                        (candidate) =>
                            new URLSearchParams(candidate.query).get('data.id') === chargeId
                    );
                if (!delivery) throw new Error('Missing approved charge delivery');
                const response = await webhookApp.request(
                    `/api/v1/webhooks/mercadopago?${delivery.query}`,
                    {
                        method: 'POST',
                        headers: {
                            ...delivery.headers,
                            'user-agent': delivery.headers['user-agent'] ?? 'vitest'
                        },
                        body: delivery.body
                    }
                );
                const state = await stateOf(tx, started.subscriptionId);
                expect(response.status).toBe(200);
                expect(state.row).toMatchObject({
                    status: 'ACTIVE',
                    planVersionId: target.planVersionId,
                    billingOptionId: target.billingOptionId
                });
                expect(state.queue).toHaveLength(0);
                expect(state.events).toHaveLength(1);
                expect(seen.filter((change) => change === 'CHANGED')).toHaveLength(1);
            } finally {
                unsubscribe();
                await server.close();
                injectClock({ clock });
                injectPaymentProvider({ provider: fake });
            }
        });
    });

    it('MP5 opens the installment on the destination version', async () => {
        await withCompositionRollback(async (tx) => {
            const seeded = await seedManualRoute({ status: 'ACTIVE' });
            await tx.delete(manualPayments).where(eq(manualPayments.id, seeded.installment.id));
            await tx
                .update(subscriptions)
                .set({ nextChargeAt: new Date(NOW.getTime() - 2 * 86_400_000) })
                .where(eq(subscriptions.id, seeded.subscription.id));
            const target = await queueChange(tx, seeded.subscription.id);
            const context: CronJobContext = {
                logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
                startedAt: NOW,
                runId: crypto.randomUUID(),
                correlationId: crypto.randomUUID(),
                dryRun: false
            };
            const result = await manualInstallmentOpenJob.handler(context);
            const state = await stateOf(tx, seeded.subscription.id);
            expect(result.success).toBe(true);
            expect(state.row).toMatchObject({
                planVersionId: target.planVersionId,
                billingOptionId: target.billingOptionId
            });
            expect(state.queue).toHaveLength(0);
            expect(state.events).toHaveLength(1);
            expect(
                await tx
                    .select()
                    .from(manualPayments)
                    .where(eq(manualPayments.subscriptionId, seeded.subscription.id))
            ).toMatchObject([{ subscriptionId: seeded.subscription.id }]);
        });
    });

    it('manual S7 applies the destination and emits CHANGED once', async () => {
        await withCompositionRollback(async (tx) => {
            const seeded = await seedManualRoute({
                status: 'SUSPENDED',
                installmentStatus: 'DECLARED_UNPAID'
            });
            const target = await queueChange(tx, seeded.subscription.id);
            const seen: string[] = [];
            const unsubscribe = getCoverageNotices().onCoverageChanged((event) => {
                if (event.userId === seeded.payer.id) seen.push(event.change);
            });
            try {
                const response = await app.request(
                    `/api/v1/admin/billing-subscription/${seeded.subscription.id}/manual-payments/${seeded.installment.id}/register-late`,
                    {
                        method: 'POST',
                        headers: actorHeaders(seeded.admin.id, [
                            PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT
                        ]),
                        body: JSON.stringify({ proofRef: 'test-b8b-24' })
                    }
                );
                const state = await stateOf(tx, seeded.subscription.id);
                expect(response.status).toBe(200);
                expect(state.row).toMatchObject({
                    status: 'ACTIVE',
                    planVersionId: target.planVersionId,
                    billingOptionId: target.billingOptionId
                });
                expect(state.queue).toHaveLength(0);
                expect(state.events).toHaveLength(1);
                expect(seen.filter((change) => change === 'CHANGED')).toHaveLength(1);
            } finally {
                unsubscribe();
            }
        });
    });
});
