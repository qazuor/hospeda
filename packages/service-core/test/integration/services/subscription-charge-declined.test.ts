// TEST:B3:17 — S16 first rejected signup charge.
import { emailOutbox, eq, subscriptionModel, subscriptions, users } from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { noTouristVip } from './support/tourist-vip';

afterAll(closeServiceTestPool);

const openedAt = new Date('2026-10-01T03:00:00.000Z');
let current = openedAt;
const clock = { now: () => current };

async function seedActive() {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `b3-declined-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 declined user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-declined-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id`,
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
         VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id`,
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');

    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const beforeCancelNotice: BeforeCancelNotice = {
        beforeCancel: vi.fn<BeforeCancelNotice['beforeCancel']>(async () => 'SENT')
    };
    const started = await import(
        '../../../src/services/billing/subscription/start-subscription.service'
    ).then(({ startSubscription }) =>
        startSubscription(
            {
                userId: user.id,
                billingOptionId,
                returnUrl: 'https://hospeda.example/account'
            },
            {
                provider: fake,
                clock,
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                }),
                beforeCancelNotice,
                touristVipInheritance: noTouristVip
            }
        )
    );
    await fake.approve({ authorizationId: started.authorizationId });
    const activated = await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: clock.now()
    });
    if (!activated) throw new Error('Could not activate fixture subscription');
    const charge = await fake.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'issuer_declined'
    });
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (!row) throw new Error('No subscription row');
    return { fake, userId: user.id, started, chargeId: charge.chargeId, beforeCancelNotice, row };
}

function providerWithCancel(
    fake: FakePaymentProvider,
    cancelImpl: PaymentProvider['cancel'] = (input) => fake.cancel(input)
): PaymentProvider {
    return new Proxy(fake, {
        get(target, property) {
            if (property === 'cancel') return cancelImpl;
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;
}

function ports(
    provider: PaymentProvider,
    beforeCancelNotice: BeforeCancelNotice,
    extras: Partial<Parameters<typeof declineFirstCharge>[1]> = {}
) {
    return { provider, clock, beforeCancelNotice, ...extras };
}

async function resultFor(
    own: Awaited<ReturnType<typeof seedActive>>,
    activePorts: Parameters<typeof declineFirstCharge>[1]
) {
    return declineFirstCharge({ chargeId: own.chargeId }, activePorts);
}

async function ownOutbox(subscriptionId: string) {
    const rows = await getServiceTestDb().select().from(emailOutbox);
    return rows.filter(
        (row) =>
            row.template === 'billing.signup-declined' &&
            (row.payload as { subscriptionId?: string }).subscriptionId === subscriptionId
    );
}

describe('TEST:B3:17 declineFirstCharge', () => {
    it('TEST:B3:17 a — sends cancellation and queues the declined notice', async () => {
        current = openedAt;
        const own = await seedActive();
        const provider = providerWithCancel(own.fake);
        const cancel = vi.spyOn(provider, 'cancel');
        const result = await resultFor(own, ports(provider, own.beforeCancelNotice));
        expect(result).toMatchObject({
            outcome: 'DECLINED',
            cancelCall: 'SENT',
            successionClosed: false
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        // TEST:1683:3 AC:1683:2: S16 asks its first notice with its own kind.
        expect(own.beforeCancelNotice.beforeCancel).toHaveBeenCalledWith({
            subscriptionId: own.started.subscriptionId,
            userId: own.userId,
            kind: 'FIRST_CHARGE_DECLINED'
        });
        expect(
            (await own.fake.readAuthorization({ authorizationId: own.started.authorizationId }))
                .snapshot.status
        ).toBe('cancelled');
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, own.started.subscriptionId));
        expect(row?.status).toBe('CHARGE_DECLINED');
        expect(row?.serviceEndsAt).toEqual(own.row.serviceEndsAt);
        expect(row?.nextChargeAt).toEqual(own.row.nextChargeAt);
        const mails = await ownOutbox(own.started.subscriptionId);
        expect(mails).toHaveLength(1);
        expect(mails[0]?.payload).toMatchObject({ declineReason: 'issuer_declined' });
    });

    it('TEST:B3:17 b — keeps CHARGE_DECLINED and logs when cancel fails', async () => {
        current = openedAt;
        const own = await seedActive();
        const errors: LogEntry[] = [];
        const cancelFailureMessage = `transient cancel failure ${crypto.randomUUID()}`;
        const hookId = `b3-charge-declined-${own.started.subscriptionId}`;
        registerHook(hookId, (entry) => {
            if (
                entry.level === 'ERROR' &&
                entry.category === 'decline-first-charge' &&
                JSON.stringify(entry.data).includes(cancelFailureMessage)
            )
                errors.push(entry);
        });
        const provider = providerWithCancel(own.fake, async () => {
            throw new Error(cancelFailureMessage);
        });
        expect(await resultFor(own, ports(provider, own.beforeCancelNotice))).toMatchObject({
            outcome: 'DECLINED',
            cancelCall: 'FAILED'
        });
        expect(
            errors.some((entry) => JSON.stringify(entry.data).includes(cancelFailureMessage))
        ).toBe(true);
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, own.started.subscriptionId));
        expect(row?.status).toBe('CHARGE_DECLINED');
        unregisterHook(hookId);
    });

    it('TEST:B3:17 c — already cancelled skips notice and cancel', async () => {
        current = openedAt;
        const own = await seedActive();
        await own.fake.cancel({ authorizationId: own.started.authorizationId });
        const provider = providerWithCancel(own.fake);
        const cancel = vi.spyOn(provider, 'cancel');
        expect(await resultFor(own, ports(provider, own.beforeCancelNotice))).toMatchObject({
            outcome: 'DECLINED',
            cancelCall: 'NOT_NEEDED'
        });
        expect(cancel).not.toHaveBeenCalled();
        expect(own.beforeCancelNotice.beforeCancel).not.toHaveBeenCalled();
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, own.started.subscriptionId))
            )[0]?.status
        ).toBe('CHARGE_DECLINED');
    });

    it('TEST:B3:17 d — defers transient notice, but cancels and warns when undeliverable', async () => {
        current = openedAt;
        const deferred = await seedActive();
        vi.mocked(deferred.beforeCancelNotice.beforeCancel).mockResolvedValue('NOT_YET_SENT');
        const deferredProvider = providerWithCancel(deferred.fake);
        const deferredCancel = vi.spyOn(deferredProvider, 'cancel');
        expect(
            await resultFor(deferred, ports(deferredProvider, deferred.beforeCancelNotice))
        ).toMatchObject({ outcome: 'DECLINED', cancelCall: 'DEFERRED' });
        expect(deferredCancel).not.toHaveBeenCalled();
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, deferred.row.id))
            )[0]?.status
        ).toBe('CHARGE_DECLINED');

        for (const notice of ['NO_RECIPIENT', 'DELIVERY_EXHAUSTED'] as const) {
            current = openedAt;
            const own = await seedActive();
            vi.mocked(own.beforeCancelNotice.beforeCancel).mockResolvedValue(notice);
            const warnings: LogEntry[] = [];
            const hookId = `b3-charge-declined-${own.started.subscriptionId}`;
            registerHook(hookId, (entry) => {
                if (
                    entry.level === 'WARN' &&
                    entry.category === 'decline-first-charge' &&
                    JSON.stringify(entry.data).includes(notice)
                )
                    warnings.push(entry);
            });
            const provider = providerWithCancel(own.fake);
            const cancel = vi.spyOn(provider, 'cancel');
            expect(await resultFor(own, ports(provider, own.beforeCancelNotice))).toMatchObject({
                outcome: 'DECLINED',
                cancelCall: 'SENT'
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(warnings.some((entry) => JSON.stringify(entry.data).includes(notice))).toBe(
                true
            );
            unregisterHook(hookId);
        }
    });

    it('TEST:B3:17 e — closes a live successor inside the transaction; defaults roll back', async () => {
        current = openedAt;
        const own = await seedActive();
        if (!own.row.planVersionId || !own.row.userId || !own.row.billingOptionId)
            throw new Error('Fixture anchors missing');
        const [successor] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: own.row.userId,
                vertical: own.row.vertical,
                planVersionId: own.row.planVersionId,
                billingOptionId: own.row.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                succeedsId: own.row.id
            })
            .returning();
        if (!successor) throw new Error('No successor');
        const called: string[] = [];
        const closer = {
            closeSuccession: async ({
                predecessorSubscriptionId,
                tx
            }: {
                predecessorSubscriptionId: string;
                tx: Parameters<
                    NonNullable<
                        Parameters<typeof declineFirstCharge>[1]['successionCloser']
                    >['closeSuccession']
                >[0]['tx'];
            }) => {
                called.push(predecessorSubscriptionId);
                const [visible] = await tx
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, predecessorSubscriptionId));
                expect(visible?.status).toBe('CHARGE_DECLINED');
            }
        };
        expect(
            await resultFor(
                own,
                ports(providerWithCancel(own.fake), own.beforeCancelNotice, {
                    successionCloser: closer
                })
            )
        ).toMatchObject({ outcome: 'DECLINED', successionClosed: true });
        expect(called).toEqual([own.row.id]);

        current = openedAt;
        const rollback = await seedActive();
        await getServiceTestDb().insert(subscriptions).values({
            userId: rollback.row.userId,
            vertical: rollback.row.vertical,
            planVersionId: rollback.row.planVersionId,
            billingOptionId: rollback.row.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: 'PENDING_AUTHORIZATION',
            succeedsId: rollback.row.id
        });
        await expect(
            resultFor(
                rollback,
                ports(providerWithCancel(rollback.fake), rollback.beforeCancelNotice)
            )
        ).rejects.toMatchObject({ reason: 'SUCCESSION_CLOSER_NOT_REGISTERED' });
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, rollback.row.id))
            )[0]?.status
        ).toBe('ACTIVE');

        current = openedAt;
        const unpaidPredecessor = await seedActive();
        const [predecessor] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: unpaidPredecessor.row.userId,
                vertical: unpaidPredecessor.row.vertical,
                planVersionId: unpaidPredecessor.row.planVersionId,
                billingOptionId: unpaidPredecessor.row.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: 'CANCELLED'
            })
            .returning();
        if (!predecessor) throw new Error('No predecessor');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeedsId: predecessor.id })
            .where(eq(subscriptions.id, unpaidPredecessor.row.id));
        expect(
            await resultFor(
                unpaidPredecessor,
                ports(
                    providerWithCancel(unpaidPredecessor.fake),
                    unpaidPredecessor.beforeCancelNotice,
                    { payments: { hasCreditedPayment: async () => false } }
                )
            )
        ).toMatchObject({ outcome: 'DECLINED', successionClosed: false });
    });

    it('TEST:B3:17 f — skips approved charges, inactive rows, and credited-payment cases', async () => {
        current = openedAt;
        const own = await seedActive();
        const approved = await own.fake.charge({
            authorizationId: own.started.authorizationId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: 'approved-charge'
        });
        expect(
            await declineFirstCharge(
                { chargeId: approved.chargeId },
                ports(own.fake, own.beforeCancelNotice)
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'CHARGE_NOT_REJECTED' });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, own.row.id));
        expect(await resultFor(own, ports(own.fake, own.beforeCancelNotice))).toEqual({
            outcome: 'NOT_APPLICABLE',
            reason: 'NOT_ACTIVE'
        });
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, own.row.id))
            )[0]?.status
        ).toBe('SUSPENDED');

        current = openedAt;
        const credited = await seedActive();
        expect(
            await resultFor(
                credited,
                ports(credited.fake, credited.beforeCancelNotice, {
                    payments: { hasCreditedPayment: async () => true }
                })
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'HAS_CREDITED_PAYMENT' });
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, credited.row.id))
            )[0]?.status
        ).toBe('ACTIVE');

        current = openedAt;
        const leftToS4 = await seedActive();
        const [predecessor] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: leftToS4.row.userId,
                vertical: leftToS4.row.vertical,
                planVersionId: leftToS4.row.planVersionId,
                billingOptionId: leftToS4.row.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: 'CANCELLED'
            })
            .returning();
        if (!predecessor) throw new Error('No predecessor');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeedsId: predecessor.id })
            .where(eq(subscriptions.id, leftToS4.row.id));
        expect(
            await resultFor(
                leftToS4,
                ports(providerWithCancel(leftToS4.fake), leftToS4.beforeCancelNotice, {
                    payments: {
                        hasCreditedPayment: async ({ subscriptionId }) =>
                            subscriptionId === predecessor.id
                    }
                })
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'LEFT_TO_S4' });
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, leftToS4.row.id))
            )[0]?.status
        ).toBe('ACTIVE');
    });

    it('TEST:B3:17 g — conditional active update reports a lost race without declined notice', async () => {
        current = openedAt;
        const own = await seedActive();
        const beforeCancel = {
            beforeCancel: async () => {
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ status: 'SUSPENDED' })
                    .where(eq(subscriptions.id, own.row.id));
                return 'SENT' as const;
            }
        };
        expect(await resultFor(own, ports(providerWithCancel(own.fake), beforeCancel))).toEqual({
            outcome: 'NOT_APPLICABLE',
            reason: 'LOST_RACE'
        });
        expect(await ownOutbox(own.started.subscriptionId)).toHaveLength(0);
    });
});
