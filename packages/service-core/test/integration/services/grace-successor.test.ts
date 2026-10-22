// TEST:B7:2 — the successor of a paying predecessor enters grace (AC:B7:4), first half:
// S4 admits it, S16 steps aside with the same predicate, the lost-rejection border, and the
// PA-6 branch in which the provider retries and the charge comes in (S5).
import { emailOutbox, eq, payments, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    createLostFirstRejectionCheck,
    type ReconciliationComparisonInput
} from '../../../src/services/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceFixture } from './support/grace-fixtures.js';
import {
    retireSuccessorGraceRows,
    type SeededSuccessorCase,
    successorGraceFixture
} from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);

const DAY_MS = 86_400_000;
const seeded: SeededSuccessorCase[] = [];

afterEach(async () => {
    await retireSuccessorGraceRows(seeded.splice(0));
});

type Fixture = Awaited<ReturnType<typeof successorGraceFixture>>;

async function seed(options: Parameters<typeof successorGraceFixture>[0] = {}): Promise<Fixture> {
    const fixture = await successorGraceFixture(options);
    seeded.push({
        subscriptionIds: [fixture.predecessorId, fixture.successorId],
        userId: fixture.user.id
    });
    return fixture;
}

async function row(subscriptionId: string) {
    const [found] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!found) throw new Error('Successor grace row disappeared');
    return found;
}

async function templates(userId: string) {
    const rows = await getServiceTestDb()
        .select({ template: emailOutbox.template })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.map(({ template }) => template).sort();
}

async function paymentStatus(chargeId: string) {
    const [found] = await getServiceTestDb()
        .select({ status: payments.status })
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    return found?.status;
}

/** The successor's first charge is rejected and the fact is carried by `recordChargeFact`. */
async function rejectFirstCharge(fixture: Fixture) {
    const { chargeId } = await fixture.provider.declineCharge({
        authorizationId: fixture.successorAuthorizationId,
        declineReason: 'issuer_declined'
    });
    const readAt = fixture.clock.now();
    const result = await recordChargeFact({ chargeId }, fixture.ports);
    return { chargeId, readAt, result };
}

async function sweepInput(
    subscriptionId: string,
    provider: Fixture['provider'],
    clock: Fixture['clock']
): Promise<ReconciliationComparisonInput> {
    const [found] = await getServiceTestDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, subscriptionId));
    if (!found) throw new Error('Sweep subject disappeared');
    const act = { kind: 'decision' as const, startedAt: clock.now() };
    const read = await provider.readAuthorization({
        authorizationId: found.providerLink.providerId
    });
    return { subscription: found.subscription, providerLink: found.providerLink, read, act };
}

async function expectGraceStarted(fixture: Fixture, graceDays: number) {
    const { chargeId, readAt, result } = await rejectFirstCharge(fixture);
    const graceEndsAt = new Date(readAt.getTime() + graceDays * DAY_MS);
    expect(result).toEqual({
        outcome: 'GRACE',
        paymentId: expect.any(String),
        grace: {
            outcome: 'GRACE_STARTED',
            subscriptionId: fixture.successorId,
            graceStartedAt: readAt,
            graceEndsAt
        },
        terminalRejection: { outcome: 'FAILED' }
    });
    const successor = await row(fixture.successorId);
    expect(successor.status).toBe('GRACE_PERIOD');
    expect(successor.graceStartedAt).toEqual(readAt);
    expect(successor.graceEndsAt).toEqual(graceEndsAt);
    // AC:1734:1 — the successor's first charge has no retry window.
    expect(await paymentStatus(chargeId)).toBe('FAILED');
    // One grace notice and nothing from S16 (no signup-declined notice).
    const sent = await templates(fixture.user.id);
    expect(sent.filter((template) => template === 'billing.grace-started')).toHaveLength(1);
    expect(sent).not.toContain('billing.signup-declined');
    return { chargeId, readAt };
}

async function expectDeclined(fixture: Fixture) {
    const { result } = await rejectFirstCharge(fixture);
    expect(result).toMatchObject({
        outcome: 'DECLINED',
        decline: { outcome: 'DECLINED', subscriptionId: fixture.successorId }
    });
    const successor = await row(fixture.successorId);
    expect(successor.status).toBe('CHARGE_DECLINED');
    expect(successor.graceStartedAt).toBeNull();
    expect(await templates(fixture.user.id)).not.toContain('billing.grace-started');
}

