import {
    and,
    coveredPeriods,
    eq,
    inArray,
    isNull,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { exitGraceOnCreditedPayment } from '../../../src/services/billing/subscription/exit-grace.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof graceWithFailedCycle>>;

const seeded: { subscriptionIds: string[]; userId: string }[] = [];

/** Retires what each case seeded so no GRACE_PERIOD/ACTIVE row or open mark outlives it. */
afterEach(async () => {
    const db = getServiceTestDb();
    for (const { subscriptionIds, userId } of seeded.splice(0)) {
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: userId })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, subscriptionIds),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, subscriptionIds));
    }
});

function track(fixture: Fixture, ...extra: string[]): void {
    seeded.push({
        subscriptionIds: [fixture.started.subscriptionId, ...extra],
        userId: fixture.user.id
    });
}

async function subscriptionRow(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('Subscription disappeared');
    return row;
}

async function openMarks(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
}

async function paymentFor(chargeId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    if (!row) throw new Error('Payment fact missing');
    return row;
}

/** Seeds a live principal successor of the same user + vertical pointing at `succeedsId`. */
async function seedLiveSuccessor(fixture: Fixture, succeedsId: string) {
    const own = await subscriptionRow(fixture.started.subscriptionId);
    const [successor] = await getServiceTestDb()
        .insert(subscriptions)
        .values({
            userId: own.userId,
            vertical: own.vertical,
            planVersionId: own.planVersionId,
            billingOptionId: own.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: 'PENDING_AUTHORIZATION',
            succeedsId
        })
        .returning();
    if (!successor) throw new Error('Could not seed successor');
    return successor;
}

