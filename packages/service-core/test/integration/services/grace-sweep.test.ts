import {
    emailOutbox,
    eq,
    providerLinks,
    reconciliationInventoryModel,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { readPeriodCharges } from '../../../src/services/billing/reconciliation/period-charges/read-period-charges.js';
import {
    createLostFirstRejectionCheck,
    type ReconciliationComparisonInput,
    runReconciliationSweep
} from '../../../src/services/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceFixture } from './support/grace-fixtures.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);

const DAY_MS = 86_400_000;

async function subject(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('Grace sweep fixture disappeared');
    return row;
}

async function graceMails(userId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter((row) => row.template === 'billing.grace-started');
}

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

function checkPorts(fixture: Awaited<ReturnType<typeof graceFixture>>) {
    return {
        provider: fixture.provider,
        clock: fixture.clock,
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy
    };
}

async function directInput(
    fixture: Awaited<ReturnType<typeof graceFixture>>
): Promise<ReconciliationComparisonInput> {
    const { subscription, providerLink } = await subject(fixture.started.subscriptionId);
    const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
    const read = await fixture.provider.readAuthorization({
        authorizationId: providerLink.providerId
    });
    return { subscription, providerLink, read, act };
}

describe('TEST:B7:1 sweep branch enters grace after a lost first rejection notice', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — enters grace from the sweep read, sends the notice, and ignores the next ACTIVE-only pass',
        async () => {
            const fixture = await graceFixture({ graceDays: 6 });
            const { chargeId } = await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const deliveryBatch = fixture.provider.takeDeliveries();
            expect(deliveryBatch.deliveries.length).toBeGreaterThan(0);
            const firstReadAt = fixture.clock.now();
            const check = createLostFirstRejectionCheck(checkPorts(fixture));
            await withOnlySubject(fixture.started.subscriptionId, async () => {
                await runReconciliationSweep(
                    {},
                    { provider: fixture.provider, clock: fixture.clock, rowChecks: [check] }
                );
            });
            const first = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(first).toMatchObject({
                status: 'GRACE_PERIOD',
                graceStartedAt: firstReadAt,
                graceEndsAt: new Date(firstReadAt.getTime() + 6 * DAY_MS)
            });
            expect(await graceMails(fixture.user.id)).toHaveLength(1);
            const secondRunAt = new Date(firstReadAt.getTime() + DAY_MS);
            fixture.clock.advance({ ms: DAY_MS });
            await withOnlySubject(fixture.started.subscriptionId, async () => {
                await runReconciliationSweep(
                    {},
                    { provider: fixture.provider, clock: fixture.clock, rowChecks: [check] }
                );
            });
            const second = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(second?.graceStartedAt).toEqual(firstReadAt);
            expect(second?.graceEndsAt).toEqual(new Date(firstReadAt.getTime() + 6 * DAY_MS));
            expect(secondRunAt).toEqual(new Date(firstReadAt.getTime() + DAY_MS));
            expect(await graceMails(fixture.user.id)).toHaveLength(1);
            expect(chargeId).toBeTruthy();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — does not enter grace for a first rejected charge without credited history',
        async () => {
            const fixture = await paymentFixture();
            fixture.clock.advance({ ms: 31 * DAY_MS });
            await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const { subscription, providerLink } = await subject(fixture.started.subscriptionId);
            const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
            const read = await fixture.provider.readAuthorization({
                authorizationId: providerLink.providerId
            });
            await createLostFirstRejectionCheck({
                provider: fixture.provider,
                clock: fixture.clock,
                payments: creditedPaymentsFromLedger,
                planPolicy: async () => ({
                    graceDays: 7,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            })({ subscription, providerLink, read, act });
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscription.id))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('ACTIVE');
            expect(row?.graceStartedAt).toBeNull();
            expect(await graceMails(fixture.user.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — treats an incomplete charge list as UNKNOWN and leaves the row ACTIVE',
        async () => {
            const fixture = await graceFixture();
            await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const realProvider = fixture.provider as PaymentProvider;
            const proxy = new Proxy(realProvider, {
                get(target, property, receiver) {
                    if (property === 'listCharges') {
                        return async (input: Parameters<PaymentProvider['listCharges']>[0]) => {
                            const listed = await target.listCharges(input);
                            return { chargeIds: listed.chargeIds.slice(0, -1) };
                        };
                    }
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            const { subscription, providerLink } = await subject(fixture.started.subscriptionId);
            const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
            const read = await proxy.readAuthorization({
                authorizationId: providerLink.providerId
            });
            const result = await readPeriodCharges(
                { authorizationRead: read, act },
                { provider: proxy }
            );
            expect(result).toEqual({ verdict: 'UNKNOWN', reason: 'INCOMPLETE_INVENTORY' });
            await createLostFirstRejectionCheck({
                provider: proxy,
                clock: fixture.clock,
                payments: creditedPaymentsFromLedger,
                planPolicy: fixture.planPolicy
            })({
                subscription,
                providerLink,
                read,
                act
            });
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscription.id))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('ACTIVE');
            expect(await graceMails(fixture.user.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — a currently approved cycle is CHARGED and does not start grace',
        async () => {
            const fixture = await graceFixture();
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            fixture.clock.advance({ ms: 60 * 60 * 1000 });
            const charge = await fixture.provider.readCharge({ chargeId });
            expect(charge.snapshot.status).toBe('approved');
            const input = await directInput(fixture);
            const result = await readPeriodCharges(
                { authorizationRead: input.read, act: input.act },
                { provider: fixture.provider }
            );
            expect(result).toMatchObject({ verdict: 'CHARGED', chargeId });
            await createLostFirstRejectionCheck(checkPorts(fixture))(input);
            const row = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId))
                .then((rows) => rows[0]);
            expect(row?.status).toBe('ACTIVE');
            expect(await graceMails(fixture.user.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'records a throwing row check against only that subscription',
        async () => {
            const fixture = await graceFixture();
            const check = vi.fn(async () => {
                throw new Error('row check failed');
            });
            const summary = await withOnlySubject(fixture.started.subscriptionId, () =>
                runReconciliationSweep(
                    {},
                    { provider: fixture.provider, clock: fixture.clock, rowChecks: [check] }
                )
            );
            expect(check).toHaveBeenCalledTimes(1);
            expect(
                summary.failures.filter(
                    ({ subscriptionId }) => subscriptionId === fixture.started.subscriptionId
                )
            ).toEqual([
                { subscriptionId: fixture.started.subscriptionId, message: 'row check failed' }
            ]);
        }
    );
});