describe('TEST:B7:2 — the successor of a paying predecessor enters grace (AC:B7:4)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — declared from ACTIVE: enters grace by S4 and does not die by S16',
        async () => {
            const fixture = await seed({ graceDays: 9 });
            await expectGraceStarted(fixture, 9);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'a2 — declared from CANCEL_SCHEDULED: enters grace by S4',
        async () => {
            const fixture = await seed({ graceDays: 5, declaredFrom: 'CANCEL_SCHEDULED' });
            await expectGraceStarted(fixture, 5);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — the successor of a card SUSPENDED (charges on authorization) dies by S16',
        async () => {
            const fixture = await seed({ declaredFrom: 'SUSPENDED' });
            expect(fixture.firstChargeAt.getTime()).toBeLessThan(
                fixture.authorizationWindowEndsAt.getTime()
            );
            await expectDeclined(fixture);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — closed succession: the predecessor is read by its sucedida_por and grace opens',
        async () => {
            const fixture = await seed({ succession: 'CLOSED' });
            expect((await row(fixture.successorId)).succeedsId).toBeNull();
            expect((await row(fixture.predecessorId)).succeededById).toBe(fixture.successorId);
            await expectGraceStarted(fixture, 7);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — a predecessor that never charged: the successor dies by S16',
        async () => {
            const fixture = await seed({ predecessorPaid: false });
            expect(
                await creditedPaymentsFromLedger.hasCreditedPayment({
                    subscriptionId: fixture.predecessorId
                })
            ).toBe(false);
            await expectDeclined(fixture);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — a manual predecessor sends the successor to S16; a manual successor is not S4',
        async () => {
            const manualPredecessor = await seed({ predecessorPaymentMethod: 'MANUAL' });
            expect(
                await creditedPaymentsFromLedger.hasCreditedPayment({
                    subscriptionId: manualPredecessor.predecessorId
                })
            ).toBe(true);
            await expectDeclined(manualPredecessor);

            const manualSuccessor = await seed({ successorPaymentMethod: 'MANUAL' });
            const { result } = await rejectFirstCharge(manualSuccessor);
            expect(result).toEqual({
                outcome: 'GRACE',
                paymentId: expect.any(String),
                grace: { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL' },
                terminalRejection: { outcome: 'FAILED' }
            });
            const successor = await row(manualSuccessor.successorId);
            expect(successor.status).toBe('ACTIVE');
            expect(successor.graceStartedAt).toBeNull();
            const sent = await templates(manualSuccessor.user.id);
            expect(sent).not.toContain('billing.grace-started');
            expect(sent).not.toContain('billing.signup-declined');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — the lost first rejection of the successor is a declared border (DEC-MP-008 📌1)',
        async () => {
            // Arrange: the successor's rejection is never noticed; only the sweep reads it.
            const fixture = await seed();
            await fixture.provider.declineCharge({
                authorizationId: fixture.successorAuthorizationId,
                declineReason: 'issuer_declined'
            });
            const check = createLostFirstRejectionCheck({
                provider: fixture.provider,
                clock: fixture.clock,
                payments: creditedPaymentsFromLedger,
                planPolicy: fixture.planPolicy
            });

            // Act
            await check(await sweepInput(fixture.successorId, fixture.provider, fixture.clock));

            // Assert
            const successor = await row(fixture.successorId);
            expect(successor.status).toBe('ACTIVE');
            expect(successor.graceStartedAt).toBeNull();
            expect(successor.graceEndsAt).toBeNull();
            expect(await templates(fixture.user.id)).not.toContain('billing.grace-started');

            // Control: the same pass over a row with a payment of its own still enters grace.
            const paid = await graceFixture({ graceDays: 6 });
            seeded.push({ subscriptionIds: [paid.started.subscriptionId], userId: paid.user.id });
            await paid.provider.failChargeCycle({
                authorizationId: paid.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const readAt = paid.clock.now();
            await createLostFirstRejectionCheck({
                provider: paid.provider,
                clock: paid.clock,
                payments: creditedPaymentsFromLedger,
                planPolicy: paid.planPolicy
            })(await sweepInput(paid.started.subscriptionId, paid.provider, paid.clock));
            const control = await row(paid.started.subscriptionId);
            expect(control.status).toBe('GRACE_PERIOD');
            expect(control.graceStartedAt).toEqual(readAt);
            expect(control.graceEndsAt).toEqual(new Date(readAt.getTime() + 6 * DAY_MS));
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — PA-6, the provider retries and the charge comes in: S5 returns it to ACTIVE',
        async () => {
            // Arrange
            const fixture = await seed();
            await expectGraceStarted(fixture, 7);
            fixture.clock.advance({ ms: DAY_MS });

            // Act: the retry on the same authorization is approved.
            const retry = await fixture.provider.charge({
                authorizationId: fixture.successorAuthorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.successorId
            });
            const result = await recordChargeFact({ chargeId: retry.chargeId }, fixture.ports);

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                exit: { outcome: 'REACTIVATED', subscriptionId: fixture.successorId }
            });
            const successor = await row(fixture.successorId);
            expect(successor.status).toBe('ACTIVE');
            expect(successor.graceStartedAt).toBeNull();
            expect(successor.graceEndsAt).toBeNull();
        }
    );
});
