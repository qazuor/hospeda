// TEST:B5:11 (AC:B5:20): S36 revokes in one act, from the four origins, against the migrated
// database and the fake provider. Rejections, authorization and concurrency are in
// `subscription-revocation-guards.test.ts`; the whole-act rollback in `-rollback.test.ts`.
import {
    coverageLosses,
    domainEventModel,
    eq,
    manualPayments,
    payments,
    providerLinks,
    refunds,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import {
    type RevocationOrigin,
    revokeSubscription
} from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    type RevocationFixture,
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor,
    seedSiblingPrincipal
} from './support/revocation-fixtures.js';

afterEach(retireRevocationRows);
afterAll(closeServiceTestPool);

const live = !isServiceTestDbAvailable();

function revoke(f: RevocationFixture, actor: Actor) {
    return revokeSubscription({ actor, subscriptionId: f.subscriptionId }, f.ports);
}

async function paymentState(id: string) {
    const [row] = await getServiceTestDb()
        .select({
            status: payments.status,
            refundedAmount: payments.refundedAmount,
            version: payments.version
        })
        .from(payments)
        .where(eq(payments.id, id));
    return row;
}

async function decisions(subscriptionId: string) {
    return (
        await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: subscriptionId
        })
    ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided');
}

async function lossesOf(userId: string) {
    return getServiceTestDb()
        .select({ vertical: coverageLosses.vertical, lostAt: coverageLosses.lostAt })
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, userId));
}

const EXPECTED_CALLS: Readonly<
    Record<RevocationOrigin, { readonly sequence: string[]; readonly cancelCall: string }>
> = {
    ACTIVE: { sequence: ['notice', 'cancel'], cancelCall: 'SENT' },
    GRACE_PERIOD: { sequence: ['notice', 'cancel'], cancelCall: 'SENT' },
    CANCEL_SCHEDULED: { sequence: [], cancelCall: 'NOT_NEEDED' },
    PAUSED: { sequence: ['notice', 'cancel'], cancelCall: 'SENT' }
};

