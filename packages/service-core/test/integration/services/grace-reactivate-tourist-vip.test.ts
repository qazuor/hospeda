import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    plans,
    planVersions,
    providerLinks,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import type { AuthorizationRef } from '@repo/payments';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { graceExpiredOccurrenceId } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { cancelInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service.js';
import { reactivateSuspendedOnCreditedPayment } from '../../../src/services/billing/subscription/reactivate-suspended.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { touristVipInheritanceFromDb } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof graceWithFailedCycle>>;

const HOUR_MS = 3_600_000;
const VIP_TEMPLATE = 'billing.tourist-vip-inherited-cancel';
const HOOK = 'b7-19-tourist-vip';
const seeded: { subscriptionIds: string[]; userId: string }[] = [];

/**
 * Retires every row a case seeded (principals AND the paid VIP: a VIP left
 * `ACTIVE` would be found by another suite's global `sweepInheritedTouristVips`),
 * lifts the marks a case opened and deletes its user's outbox rows.
 */
afterEach(async () => {
    unregisterHook(HOOK);
    vi.restoreAllMocks();
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
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
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

async function vipOutboxRows(userId: string) {
    return getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(
            and(eq(emailOutbox.recipientUserId, userId), eq(emailOutbox.template, VIP_TEMPLATE))
        );
}

async function refundRowsOf(subscriptionIds: readonly string[]) {
    return getServiceTestDb()
        .select({ id: refunds.id })
        .from(refunds)
        .innerJoin(payments, eq(payments.id, refunds.paymentId))
        .where(inArray(payments.subscriptionId, [...subscriptionIds]));
}

/** Seeds a paid, live Tourist VIP of the fixture's user, authorized in the SAME fake. */
async function seedPaidVip(fixture: Fixture) {
    const db = getServiceTestDb();
    const [plan] = await db
        .insert(plans)
        .values({ vertical: 'tourist', slug: `b7-19-vip-${crypto.randomUUID()}`, name: 'VIP' })
        .returning();
    if (!plan) throw new Error('Could not seed the VIP plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'tourist',
            rank: Math.floor(Math.random() * 100_000_000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Could not seed the VIP version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 25000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Could not seed the VIP option');
    const authorization = await fixture.provider.authorize({
        reference: `b7-19-vip-${crypto.randomUUID()}`,
        amount: { amountMinor: 25000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Tourist VIP',
        returnUrl: 'https://hospeda.example/account'
    });
    await fixture.provider.approve({ authorizationId: authorization.authorizationId });
    const [vip] = await db
        .insert(subscriptions)
        .values({
            userId: fixture.user.id,
            vertical: 'tourist',
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning();
    if (!vip) throw new Error('Could not seed the VIP subscription');
    await db.insert(providerLinks).values({
        subscriptionId: vip.id,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    const read = await fixture.provider.readAuthorization({
        authorizationId: authorization.authorizationId
    });
    expect(read.snapshot.status).toBe('active');
    return { id: vip.id, authorizationId: authorization.authorizationId };
}

/**
 * Records each coverage event with the principal's and the VIP's status at
 * emission, so a case can prove the notice ran after both commits.
 */
function coverageSpy(principalId: string, vipId: () => string | null) {
    const seen: { event: CoverageChangedEvent; principal: string; vip: string | null }[] = [];
    const coverageNotices: CoverageNotices = {
        emitCoverageChanged: vi.fn(async (event) => {
            const id = vipId();
            seen.push({
                event,
                principal: (await subscriptionRow(principalId)).status,
                vip: id ? (await subscriptionRow(id)).status : null
            });
        })
    };
    const removedTourist = () =>
        seen.filter(
            ({ event }) => event.change === 'REMOVED' && event.vertical === VerticalEnum.TOURIST
        );
    return { coverageNotices, seen, removedTourist };
}

/**
 * Spies the provider's `cancel` and `refund`; each cancel of the VIP records the
 * VIP template's outbox rows (status) seen at the instant of the call.
 */
function providerSpies(fixture: Fixture, vipAuthorizationId: () => string | null) {
    const order: { call: 'cancel'; outbox: string[] }[] = [];
    const original = fixture.provider.cancel.bind(fixture.provider);
    const cancel = vi
        .spyOn(fixture.provider, 'cancel')
        .mockImplementation(async (ref: AuthorizationRef) => {
            if (ref.authorizationId === vipAuthorizationId()) {
                const rows = await vipOutboxRows(fixture.user.id);
                order.push({ call: 'cancel', outbox: rows.map((row) => row.status) });
            }
            return original(ref);
        });
    const refund = vi.spyOn(fixture.provider, 'refund');
    const vipCancels = () =>
        cancel.mock.calls.filter(([ref]) => ref.authorizationId === vipAuthorizationId());
    return { order, cancel, refund, vipCancels };
}

function captureLogs(category: string, level: 'WARN' | 'ERROR' = 'WARN') {
    const entries: LogEntry[] = [];
    registerHook(HOOK, (entry) => {
        if (entry.level === level && entry.category === category) entries.push(entry);
    });
    return entries;
}

/**
 * A card principal moved to SUSPENDED by hand (S6's H1-A shape, clock kept)
 * whose authorization is still `active`: S7 brings it back to `ACTIVE`.
 */
async function suspendedByHand({
    inheritsTouristVip,
    approveOnAttempt = 2
}: {
    readonly inheritsTouristVip: boolean;
    readonly approveOnAttempt?: 2 | 3 | 4;
}) {
    const fixture = await graceWithFailedCycle({ approveOnAttempt, inheritsTouristVip });
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: 'SUSPENDED' })
        .where(eq(subscriptions.id, fixture.started.subscriptionId));
    return fixture;
}

describe('TEST:B7:19 — S7 cancels the paid Tourist VIP the plan grants again (AC:B7:31)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — S7 to ACTIVE cancels the VIP after its email is sent, without refund, and REMOVED goes out after the commit',
        async () => {
            // Arrange
            const fixture = await suspendedByHand({ inheritsTouristVip: true });
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id);
            const spy = coverageSpy(fixture.started.subscriptionId, () => vip.id);
            const provider = providerSpies(fixture, () => vip.authorizationId);
            fixture.advanceToAttempt(2);
            const now = fixture.clock.now();

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    coverageNotices: spy.coverageNotices,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: touristVipInheritanceFromDb
                }
            );

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'ACTIVE',
                    touristVip: { cancelled: 1, deferred: 0, skipped: 0 }
                }
            });
            expect((await subscriptionRow(fixture.started.subscriptionId)).status).toBe('ACTIVE');
            const vipRow = await subscriptionRow(vip.id);
            expect(vipRow.status).toBe('CANCELLED');
            expect(vipRow.serviceEndsAt).toEqual(now);
            expect(provider.vipCancels()).toHaveLength(1);
            expect(provider.order).toEqual([{ call: 'cancel', outbox: ['sent'] }]);
            const outbox = await vipOutboxRows(fixture.user.id);
            expect(outbox.map((row) => [row.status, row.payload])).toEqual([
                ['sent', { subscriptionId: vip.id }]
            ]);
            expect(provider.refund).not.toHaveBeenCalled();
            expect(await refundRowsOf([fixture.started.subscriptionId, vip.id])).toEqual([]);
            expect(spy.removedTourist()).toEqual([
                {
                    event: {
                        userId: fixture.user.id,
                        vertical: VerticalEnum.TOURIST,
                        sourceType: 'SUBSCRIPTION',
                        change: 'REMOVED'
                    },
                    principal: 'ACTIVE',
                    vip: 'CANCELLED'
                }
            ]);
            const changes = spy.seen.map(({ event }) => event.change);
            expect(changes).toEqual(['ADDED', 'REMOVED']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — a charge in flight at S6 takes S7 to CANCEL_SCHEDULED through recordChargeFact and cancels the VIP the same way',
        async () => {
            // Arrange: grace by a failed cycle the provider approves on attempt 3; the real S6 suspends.
            const fixture = await graceWithFailedCycle({
                approveOnAttempt: 3,
                inheritsTouristVip: true
            });
            const subscriptionId = fixture.started.subscriptionId;
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id);
            const spy = coverageSpy(subscriptionId, () => vip.id);
            const inGrace = await subscriptionRow(subscriptionId);
            if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
            const graceEndsAt = inGrace.graceEndsAt;
            fixture.clock.advance({
                ms: graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
            });
            const suspension = await suspendForArrears(
                {
                    subscriptionId,
                    event: 'GRACE_EXPIRED',
                    occurrenceId: graceExpiredOccurrenceId({ subscriptionId, graceEndsAt })
                },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices: spy.coverageNotices
                }
            );
            expect(suspension).toMatchObject({ outcome: 'SUSPENDED', cancelCall: 'SENT' });
            expect((await subscriptionRow(vip.id)).status).toBe('ACTIVE');
            const provider = providerSpies(fixture, () => vip.authorizationId);
            fixture.advanceToAttempt(3);
            const now = fixture.clock.now();

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    coverageNotices: spy.coverageNotices,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: touristVipInheritanceFromDb
                }
            );

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'CANCEL_SCHEDULED',
                    touristVip: { cancelled: 1, deferred: 0, skipped: 0 }
                }
            });
            expect((await subscriptionRow(subscriptionId)).status).toBe('CANCEL_SCHEDULED');
            const vipRow = await subscriptionRow(vip.id);
            expect(vipRow.status).toBe('CANCELLED');
            expect(vipRow.serviceEndsAt).toEqual(now);
            expect(provider.vipCancels()).toHaveLength(1);
            expect(provider.order).toEqual([{ call: 'cancel', outbox: ['sent'] }]);
            expect(provider.refund).not.toHaveBeenCalled();
            expect(await refundRowsOf([subscriptionId, vip.id])).toEqual([]);
            expect(spy.removedTourist()).toHaveLength(1);
            expect(spy.removedTourist()[0]).toMatchObject({
                principal: 'CANCEL_SCHEDULED',
                vip: 'CANCELLED'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — a transient email failure defers the VIP cancellation; the retry cancels it with the same single outbox row',
        async () => {
            // Arrange
            const fixture = await suspendedByHand({ inheritsTouristVip: true });
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id);
            const spy = coverageSpy(fixture.started.subscriptionId, () => vip.id);
            const provider = providerSpies(fixture, () => vip.authorizationId);
            fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    coverageNotices: spy.coverageNotices,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    touristVipInheritance: touristVipInheritanceFromDb
                }
            );

            // Assert: S7 happened, the VIP waits for its email.
            expect(result).toMatchObject({
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'ACTIVE',
                    touristVip: { cancelled: 0, deferred: 1, skipped: 0 }
                }
            });
            expect((await subscriptionRow(vip.id)).status).toBe('ACTIVE');
            expect(provider.vipCancels()).toHaveLength(0);
            const pending = await vipOutboxRows(fixture.user.id);
            expect(pending.map((row) => row.status)).toEqual(['pending']);
            expect(spy.removedTourist()).toHaveLength(0);

            // Arrange: the outbox sender delivers that row.
            await getServiceTestDb()
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.id, pending[0]?.id ?? ''));

            // Act: the retry (the window-expiry sweep's per-user clause).
            const retry = await cancelInheritedTouristVips(
                { userId: fixture.user.id },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    touristVipInheritance: touristVipInheritanceFromDb,
                    coverageNotices: spy.coverageNotices
                }
            );

            // Assert
            expect(retry).toEqual({ cancelled: 1, deferred: 0, skipped: 0 });
            expect((await subscriptionRow(vip.id)).status).toBe('CANCELLED');
            expect(provider.order).toEqual([{ call: 'cancel', outbox: ['sent'] }]);
            expect((await vipOutboxRows(fixture.user.id)).map((row) => row.id)).toEqual([
                pending[0]?.id
            ]);
            expect(provider.refund).not.toHaveBeenCalled();
            expect(spy.removedTourist()).toHaveLength(1);
        }
    );

    for (const [label, lastError, notice] of [
        ['an undeliverable address', 'undeliverable:hard_bounce', 'NO_RECIPIENT'],
        ['a definitive failure after the retries', 'smtp:retries_exhausted', 'DELIVERY_EXHAUSTED']
    ] as const) {
        it.skipIf(!isServiceTestDbAvailable())(
            `d — ${label} does not block: the VIP is cancelled and the case is logged`,
            async () => {
                // Arrange
                const warnings = captureLogs('cancel-inherited-tourist-vip');
                const fixture = await suspendedByHand({ inheritsTouristVip: true });
                const vip = await seedPaidVip(fixture);
                track(fixture, vip.id);
                const provider = providerSpies(fixture, () => vip.authorizationId);
                fixture.advanceToAttempt(2);

                // Act
                const result = await recordChargeFact(
                    { chargeId: fixture.chargeId },
                    {
                        ...fixture.ports,
                        beforeCancelNotice: outboxBeforeCancelNotice({ failWith: lastError }),
                        touristVipInheritance: touristVipInheritanceFromDb
                    }
                );

                // Assert
                expect(result).toMatchObject({
                    reactivation: {
                        outcome: 'REACTIVATED',
                        touristVip: { cancelled: 1, deferred: 0, skipped: 0 }
                    }
                });
                expect((await subscriptionRow(vip.id)).status).toBe('CANCELLED');
                expect(provider.vipCancels()).toHaveLength(1);
                expect(provider.order).toEqual([{ call: 'cancel', outbox: ['failed'] }]);
                expect(provider.refund).not.toHaveBeenCalled();
                expect(
                    warnings.filter((entry) => {
                        const text = JSON.stringify(entry);
                        return text.includes(vip.id) && text.includes(notice);
                    })
                ).toHaveLength(1);
            }
        );
    }

    it.skipIf(!isServiceTestDbAvailable())(
        'e — a plan that does not inherit Tourist VIP leaves the paid VIP alone',
        async () => {
            // Arrange
            const fixture = await suspendedByHand({ inheritsTouristVip: false });
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id);
            const provider = providerSpies(fixture, () => vip.authorizationId);
            fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: touristVipInheritanceFromDb
                }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'ACTIVE',
                    touristVip: { cancelled: 0, deferred: 0, skipped: 1 }
                }
            });
            expect((await subscriptionRow(vip.id)).status).toBe('ACTIVE');
            expect(await vipOutboxRows(fixture.user.id)).toEqual([]);
            expect(provider.vipCancels()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — without a paid VIP nothing is cancelled and no email is enqueued',
        async () => {
            // Arrange
            const fixture = await suspendedByHand({ inheritsTouristVip: true });
            track(fixture);
            const provider = providerSpies(fixture, () => null);
            fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: touristVipInheritanceFromDb
                }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'ACTIVE',
                    touristVip: { cancelled: 0, deferred: 0, skipped: 0 }
                }
            });
            expect(await vipOutboxRows(fixture.user.id)).toEqual([]);
            expect(provider.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — S7 that does not reactivate (condition 3) never runs the clause',
        async () => {
            // Arrange: another live principal of the same user + vertical (condition 3).
            const fixture = await suspendedByHand({ inheritsTouristVip: true });
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
            const [other] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: own.userId,
                    vertical: own.vertical,
                    planVersionId: own.planVersionId,
                    billingOptionId: own.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'PENDING_AUTHORIZATION',
                    succeedsId: retired.id
                })
                .returning();
            if (!other) throw new Error('Could not seed the other live principal');
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id, other.id, retired.id);
            // Inheritance answers yes on every read: only S7's verdict keeps the clause off.
            const inherits = vi.fn(async () => true);
            const provider = providerSpies(fixture, () => vip.authorizationId);
            fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: { inherits }
                }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'CONDITION_FAILED', failedCondition: 3 }
            });
            expect(result).not.toHaveProperty('reactivation.touristVip');
            expect(inherits).not.toHaveBeenCalled();
            expect((await subscriptionRow(vip.id)).status).toBe('ACTIVE');
            expect(await vipOutboxRows(fixture.user.id)).toEqual([]);
            expect(provider.vipCancels()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — a replayed payment (condition 4) never runs the clause either',
        async () => {
            // Arrange
            const fixture = await suspendedByHand({ inheritsTouristVip: true });
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id);
            const inherits = vi.fn(async () => true);
            const provider = providerSpies(fixture, () => vip.authorizationId);
            const [previous] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.initialChargeId));
            if (!previous) throw new Error('Initial payment missing');
            fixture.clock.advance({ ms: 60_000 });

            // Act
            const result = await reactivateSuspendedOnCreditedPayment(
                { paymentId: previous.id },
                {
                    ...fixture.ports,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: { inherits }
                }
            );

            // Assert
            expect(result).toMatchObject({ outcome: 'CONDITION_FAILED', failedCondition: 4 });
            expect(inherits).not.toHaveBeenCalled();
            expect((await subscriptionRow(vip.id)).status).toBe('ACTIVE');
            expect(await vipOutboxRows(fixture.user.id)).toEqual([]);
            expect(provider.vipCancels()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'h — without the inheritance port S7 still reactivates, keeps the VIP and logs that the clause is not wired',
        async () => {
            // Arrange
            const warnings = captureLogs('reactivate-suspended');
            const fixture = await suspendedByHand({ inheritsTouristVip: true });
            const vip = await seedPaidVip(fixture);
            track(fixture, vip.id);
            const provider = providerSpies(fixture, () => vip.authorizationId);
            fixture.advanceToAttempt(2);

            // Act: the ports a caller that never wired the clause would pass.
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
            });
            expect(result).not.toHaveProperty('reactivation.touristVip');
            expect((await subscriptionRow(fixture.started.subscriptionId)).status).toBe('ACTIVE');
            expect((await subscriptionRow(vip.id)).status).toBe('ACTIVE');
            expect(await vipOutboxRows(fixture.user.id)).toEqual([]);
            expect(provider.vipCancels()).toHaveLength(0);
            expect(
                warnings.filter((entry) => {
                    const text = JSON.stringify(entry);
                    return (
                        text.includes('Tourist VIP clause not wired') &&
                        text.includes(fixture.started.subscriptionId)
                    );
                })
            ).toHaveLength(1);
        }
    );
});
