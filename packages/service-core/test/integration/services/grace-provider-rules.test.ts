import {
    emailOutbox,
    eq,
    providerLinks,
    reconciliationInventoryModel,
    subscriptions
} from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FakePaymentProvider, type FakePaymentProviderOptions } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import {
    createLostFirstRejectionCheck,
    readPeriodCharges,
    runReconciliationSweep
} from '../../../src/services/index.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { graceFixture } from './support/grace-fixtures.js';

afterAll(closeServiceTestPool);

const webhookUrl =
    'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=provider-rules';
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

async function withOnlySubject<T>(subscriptionId: string, run: () => Promise<T>): Promise<T> {
    const original = reconciliationInventoryModel.listSweepInventoryPage.bind(
        reconciliationInventoryModel
    );
    const spy = vi.spyOn(reconciliationInventoryModel, 'listSweepInventoryPage');
    spy.mockImplementation(async (input) => {
        const rows = await original({ ...input, limit: 10_000 });
        return rows
            .filter(({ subscription }) => subscription.id === subscriptionId)
            .filter(
                ({ subscription }) =>
                    input.afterSubscriptionId === undefined ||
                    subscription.id > input.afterSubscriptionId
            )
            .slice(0, input.limit);
    });
    try {
        return await run();
    } finally {
        spy.mockRestore();
    }
}

async function readForFixture(fixture: Awaited<ReturnType<typeof graceFixture>>) {
    const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
    const read = await fixture.provider.readAuthorization({
        authorizationId: fixture.started.authorizationId
    });
    return { act, read };
}

async function replaceProvider(
    fixture: Awaited<ReturnType<typeof graceFixture>>,
    options: FakePaymentProviderOptions
) {
    const provider = new FakePaymentProvider(options);
    const authorization = await provider.authorize({
        reference: fixture.started.subscriptionId,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'provider rule integration fixture',
        returnUrl: 'https://example.test/return'
    });
    await provider.approve({ authorizationId: authorization.authorizationId });
    await getServiceTestDb()
        .update(providerLinks)
        .set({ providerId: authorization.authorizationId })
        .where(eq(providerLinks.subscriptionId, fixture.started.subscriptionId));
    return {
        ...fixture,
        provider,
        started: { ...fixture.started, authorizationId: authorization.authorizationId }
    };
}

async function runCheckForSubject(fixture: Awaited<ReturnType<typeof graceFixture>>) {
    const [row] = await getServiceTestDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, fixture.started.subscriptionId));
    if (!row) throw new Error('Provider rules fixture disappeared');
    const { act, read } = await readForFixture(fixture);
    await checkFor(fixture)({ ...row, act, read });
}

function checkFor(fixture: Awaited<ReturnType<typeof graceFixture>>) {
    return createLostFirstRejectionCheck({
        provider: fixture.provider,
        clock: fixture.clock,
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy
    });
}

