import { emailOutbox, eq, payments, subscriptions } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { graceFixture } from './support/grace-fixtures.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);

const DAY_MS = 86_400_000;
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const webhookUrl =
    'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=grace';

async function subjectSubscription(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('Grace test subscription disappeared');
    return row;
}

async function subjectPayment(chargeId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    if (!row) throw new Error('Grace test payment fact disappeared');
    return row;
}

async function subjectGraceMail(userId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter((row) => row.template === 'billing.grace-started');
}

async function rejectedCycle(fixture: Awaited<ReturnType<typeof graceFixture>>) {
    return fixture.provider.failChargeCycle({
        authorizationId: fixture.started.authorizationId,
        declineReason: 'issuer_declined'
    });
}

function recordPorts(
    fixture: Awaited<ReturnType<typeof graceFixture>>,
    options: { readonly omitPlanPolicy?: boolean } = {}
) {
    return {
        provider: fixture.provider,
        clock: fixture.clock,
        beforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        ...(options.omitPlanPolicy ? {} : { planPolicy: fixture.planPolicy })
    };
}

describe('TEST:B7:1 grace entry through a rejected-charge notice', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — starts the clock at the delayed by-id read and keeps payment pending',
        async () => {
            const fixture = await graceFixture({ graceDays: 7 });
            const { chargeId } = await rejectedCycle(fixture);
            const chargeRead = await fixture.provider.readCharge({ chargeId });
            const chargeCreatedAt = new Date(chargeRead.snapshot.createdAt);
            fixture.clock.advance({ ms: 3 * DAY_MS });
            const readAt = fixture.clock.now();
            const readCharge = vi.spyOn(fixture.provider, 'readCharge');

            const result = await recordChargeFact({ chargeId }, recordPorts(fixture));
            expect(readCharge).toHaveBeenCalledTimes(2);
            expect(result.outcome).toBe('GRACE');
            if (result.outcome !== 'GRACE') throw new Error('Expected grace transition result');
            if (result.grace.outcome !== 'GRACE_STARTED')
                throw new Error('Expected S4 to start the grace clock');
            expect(result.grace).toMatchObject({
                outcome: 'GRACE_STARTED',
                subscriptionId: fixture.started.subscriptionId,
                graceStartedAt: readAt,
                graceEndsAt: new Date(readAt.getTime() + 7 * DAY_MS)
            });
            expect(result.grace.graceStartedAt).not.toEqual(chargeCreatedAt);
            const row = await subjectSubscription(fixture.started.subscriptionId);
            expect(row).toMatchObject({
                status: 'GRACE_PERIOD',
                graceStartedAt: readAt,
                graceEndsAt: new Date(readAt.getTime() + 7 * DAY_MS)
            });
            expect((await subjectPayment(chargeId)).status).toBe('PENDING');
            const mails = await subjectGraceMail(fixture.user.id);
            expect(mails).toHaveLength(1);
            expect(mails[0]?.payload).toMatchObject({
                subscriptionId: fixture.started.subscriptionId,
                vertical: 'accommodation',
                graceEndsAt: new Date(readAt.getTime() + 7 * DAY_MS).toISOString()
            });
            expect(fixture.planPolicy).toHaveBeenCalledWith({
                planVersionId: row.planVersionId
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — a rejected retry stays in grace without moving its clock or duplicating notice',
        async () => {
            const fixture = await graceFixture({ graceDays: 7 });
            const { chargeId } = await rejectedCycle(fixture);
            const initialRead = await fixture.provider.readCharge({ chargeId });
            const startedAt = fixture.clock.now();
            const first = await recordChargeFact({ chargeId }, recordPorts(fixture));
            expect(first).toMatchObject({ outcome: 'GRACE', grace: { outcome: 'GRACE_STARTED' } });
            const beforeRetry = await subjectSubscription(fixture.started.subscriptionId);
            const expiresAt = initialRead.snapshot.expiresAt;
            expect(expiresAt).not.toBeNull();
            const retryAt =
                Date.parse(initialRead.snapshot.createdAt) +
                (Date.parse(expiresAt as string) - Date.parse(initialRead.snapshot.createdAt)) / 4;
            fixture.clock.advance({ ms: retryAt - fixture.clock.now().getTime() + 1 });

            const retry = await recordChargeFact({ chargeId }, recordPorts(fixture));
            expect(retry).toMatchObject({
                outcome: 'GRACE',
                grace: {
                    outcome: 'ALREADY_IN_GRACE',
                    subscriptionId: fixture.started.subscriptionId
                }
            });
            const afterRetry = await subjectSubscription(fixture.started.subscriptionId);
            expect(afterRetry.graceStartedAt).toEqual(beforeRetry.graceStartedAt);
            expect(afterRetry.graceEndsAt).toEqual(beforeRetry.graceEndsAt);
            expect(afterRetry.graceStartedAt).toEqual(startedAt);
            expect(await subjectGraceMail(fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — without a credited payment S16 declines the first charge and leaves no grace clock',
        async () => {
            const fixture = await paymentFixture();
            const { chargeId } = await fixture.provider.declineCharge({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const result = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    payments: creditedPaymentsFromLedger,
                    planPolicy: async () => ({
                        graceDays: 7,
                        allowsPause: false,
                        current: true,
                        sellable: true
                    })
                }
            );
            expect(result).toMatchObject({ outcome: 'DECLINED', decline: { outcome: 'DECLINED' } });
            const row = await subjectSubscription(fixture.started.subscriptionId);
            expect(row.status).toBe('CHARGE_DECLINED');
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            expect(await subjectGraceMail(fixture.user.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — fails visibly when planPolicy is absent and leaves the row ACTIVE',
        async () => {
            const fixture = await graceFixture({ graceDays: 7 });
            const { chargeId } = await rejectedCycle(fixture);
            await expect(
                recordChargeFact({ chargeId }, recordPorts(fixture, { omitPlanPolicy: true }))
            ).rejects.toMatchObject({ reason: 'PLAN_POLICY_NOT_REGISTERED' });
            expect((await subjectSubscription(fixture.started.subscriptionId)).status).toBe(
                'ACTIVE'
            );
            expect((await subjectPayment(chargeId)).status).toBe('PENDING');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — a rejection before an already credited period runs neither S4 nor S16',
        async () => {
            const fixture = await graceFixture({ graceDays: 7 });
            const rejected = await rejectedCycle(fixture);
            const rejectedRead = await fixture.provider.readCharge({ chargeId: rejected.chargeId });
            fixture.clock.advance({ ms: DAY_MS });
            const laterCharge = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            fixture.clock.advance({ ms: 2 * 60 * 60 * 1000 });
            const laterCredit = await recordChargeFact(
                { chargeId: laterCharge.chargeId },
                recordPorts(fixture)
            );
            expect(laterCredit.outcome).toBe('CREDITED');
            const readCharge = vi.spyOn(fixture.provider, 'readCharge');

            const result = await recordChargeFact(
                { chargeId: rejected.chargeId },
                recordPorts(fixture)
            );
            expect(result).toMatchObject({
                outcome: 'GRACE',
                grace: { outcome: 'NOT_APPLICABLE', reason: 'NOT_CURRENT_PERIOD' }
            });
            expect(readCharge).toHaveBeenCalledTimes(2);
            expect(rejectedRead.snapshot.createdAt).not.toBe(
                (await subjectPayment(laterCharge.chargeId)).factAt.toISOString()
            );
            expect((await subjectSubscription(fixture.started.subscriptionId)).status).toBe(
                'ACTIVE'
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — provider pause near expiry is delegated as arrears, not as a local pause',
        async () => {
            const fixture = await graceFixture({ graceDays: 7 });
            fixture.provider.takeDeliveries();
            const { chargeId } = await rejectedCycle(fixture);
            const chargeRead = await fixture.provider.readCharge({ chargeId });
            const result = await recordChargeFact({ chargeId }, recordPorts(fixture));
            expect(result).toMatchObject({ outcome: 'GRACE', grace: { outcome: 'GRACE_STARTED' } });
            const expiresAt = chargeRead.snapshot.expiresAt;
            expect(expiresAt).not.toBeNull();
            fixture.clock.advance({
                ms: Date.parse(expiresAt as string) - 90_000 - fixture.clock.now().getTime()
            });
            const deliveries = fixture.provider.takeDeliveries().deliveries;
            const authorizationDelivery: NoticeDelivery | undefined = await (async () => {
                for (const delivery of deliveries) {
                    const notice = await fixture.provider.decodeNotice(delivery);
                    if (notice.resourceKind === 'authorization') return delivery;
                }
                return undefined;
            })();
            expect(authorizationDelivery).toBeDefined();
            const delegate = vi.fn(async () => undefined);
            const noticeResult = await receiveProviderDelivery(
                { url: webhookUrl, delivery: authorizationDelivery as NoticeDelivery },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    payments: creditedPaymentsFromLedger,
                    planPolicy: fixture.planPolicy,
                    delegates: { delegate }
                }
            );
            expect(noticeResult).toMatchObject({ ack: 'OK', outcome: 'DELEGATED' });
            expect(delegate).toHaveBeenCalledWith({
                pair: 'PROVIDER_PAUSE_IS_ARREARS',
                subscriptionId: fixture.started.subscriptionId,
                readAt: fixture.clock.now(),
                cancelledSeenAt: null
            });
            expect((await subjectSubscription(fixture.started.subscriptionId)).status).toBe(
                'GRACE_PERIOD'
            );
            const pauseTable = await getServiceTestPool().query<{ table_name: string | null }>(
                "SELECT to_regclass('public.subscription_pause')::text AS table_name"
            );
            if (pauseTable.rows[0]?.table_name) {
                const pauses = await getServiceTestPool().query<{ count: string }>(
                    'SELECT count(*) FROM subscription_pause WHERE subscription_id = $1',
                    [fixture.started.subscriptionId]
                );
                expect(pauses.rows[0]?.count).toBe('0');
            }
        }
    );
});
