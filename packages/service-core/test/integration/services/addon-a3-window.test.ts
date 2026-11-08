import {
    addonInstances,
    domainEvent,
    emailOutbox,
    eq,
    payments,
    providerLinks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { expireAddonAuthorizationWindows } from '../../../src/services/billing/addon/expire-addon-authorization-windows.service';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { sendOneTimeOrder } from '../../../src/services/billing/addon/send-one-time-order.service';
import { retryOurCancellation } from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const HOUR = 3_600_000;
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:5 AC:B10:4 A3 only confirms expired addon purchases', () => {
    async function setup(chargeKind: 'UNA_VEZ' | 'PERIODICO' = 'UNA_VEZ') {
        const f = await purchaseFixture({ chargeKind });
        await payingPrincipal(f);
        const request = f.input();
        const bought = await purchaseAddon(request, f.ports);
        if (bought.outcome !== 'CREATED') throw new Error(`Purchase returned ${bought.outcome}`);
        const ports = {
            ...f.ports,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
            coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) }
        };
        const row = async () => {
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            if (!instance) throw new Error('Instance missing');
            return instance;
        };
        return {
            f,
            request,
            bought,
            ports,
            row,
            expire: () => expireAddonAuthorizationWindows(100, ports),
            advance: async () =>
                f.advanceTo(new Date((await row()).createdAt.getTime() + 73 * HOUR))
        };
    }

    it.skipIf(!isServiceTestDbAvailable())(
        'without order id abandons with zero creation or search calls',
        async () => {
            const s = await setup();
            await s.advance();
            const charge = vi.spyOn(s.f.fake, 'chargeOnce');
            const search = vi.spyOn(s.f.fake, 'searchOrders');
            const result = await s.expire();
            expect(result).toMatchObject({ abandoned: 1, activated: 0, failed: 0 });
            expect((await s.row()).status).toBe('ABANDONED');
            expect(charge).toHaveBeenCalledTimes(0);
            expect(search).toHaveBeenCalledTimes(0);
            expect(s.f.fake.ordersFor({ reference: s.request.orderRequestId })).toEqual({
                orders: 0,
                paid: 0
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'approved stored order runs A2 with its payment',
        async () => {
            const s = await setup();
            await sendOneTimeOrder(
                {
                    orderRequestId: s.request.orderRequestId,
                    payerEmail: 'payer@example.test',
                    payment: { token: `card-${crypto.randomUUID()}`, brand: 'visa', kind: 'credit' }
                },
                s.f.ports
            );
            await s.advance();
            expect(await s.expire()).toMatchObject({ activated: 1, abandoned: 0, failed: 0 });
            expect((await s.row()).status).toBe('ACTIVE');
            const rows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.addonInstanceId, s.bought.instanceId));
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                status: 'SUCCEEDED',
                addonInstanceId: s.bought.instanceId
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'unapproved stored order abandons and keeps its order id',
        async () => {
            const s = await setup();
            const token = `card-${crypto.randomUUID()}`;
            s.f.fake.declineOrderPayments({ paymentToken: token });
            await sendOneTimeOrder(
                {
                    orderRequestId: s.request.orderRequestId,
                    payerEmail: 'payer@example.test',
                    payment: { token, brand: 'visa', kind: 'credit' }
                },
                s.f.ports
            );
            const orderId = (await s.row()).providerOrderId;
            await s.advance();
            expect(await s.expire()).toMatchObject({ abandoned: 1, activated: 0 });
            expect(await s.row()).toMatchObject({ status: 'ABANDONED', providerOrderId: orderId });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'failed order read defers, then the next run resolves',
        async () => {
            const s = await setup();
            await sendOneTimeOrder(
                {
                    orderRequestId: s.request.orderRequestId,
                    payerEmail: 'payer@example.test',
                    payment: { token: `card-${crypto.randomUUID()}`, brand: 'visa', kind: 'credit' }
                },
                s.f.ports
            );
            await s.advance();
            const read = vi
                .spyOn(s.f.fake, 'readOrder')
                .mockRejectedValueOnce(new Error('offline'));
            expect(await s.expire()).toMatchObject({ deferred: 1, abandoned: 0 });
            expect((await s.row()).status).toBe('PENDING_AUTHORIZATION');
            read.mockRestore();
            expect(await s.expire()).toMatchObject({ activated: 1 });
            expect((await s.row()).status).toBe('ACTIVE');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'authorized recurring addon runs A2 without cancelling',
        async () => {
            const s = await setup('PERIODICO');
            const instance = await s.row();
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, instance.complementSubscriptionId!));
            if (!link) throw new Error('Link missing');
            await s.f.fake.approve({ authorizationId: link.providerId });
            const cancel = vi.spyOn(s.f.fake, 'cancel');
            await s.advance();
            expect(await s.expire()).toMatchObject({ activated: 1, abandoned: 0 });
            expect((await s.row()).status).toBe('ACTIVE');
            const [complement] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, instance.complementSubscriptionId!));
            expect(complement?.status).toBe('ACTIVE');
            expect(cancel).toHaveBeenCalledTimes(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'recurring creation without a provider link abandons without a call',
        async () => {
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            await payingPrincipal(f);
            const request = f.input();
            const authorize = vi
                .spyOn(f.fake, 'authorize')
                .mockRejectedValueOnce(new Error('creation unanswered'));
            await expect(purchaseAddon(request, f.ports)).rejects.toThrow('creation unanswered');
            authorize.mockRestore();
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, request.orderRequestId));
            if (!instance?.complementSubscriptionId)
                throw new Error('Committed complement missing');
            const complementId = instance.complementSubscriptionId;
            f.advanceTo(new Date(instance.createdAt.getTime() + 73 * HOUR));
            const read = vi.spyOn(f.fake, 'readAuthorization');
            const cancel = vi.spyOn(f.fake, 'cancel');
            const result = await expireAddonAuthorizationWindows(100, {
                ...f.ports,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) }
            });
            expect(result).toMatchObject({ abandoned: 1, failed: 0 });
            const [closed] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, instance.id));
            const [complement] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, complementId));
            expect(closed?.status).toBe('ABANDONED');
            expect(complement?.status).toBe('ABANDONED');
            expect(read).toHaveBeenCalledTimes(0);
            expect(cancel).toHaveBeenCalledTimes(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'pending recurring addon queues its own notice before cancel and records A3',
        async () => {
            const s = await setup('PERIODICO');
            const instance = await s.row();
            const complementId = instance.complementSubscriptionId!;
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, complementId));
            if (!link) throw new Error('Link missing');
            const realCancel = s.f.fake.cancel.bind(s.f.fake);
            const cancel = vi.spyOn(s.f.fake, 'cancel').mockImplementation(async (input) => {
                const rows = await getServiceTestDb()
                    .select()
                    .from(emailOutbox)
                    .where(eq(emailOutbox.template, 'billing.addon-authorization-expired-cancel'));
                expect(
                    rows.some(
                        (row) =>
                            row.payload &&
                            typeof row.payload === 'object' &&
                            'subscriptionId' in row.payload &&
                            row.payload.subscriptionId === complementId
                    )
                ).toBe(true);
                return realCancel(input);
            });
            await s.advance();
            expect(await s.expire()).toMatchObject({ abandoned: 1, failed: 0 });
            expect((await s.row()).status).toBe('ABANDONED');
            const [complement] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, complementId));
            expect(complement?.status).toBe('ABANDONED');
            expect(cancel).toHaveBeenCalledTimes(1);
            const read = await s.f.fake.readAuthorization({ authorizationId: link.providerId });
            expect(read.snapshot.status).toBe('cancelled');
            const events = await getServiceTestDb()
                .select()
                .from(domainEvent)
                .where(eq(domainEvent.entityId, complementId));
            expect(
                events.find(
                    (event) => event.eventType === 'subscription.provider_cancellation_decided'
                )?.reason
            ).toBe('A3');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'pending notice defers cancellation; retry uses the same outbox row',
        async () => {
            const s = await setup('PERIODICO');
            const instance = await s.row();
            const complementId = instance.complementSubscriptionId!;
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, complementId));
            if (!link) throw new Error('Link missing');
            const cancel = vi.spyOn(s.f.fake, 'cancel');
            s.ports.beforeCancelNotice = outboxBeforeCancelNotice();
            await s.advance();
            expect(await s.expire()).toMatchObject({ abandoned: 1, noticePending: 1 });
            expect(cancel).toHaveBeenCalledTimes(0);
            const [complement] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, complementId));
            if (!complement) throw new Error('Complement missing');
            const [notice] = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.template, 'billing.addon-authorization-expired-cancel'));
            if (!notice) throw new Error('Notice missing');
            await getServiceTestDb()
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.id, notice.id));
            expect(
                await retryOurCancellation(
                    {
                        subscription: complement,
                        providerLink: link,
                        decision: { transition: 'A3', decidedAt: s.f.ports.clock.now() },
                        correlationId: crypto.randomUUID()
                    },
                    {
                        provider: s.f.fake,
                        clock: s.f.ports.clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                    }
                )
            ).toMatchObject({ outcome: 'CONFIRMED' });
            expect(cancel).toHaveBeenCalledTimes(1);
            const notices = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, notice.dedupKey));
            expect(notices).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('does not touch a window still open', async () => {
        const s = await setup();
        expect(await s.expire()).toMatchObject({ examined: 0, abandoned: 0 });
        expect((await s.row()).status).toBe('PENDING_AUTHORIZATION');
    });
});