describe('TEST:B7:21 measured provider charge rules determine the current period result', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — RP11 last attempt is later than the last approved charge and does not mean CHARGED',
        async () => {
            const fixture = await graceFixture();
            const priorAuthorization = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            const lastApprovedAt = priorAuthorization.snapshot.lastChargedAt;
            const { chargeId } = await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const rejected = await fixture.provider.readCharge({ chargeId });
            fixture.clock.advance({
                ms:
                    (Date.parse(rejected.snapshot.expiresAt!) -
                        Date.parse(rejected.snapshot.createdAt)) *
                    0.75
            });
            const authorization = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            expect(Date.parse(authorization.snapshot.lastChargedAt!)).toBeGreaterThan(
                Date.parse(lastApprovedAt!)
            );
            const { act, read } = await readForFixture(fixture);
            const result = await readPeriodCharges(
                { authorizationRead: read, act },
                { provider: fixture.provider }
            );
            expect(result).toEqual({ verdict: 'NOT_CHARGED', chargeId });
            await withOnlySubject(fixture.started.subscriptionId, async () => {
                await runReconciliationSweep(
                    {},
                    {
                        provider: fixture.provider,
                        clock: fixture.clock,
                        rowChecks: [checkFor(fixture)]
                    }
                );
            });
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('GRACE_PERIOD');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — RP7 uses expiresAt for the live window; an expired record has no current period',
        async () => {
            const fixture = await graceFixture();
            await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const list = await fixture.provider.listCharges({
                authorizationId: fixture.started.authorizationId
            });
            const declinedRead = await fixture.provider.readCharge({
                chargeId: list.chargeIds.at(-1)!
            });
            const within = await readForFixture(fixture);
            expect(
                await readPeriodCharges(
                    { authorizationRead: within.read, act: within.act },
                    { provider: fixture.provider }
                )
            ).toMatchObject({ verdict: 'NOT_CHARGED', chargeId: declinedRead.snapshot.chargeId });

            const liveFixture = await graceFixture();
            await liveFixture.provider.failChargeCycle({
                authorizationId: liveFixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            await runCheckForSubject(liveFixture);
            const liveRow = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, liveFixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(liveRow?.status).toBe('GRACE_PERIOD');

            fixture.clock.advance({
                ms: Date.parse(declinedRead.snapshot.expiresAt!) - fixture.clock.now().getTime()
            });
            const expired = await readForFixture(fixture);
            expect(
                await readPeriodCharges(
                    { authorizationRead: expired.read, act: expired.act },
                    { provider: fixture.provider }
                )
            ).toEqual({ verdict: 'NO_CURRENT_PERIOD' });
            await withOnlySubject(fixture.started.subscriptionId, async () => {
                await runReconciliationSweep(
                    {},
                    {
                        provider: fixture.provider,
                        clock: fixture.clock,
                        rowChecks: [checkFor(fixture)]
                    }
                );
            });
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('ACTIVE');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — RP8 keeps four attempts in one record and delegates the provider pause at expiry',
        async () => {
            const fixture = await graceFixture();
            fixture.provider.takeDeliveries();
            const { chargeId } = await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const listed = await fixture.provider.listCharges({
                authorizationId: fixture.started.authorizationId
            });
            expect(listed.chargeIds.filter((id) => id === chargeId)).toHaveLength(1);
            const charge = await fixture.provider.readCharge({ chargeId });
            fixture.clock.advance({
                ms: Date.parse(charge.snapshot.expiresAt!) - fixture.clock.now().getTime()
            });
            const pausedRead = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            expect(pausedRead.snapshot.status).toBe('paused');
            const afterRetries = await fixture.provider.listCharges({
                authorizationId: fixture.started.authorizationId
            });
            expect(afterRetries.chargeIds.filter((id) => id === chargeId)).toHaveLength(1);
            const deliveries = fixture.provider.takeDeliveries().deliveries;
            let authorizationDelivery: NoticeDelivery | undefined;
            for (const delivery of deliveries) {
                const notice = await fixture.provider.decodeNotice(delivery);
                if (notice.resourceKind === 'authorization') authorizationDelivery = delivery;
            }
            expect(authorizationDelivery).toBeDefined();
            const delegate = vi.fn(async () => undefined);
            const result = await receiveProviderDelivery(
                { url: webhookUrl, delivery: authorizationDelivery! },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    payments: creditedPaymentsFromLedger,
                    planPolicy: fixture.planPolicy,
                    delegates: { delegate }
                }
            );
            expect(result).toMatchObject({ ack: 'OK', outcome: 'DELEGATED' });
            expect(delegate).toHaveBeenCalledWith({
                pair: 'PROVIDER_PAUSE_IS_ARREARS',
                subscriptionId: fixture.started.subscriptionId
            });
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('ACTIVE');
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
            const expired = await readForFixture(fixture);
            expect(
                await readPeriodCharges(
                    { authorizationRead: expired.read, act: expired.act },
                    { provider: fixture.provider }
                )
            ).toEqual({ verdict: 'NO_CURRENT_PERIOD' });
            await withOnlySubject(fixture.started.subscriptionId, async () => {
                await runReconciliationSweep(
                    {},
                    {
                        provider: fixture.provider,
                        clock: fixture.clock,
                        rowChecks: [checkFor(fixture)]
                    }
                );
            });
            const afterSweep = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(afterSweep?.status).toBe('ACTIVE');
            const mails = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mails.filter((mail) => mail.template === 'billing.grace-started')).toHaveLength(
                0
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — with only RP7 disabled, a rejected period without an expiry stays current and starts grace',
        async () => {
            const fixture = await graceFixture();
            const switched = await replaceProvider(fixture, {
                clock: fixture.clock,
                idNamespace: crypto.randomUUID(),
                withoutBehaviour: [
                    {
                        behaviour: 'RP7',
                        why: 'prove the current-period decision tolerates providers without expiry dates'
                    }
                ]
            });
            const { chargeId } = await switched.provider.failChargeCycle({
                authorizationId: switched.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const charge = await switched.provider.readCharge({ chargeId });
            expect(charge.snapshot.expiresAt).toBeNull();
            const { act, read } = await readForFixture(switched);
            expect(
                await readPeriodCharges(
                    { authorizationRead: read, act },
                    { provider: switched.provider }
                )
            ).toEqual({ verdict: 'NOT_CHARGED', chargeId });
            await runCheckForSubject(switched);
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, switched.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('GRACE_PERIOD');

            const approvedFixture = await graceFixture();
            const approved = await replaceProvider(approvedFixture, {
                clock: approvedFixture.clock,
                idNamespace: crypto.randomUUID(),
                withoutBehaviour: [
                    {
                        behaviour: 'RP7',
                        why: 'approved first charge must remain readable without an expiry date'
                    }
                ]
            });
            await approved.provider.charge({
                authorizationId: approved.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: approved.started.subscriptionId
            });
            approved.clock.advance({ ms: 60 * 60 * 1000 });
            const approvedRead = await readForFixture(approved);
            expect(
                await readPeriodCharges(
                    { authorizationRead: approvedRead.read, act: approvedRead.act },
                    { provider: approved.provider }
                )
            ).toMatchObject({ verdict: 'CHARGED' });
            await runCheckForSubject(approved);
            const approvedRow = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, approved.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(approvedRow?.status).toBe('ACTIVE');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — with only RP8 disabled, the final rejected record still starts grace and first approval stays ACTIVE',
        async () => {
            const fixture = await graceFixture();
            const switched = await replaceProvider(fixture, {
                clock: fixture.clock,
                idNamespace: crypto.randomUUID(),
                withoutBehaviour: [
                    {
                        behaviour: 'RP8',
                        why: 'prove one final rejected cycle needs no retries or provider pause'
                    }
                ]
            });
            const { chargeId } = await switched.provider.failChargeCycle({
                authorizationId: switched.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const listed = await switched.provider.listCharges({
                authorizationId: switched.started.authorizationId
            });
            expect(listed.chargeIds.filter((id) => id === chargeId)).toHaveLength(1);
            const rejected = await switched.provider.readCharge({ chargeId });
            const { act, read } = await readForFixture(switched);
            expect(
                await readPeriodCharges(
                    { authorizationRead: read, act },
                    { provider: switched.provider }
                )
            ).toEqual({ verdict: 'NOT_CHARGED', chargeId });
            await runCheckForSubject(switched);
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, switched.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('GRACE_PERIOD');
            fixture.clock.advance({
                ms: Date.parse(rejected.snapshot.expiresAt!) - fixture.clock.now().getTime()
            });
            expect(
                (
                    await switched.provider.readAuthorization({
                        authorizationId: switched.started.authorizationId
                    })
                ).snapshot.status
            ).toBe('active');

            const approvedFixture = await graceFixture();
            const approved = await replaceProvider(approvedFixture, {
                clock: approvedFixture.clock,
                idNamespace: crypto.randomUUID(),
                withoutBehaviour: [
                    {
                        behaviour: 'RP8',
                        why: 'first-attempt approval must not depend on retry behavior'
                    }
                ]
            });
            await approved.provider.charge({
                authorizationId: approved.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: approved.started.subscriptionId
            });
            approved.clock.advance({ ms: 60 * 60 * 1000 });
            const approvedRead = await readForFixture(approved);
            expect(
                await readPeriodCharges(
                    { authorizationRead: approvedRead.read, act: approvedRead.act },
                    { provider: approved.provider }
                )
            ).toMatchObject({ verdict: 'CHARGED' });
            await runCheckForSubject(approved);
            const approvedRow = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, approved.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(approvedRow?.status).toBe('ACTIVE');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — with only RP11 disabled, rejected attempts do not move lastChargedAt and grace still starts',
        async () => {
            const fixture = await graceFixture();
            const switched = await replaceProvider(fixture, {
                clock: fixture.clock,
                idNamespace: crypto.randomUUID(),
                withoutBehaviour: [
                    {
                        behaviour: 'RP11',
                        why: 'prove the decision does not depend on rejected attempts moving lastChargedAt'
                    }
                ]
            });
            const before = await switched.provider.readAuthorization({
                authorizationId: switched.started.authorizationId
            });
            const lastApprovedAt = before.snapshot.lastChargedAt;
            const { chargeId } = await switched.provider.failChargeCycle({
                authorizationId: switched.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            expect(
                (
                    await switched.provider.readAuthorization({
                        authorizationId: switched.started.authorizationId
                    })
                ).snapshot.lastChargedAt
            ).toBe(lastApprovedAt);
            const { act, read } = await readForFixture(switched);
            expect(
                await readPeriodCharges(
                    { authorizationRead: read, act },
                    { provider: switched.provider }
                )
            ).toEqual({ verdict: 'NOT_CHARGED', chargeId });
            await runCheckForSubject(switched);
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, switched.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('GRACE_PERIOD');

            const approvedFixture = await graceFixture();
            const approved = await replaceProvider(approvedFixture, {
                clock: approvedFixture.clock,
                idNamespace: crypto.randomUUID(),
                withoutBehaviour: [
                    {
                        behaviour: 'RP11',
                        why: 'first-attempt approval must still be detected by the charge record'
                    }
                ]
            });
            await approved.provider.charge({
                authorizationId: approved.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: approved.started.subscriptionId
            });
            approved.clock.advance({ ms: 60 * 60 * 1000 });
            const approvedRead = await readForFixture(approved);
            expect(
                await readPeriodCharges(
                    { authorizationRead: approvedRead.read, act: approvedRead.act },
                    { provider: approved.provider }
                )
            ).toMatchObject({ verdict: 'CHARGED' });
            await runCheckForSubject(approved);
            const approvedRow = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, approved.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(approvedRow?.status).toBe('ACTIVE');
        }
    );
});