describe('TEST:B5:11 AC:B5:20 AC:B5:21 S36 revokes in one act', () => {
    for (const origin of ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED', 'PAUSED'] as const) {
        it.skipIf(live)(
            `AC:B5:20 (a) from ${origin} on the fifth day: CANCELLED now, RF1 for the total, payment untouched`,
            async () => {
                // Arrange
                const f = await revocationFixture({ origin });
                const actor = await seedRevocationActor();
                const now = f.day(5);
                f.at(now);
                const paymentBefore = await paymentState(f.payment!.id);

                // Act
                const result = await revoke(f, actor);

                // Assert
                const after = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, f.subscriptionId));
                expect(after[0]).toMatchObject({ status: 'CANCELLED', serviceEndsAt: now });
                const rows = await getServiceTestDb()
                    .select()
                    .from(refunds)
                    .where(eq(refunds.paymentId, f.payment!.id));
                expect(rows).toHaveLength(1);
                expect(rows[0]).toMatchObject({
                    id: result.refundId,
                    status: 'REQUESTED',
                    reason: 'REVOCATION',
                    amount: 10000
                });
                expect(await paymentState(f.payment!.id)).toEqual(paymentBefore);
                expect(result).toMatchObject({
                    subscriptionId: f.subscriptionId,
                    origin,
                    serviceEndedAt: now,
                    refundAmount: 10000,
                    payment: { source: 'PAYMENT', id: f.payment!.id },
                    cancelCall: EXPECTED_CALLS[origin].cancelCall
                });
                expect(result.escalated).toBeUndefined();
                expect(f.sequence).toEqual(EXPECTED_CALLS[origin].sequence);
                expect(await f.authorizationStatus()).toBe('cancelled');
            }
        );
    }

    it.skipIf(live)('AC:B5:20 (b) from GRACE_PERIOD the grace clock is turned off', async () => {
        // Arrange
        const f = await revocationFixture({ origin: 'GRACE_PERIOD' });
        f.at(f.day(5));

        // Act
        await revoke(f, await seedRevocationActor());

        // Assert
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, f.subscriptionId));
        expect(row).toMatchObject({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null });
    });

    for (const pauseReason of ['CUSTOMER_REQUEST', 'COURTESY'] as const) {
        it.skipIf(live)(
            `AC:B5:20 (c) from PAUSED (${pauseReason}) the open pause gets fin_real; an old closed one is untouched`,
            async () => {
                // Arrange
                const f = await revocationFixture({ origin: 'PAUSED', pauseReason });
                const now = f.day(5);
                f.at(now);
                const before = await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, f.subscriptionId));
                const closed = before.find((pause) => pause.actualEndAt !== null);

                // Act
                await revoke(f, await seedRevocationActor());

                // Assert
                const after = await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, f.subscriptionId));
                expect(after.find((pause) => pause.id === closed?.id)).toEqual(closed);
                expect(after.find((pause) => pause.id !== closed?.id)).toMatchObject({
                    reason: pauseReason,
                    actualEndAt: now
                });
            }
        );
    }

    it.skipIf(live)(
        'AC:B5:20 (d) a failed provider call still leaves CANCELLED and the RF1, and records the decision',
        async () => {
            // Arrange
            const f = await revocationFixture();
            f.at(f.day(5));
            f.setCancel('THROW');

            // Act
            const result = await revoke(f, await seedRevocationActor());

            // Assert
            expect(result.cancelCall).toBe('FAILED');
            expect((await f.authorizationStatus()) === 'cancelled').toBe(false);
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, f.subscriptionId));
            expect(row?.status).toBe('CANCELLED');
            const rows = await getServiceTestDb()
                .select()
                .from(refunds)
                .where(eq(refunds.paymentId, f.payment!.id));
            expect(rows).toHaveLength(1);
            expect(await decisions(f.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(live)(
        'AC:B5:20 (e) a notice not sent yet: CANCELLED + RF1, no call; no recipient: calls and escalates',
        async () => {
            // Arrange
            const pending = await revocationFixture({ notice: 'NOT_YET_SENT' });
            pending.at(pending.day(5));
            const noRecipient = await revocationFixture({ notice: 'NO_RECIPIENT' });
            noRecipient.at(noRecipient.day(5));

            // Act
            const deferred = await revoke(pending, await seedRevocationActor());
            const escalated = await revoke(noRecipient, await seedRevocationActor());

            // Assert
            expect(deferred.cancelCall).toBe('NOTICE_PENDING');
            expect(deferred.escalated).toBeUndefined();
            expect(pending.sequence).toEqual(['notice']);
            expect(pending.cancel).not.toHaveBeenCalled();
            expect((await pending.authorizationStatus()) === 'cancelled').toBe(false);
            expect((await decisions(pending.subscriptionId)).map((e) => e.reason)).toEqual(['S36']);
            expect(escalated).toMatchObject({ cancelCall: 'SENT', escalated: 'NO_RECIPIENT' });
            expect(noRecipient.sequence).toEqual(['notice', 'cancel']);
            for (const f of [pending, noRecipient]) {
                const [row] = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, f.subscriptionId));
                expect(row?.status).toBe('CANCELLED');
                expect(
                    await getServiceTestDb()
                        .select()
                        .from(refunds)
                        .where(eq(refunds.paymentId, f.payment!.id))
                ).toHaveLength(1);
            }
        }
    );

    it.skipIf(live)(
        'AC:B5:20 (f) exactly one REMOVED, emitted when the row is already CANCELLED; a failing listener undoes nothing',
        async () => {
            // Arrange
            const f = await revocationFixture();
            f.at(f.day(5));
            const down = await revocationFixture();
            down.at(down.day(5));
            down.setCoverage('THROW');

            // Act
            await revoke(f, await seedRevocationActor());
            const result = await revoke(down, await seedRevocationActor());

            // Assert
            expect(f.coverageSeen).toEqual([
                {
                    event: {
                        userId: f.userId,
                        vertical: 'accommodation',
                        sourceType: 'SUBSCRIPTION',
                        change: 'REMOVED'
                    },
                    statusAtEmit: 'CANCELLED'
                }
            ]);
            expect(result.cancelCall).toBe('SENT');
            expect(down.coverageSeen).toHaveLength(1);
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, down.subscriptionId));
            expect(row?.status).toBe('CANCELLED');
        }
    );

    it.skipIf(live)(
        'AC:B5:20 (f2) coverage_loss gets the revocation instant; with another live principal nothing is written',
        async () => {
            // Arrange
            const only = await revocationFixture();
            const now = only.day(5);
            only.at(now);
            const covered = await revocationFixture();
            covered.at(now);
            await seedSiblingPrincipal({
                like: covered,
                status: 'ACTIVE',
                succeedsId: covered.subscriptionId
            });

            // Act
            await revoke(only, await seedRevocationActor());
            await revoke(covered, await seedRevocationActor());

            // Assert
            expect(await lossesOf(only.userId)).toEqual([
                { vertical: 'accommodation', lostAt: now }
            ]);
            // Written with the drop, so it is already committed when REMOVED goes out (AC:B4:4).
            expect(only.lossAtEmit).toEqual([now]);
            expect(await lossesOf(covered.userId)).toEqual([]);
        }
    );

    it.skipIf(live)(
        'AC:B5:20 (f3) a card payer leaves exactly one S36 decision at the instant',
        async () => {
            // Arrange
            const f = await revocationFixture();
            const now = f.day(5);
            f.at(now);

            // Act
            await revoke(f, await seedRevocationActor());

            // Assert
            const events = await decisions(f.subscriptionId);
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                reason: 'S36',
                entityId: f.subscriptionId,
                occurredAt: now
            });
        }
    );

    for (const origin of ['CANCEL_SCHEDULED', 'ACTIVE'] as const) {
        it.skipIf(live)(
            `AC:B5:20 (f4) from ${origin} the real annotator writes provider_link.cancelled_seen_at`,
            async () => {
                // Arrange
                const f = await revocationFixture({ origin });
                f.at(f.day(5));

                // Act
                await revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                    { ...f.ports, cancellationSeen: providerLinkCancellationSeen }
                );

                // Assert
                const [link] = await getServiceTestDb()
                    .select()
                    .from(providerLinks)
                    .where(eq(providerLinks.subscriptionId, f.subscriptionId));
                expect(link?.cancelledSeenAt).toBeInstanceOf(Date);
            }
        );
    }

    it.skipIf(live)(
        'AC:B5:20 (g) a manual payer: RF1 on the manual payment for its anchored price, no notice, no call, no decision',
        async () => {
            // Arrange
            const f = await revocationFixture({ withPayment: false });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ paymentMethod: 'MANUAL' })
                .where(eq(subscriptions.id, f.subscriptionId));
            const [manual] = await getServiceTestDb()
                .insert(manualPayments)
                .values({
                    subscriptionId: f.subscriptionId,
                    periodStart: new Date('2026-10-01T03:00:00.000Z'),
                    status: 'REGISTERED',
                    registeredBy: f.userId,
                    registeredAt: f.day(3)
                })
                .returning();
            f.at(f.day(5));

            // Act
            const result = await revoke(f, await seedRevocationActor());

            // Assert
            expect(result).toMatchObject({
                cancelCall: 'NOT_APPLICABLE',
                refundAmount: 250000,
                payment: { source: 'MANUAL_PAYMENT', id: manual!.id }
            });
            const rows = await getServiceTestDb()
                .select()
                .from(refunds)
                .where(eq(refunds.manualPaymentId, manual!.id));
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ amount: 250000, reason: 'REVOCATION' });
            expect(f.sequence).toEqual([]);
            expect(await decisions(f.subscriptionId)).toEqual([]);
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, f.subscriptionId));
            expect(row?.status).toBe('CANCELLED');
        }
    );
});

describe('TEST:1683:3 AC:1683:2 S36 asks its notice with its own kind', () => {
    it.skipIf(live)(
        'TEST:1683:3 revoking a card row with a live preapproval asks for REVOCATION, never the default',
        async () => {
            // Arrange
            const f = await revocationFixture({ origin: 'ACTIVE' });
            const actor = await seedRevocationActor();
            f.at(f.day(5));

            // Act
            await revoke(f, actor);

            // Assert
            expect(f.beforeCancel.mock.calls).toStrictEqual([
                [{ subscriptionId: f.subscriptionId, userId: f.userId, kind: 'REVOCATION' }]
            ]);
        }
    );
});