describe('TEST:B7:4 — S5 by the credited charge notice (AC:B7:6)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — the approved retry of the same record returns the row to ACTIVE and turns the clock off',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            track(fixture);
            const inGrace = await subscriptionRow(fixture.started.subscriptionId);
            expect(inGrace.status).toBe('GRACE_PERIOD');
            expect(inGrace.graceStartedAt).not.toBeNull();
            expect(inGrace.graceEndsAt).not.toBeNull();

            fixture.advanceToAttempt(2);
            const approved = await fixture.provider.readCharge({ chargeId: fixture.chargeId });
            expect(approved.snapshot.status).toBe('approved');
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);

            expect(result).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'CREDITED', coverage: 'WRITTEN' },
                exit: { outcome: 'REACTIVATED', subscriptionId: fixture.started.subscriptionId }
            });
            const row = await subscriptionRow(fixture.started.subscriptionId);
            expect(row.status).toBe('ACTIVE');
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            const payment = await paymentFor(fixture.chargeId);
            expect(payment.status).toBe('SUCCEEDED');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id))
            ).toHaveLength(1);
            expect(await openMarks(fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — the predecessor of a succession in progress is retained for S19, without a mark',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            const successor = await seedLiveSuccessor(fixture, fixture.started.subscriptionId);
            track(fixture, successor.id);
            const before = await subscriptionRow(fixture.started.subscriptionId);

            fixture.advanceToAttempt(2);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);

            expect(result).toMatchObject({
                outcome: 'CREDITED',
                exit: { outcome: 'RETAINED_FOR_S19' }
            });
            const row = await subscriptionRow(fixture.started.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceStartedAt).toEqual(before.graceStartedAt);
            expect(row.graceEndsAt).toEqual(before.graceEndsAt);
            expect(await openMarks(fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — condition 2: the authorization amount changed, so reason 7 opens with the payment hung',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            track(fixture);
            await fixture.provider.changeAmount({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 300000, currency: 'ARS' }
            });

            fixture.advanceToAttempt(2);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);

            expect(result).toMatchObject({
                outcome: 'CREDITED',
                exit: { outcome: 'CONDITION_FAILED', failedCondition: 2 }
            });
            const row = await subscriptionRow(fixture.started.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).not.toBeNull();
            const marks = await openMarks(fixture.started.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
            const payment = await paymentFor(fixture.chargeId);
            const hung = await getServiceTestDb()
                .select()
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.paymentId, payment.id));
            expect(hung.map((entry) => entry.markId)).toEqual([marks[0]?.id]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — condition 4: a second approved charge of the same period leaves only P1 reason 20',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            track(fixture);
            const [first] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: fixture.link.provider,
                    providerFactId: `same-period-${crypto.randomUUID()}`,
                    factAt: new Date(fixture.chargeCreatedAt)
                })
                .returning();
            await getServiceTestDb()
                .insert(coveredPeriods)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: new Date(fixture.chargeCreatedAt),
                    paymentId: first?.id,
                    creditedAt: fixture.clock.now()
                });

            fixture.advanceToAttempt(2);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);

            expect(result).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'CREDITED', coverage: 'DUPLICATE_MARKED' },
                exit: { outcome: 'CONDITION_FAILED', failedCondition: 4 }
            });
            expect((await subscriptionRow(fixture.started.subscriptionId)).status).toBe(
                'GRACE_PERIOD'
            );
            const reasons = (await openMarks(fixture.started.subscriptionId)).map(
                (mark) => mark.reason
            );
            expect(reasons).toEqual(['COBRO_DUPLICADO']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — condition 3: another live principal of the same user + vertical opens reason 7',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            const own = await subscriptionRow(fixture.started.subscriptionId);
            const [retired] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: own.userId,
                    vertical: own.vertical,
                    planVersionId: own.planVersionId,
                    billingOptionId: own.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'CANCELLED'
                })
                .returning();
            if (!retired) throw new Error('Could not seed the retired origin');
            const other = await seedLiveSuccessor(fixture, retired.id);
            track(fixture, other.id, retired.id);

            fixture.advanceToAttempt(2);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);

            expect(result).toMatchObject({
                outcome: 'CREDITED',
                exit: { outcome: 'CONDITION_FAILED', failedCondition: 3 }
            });
            expect((await subscriptionRow(fixture.started.subscriptionId)).status).toBe(
                'GRACE_PERIOD'
            );
            expect(
                (await openMarks(fixture.started.subscriptionId)).map((mark) => mark.reason)
            ).toEqual(['PAGO_TARDIO_RECHAZADO']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — a row that leaves GRACE_PERIOD between the read and the write loses the race',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            track(fixture);
            fixture.advanceToAttempt(2);
            let moved = false;
            const provider = new Proxy(fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readAuthorization')
                        return async (input: { readonly authorizationId: string }) => {
                            if (!moved) {
                                moved = true;
                                await getServiceTestDb()
                                    .update(subscriptions)
                                    .set({ status: 'SUSPENDED' })
                                    .where(eq(subscriptions.id, fixture.started.subscriptionId));
                            }
                            return target.readAuthorization(input);
                        };
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            }) as PaymentProvider;
            const before = await subscriptionRow(fixture.started.subscriptionId);

            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                { ...fixture.ports, provider }
            );

            expect(moved).toBe(true);
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                exit: { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' }
            });
            const row = await subscriptionRow(fixture.started.subscriptionId);
            expect(row.status).toBe('SUSPENDED');
            expect(row.graceStartedAt).toEqual(before.graceStartedAt);
            expect(row.graceEndsAt).toEqual(before.graceEndsAt);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — a second notice of the same approved charge on an ACTIVE row writes nothing',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            track(fixture);
            fixture.advanceToAttempt(2);
            const first = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            expect(first).toMatchObject({ exit: { outcome: 'REACTIVATED' } });
            const reactivated = await subscriptionRow(fixture.started.subscriptionId);

            const again = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            expect(again).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'ALREADY_CREDITED' }
            });
            expect(again.outcome === 'CREDITED' && again.exit).toBe(undefined);
            const payment = await paymentFor(fixture.chargeId);
            expect(
                await exitGraceOnCreditedPayment(
                    { paymentId: payment.id },
                    { provider: fixture.provider, clock: fixture.clock }
                )
            ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
            const row = await subscriptionRow(fixture.started.subscriptionId);
            expect(row).toEqual(reactivated);
            expect(await openMarks(fixture.started.subscriptionId)).toHaveLength(0);
        }
    );
});
