import {
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    coverageLosses,
    coveredPeriods,
    emailOutbox,
    eq,
    isNull,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { encodeFakeNotice } from '@repo/payments/fake';
import { desc } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { mirrorOurCancellationOnActive } from '../../../src/services/billing/notice/mirror-our-cancellation-on-active.js';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    graceExpiredOccurrenceId,
    providerPauseOnActiveOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { billingPeriodEnd } from '../../../src/services/billing/subscription/billing-period-end.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12.js';
import { noCreditedPayments } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import { recordingCoverageNotices } from './support/coverage-notice-fixtures.js';
import { graceFixture, graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { paymentFixture } from './support/payment-fixtures.js';
import { authorizationDelivery } from './support/succession-retention-fixtures.js';

const seeded: { subscriptionId: string; userId: string }[] = [];
async function providerCancellation(
    fixture: Awaited<ReturnType<typeof graceFixture>>,
    beforeCancelNotice = outboxBeforeCancelNotice({ deliver: true })
) {
    await fixture.provider.cancel({ authorizationId: fixture.started.authorizationId });
    const ports = {
        provider: fixture.provider,
        clock: fixture.clock,
        beforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy,
        coverageNotices: fixture.coverageNotices
    };
    const result = await processProviderNotice(
        { channel: 'WEBHOOKS', delivery: authorizationDelivery(fixture.started.authorizationId) },
        {
            ...ports,
            cancellationSeen: providerLinkCancellationSeen,
            delegates: createProviderNoticeMirrorDelegates(ports)
        }
    );
    return result;
}
afterAll(closeServiceTestPool);
afterEach(async () => {
    const cases = seeded.splice(0);
    for (const item of cases) {
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, item.subscriptionId));
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, item.userId));
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(eq(coverageLosses.userId, item.userId));
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: item.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, item.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    }
});

describe('TEST:B7:9 — the R18 mirror keeps the period an S6 that lost to S5 had already cancelled (AC:B7:15)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — a later cancelled notice schedules the period after S6 loses to S5',
        async () => {
            const fixture = await graceWithFailedCycle({ graceDays: 7, approveOnAttempt: 2 });
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionId, userId: fixture.user.id });
            fixture.advanceToAttempt(2);
            const [grace] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            if (!grace?.graceEndsAt || fixture.clock.now() <= grace.graceEndsAt)
                throw new Error('Retry attempt must run after the grace deadline');
            let creditedDuringCancel = false;
            const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => {
                const result = await fixture.provider.cancel(input);
                if (!creditedDuringCancel) {
                    creditedDuringCancel = true;
                    await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
                }
                return result;
            });
            const provider = new Proxy(fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'cancel') return cancel;
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            }) as PaymentProvider;
            const occurrenceId = graceExpiredOccurrenceId({
                subscriptionId,
                graceEndsAt: grace.graceEndsAt
            });
            const suspended = await suspendForArrears(
                { subscriptionId, event: 'GRACE_EXPIRED', occurrenceId },
                {
                    provider,
                    clock: fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    cancellationSeen: providerLinkCancellationSeen,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(suspended).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' });
            const [active] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            expect(active?.status).toBe('ACTIVE');
            expect(creditedDuringCancel).toBe(true);
            expect(cancel).toHaveBeenCalledTimes(1);
            const authorization = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            expect(authorization.snapshot.status).toBe('cancelled');
            const notices = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, fixture.user.id),
                        eq(emailOutbox.template, 'billing.arrears-suspension')
                    )
                );
            expect(notices).toHaveLength(1);
            const notice = notices[0];
            if (!notice) throw new Error('Expected S6 notice');
            expect(notice.payload.subscriptionId).toBe(subscriptionId);
            if (!active) throw new Error('Expected S5 active row');
            const pauseOccurrence = providerPauseOnActiveOccurrenceId({
                subscriptionId,
                nextChargeAt: active.nextChargeAt
            });
            await getServiceTestDb()
                .update(emailOutbox)
                .set({
                    dedupKey: buildEmailDedupKey({
                        recipient: fixture.user.id,
                        template: 'billing.arrears-suspension',
                        occurrence: buildEventOccurrence({ eventId: pauseOccurrence })
                    })
                })
                .where(eq(emailOutbox.id, notice.id));
            const outboxCount = (
                await getServiceTestDb()
                    .select({ id: emailOutbox.id })
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, fixture.user.id))
            ).length;
            const period = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(
                    and(
                        eq(coveredPeriods.subscriptionId, subscriptionId),
                        isNull(coveredPeriods.releasedAt)
                    )
                )
                .orderBy(desc(coveredPeriods.periodStart))
                .limit(1);
            if (!period[0]) throw new Error('Open paid period missing');
            const seenCoverage = recordingCoverageNotices(async () => {
                const [row] = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscriptionId));
                return row?.status;
            });
            const ports = {
                ...fixture.ports,
                provider,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: seenCoverage.coverageNotices,
                payments: creditedPaymentsFromLedger
            };
            const result = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: authorizationDelivery(fixture.started.authorizationId)
                },
                {
                    ...ports,
                    cancellationSeen: providerLinkCancellationSeen,
                    delegates: createProviderNoticeMirrorDelegates(ports)
                }
            );
            expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            expect(cancel).toHaveBeenCalledTimes(1);
            const [scheduled] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            expect(scheduled?.status).toBe('CANCEL_SCHEDULED');
            expect(scheduled?.serviceEndsAt).toBeInstanceOf(Date);
            expect(scheduled?.graceStartedAt).toBeNull();
            expect(scheduled?.graceEndsAt).toBeNull();
            expect(seenCoverage.seen).toHaveLength(1);
            expect(seenCoverage.seen[0]?.event).toEqual({
                userId: fixture.user.id,
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
            expect(seenCoverage.seen[0]?.committed).toBe('CANCEL_SCHEDULED');
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(reconciliationMarks)
                        .where(eq(reconciliationMarks.subscriptionId, subscriptionId))
                ).length
            ).toBe(0);
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(coverageLosses)
                        .where(
                            and(
                                eq(coverageLosses.userId, fixture.user.id),
                                eq(coverageLosses.vertical, 'accommodation')
                            )
                        )
                ).length
            ).toBe(0);
            expect(scheduled?.serviceEndsAt).toEqual(
                billingPeriodEnd({ periodStart: period[0].periodStart, everyMonths: 1 }).periodEnd
            );
            expect(
                (
                    await getServiceTestDb()
                        .select({ id: emailOutbox.id })
                        .from(emailOutbox)
                        .where(eq(emailOutbox.recipientUserId, fixture.user.id))
                ).length
            ).toBe(outboxCount);

            const secondDeliveryData = encodeFakeNotice({
                notice: {
                    resourceKind: 'authorization',
                    resourceId: fixture.started.authorizationId,
                    version: '999999999999999999999'
                },
                format: 'json'
            });
            const second = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: {
                        headers: { 'content-type': secondDeliveryData.contentType },
                        body: secondDeliveryData.body
                    }
                },
                {
                    ...ports,
                    cancellationSeen: providerLinkCancellationSeen,
                    delegates: createProviderNoticeMirrorDelegates(ports)
                }
            );
            expect(second).toEqual({ ack: 'OK', outcome: 'NOOP' });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, subscriptionId))
                )[0]?.serviceEndsAt
            ).toEqual(scheduled?.serviceEndsAt);
            expect(seenCoverage.seen).toHaveLength(1);

            const serviceEndsAt = scheduled?.serviceEndsAt;
            if (!serviceEndsAt) throw new Error('R18 did not write service end');
            await withServiceTestTransaction(async (tx) => {
                const beforeDue = await applyS12ToPrincipal(
                    { tx, subscriptionId, now: new Date(serviceEndsAt.getTime() - 1) },
                    {
                        orphanhood: orphanPorts(tx).ports,
                        clock: { now: () => new Date(serviceEndsAt.getTime() - 1) }
                    }
                );
                expect(beforeDue.outcome).toBe('NOT_DUE');
                const due = await applyS12ToPrincipal(
                    { tx, subscriptionId, now: serviceEndsAt },
                    { orphanhood: orphanPorts(tx).ports, clock: { now: () => serviceEndsAt } }
                );
                expect(due.outcome).toBe('CANCELLED');
                expect(due.outcome === 'CANCELLED' && due.subscriptionId).toBe(subscriptionId);
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — a provider cancellation without our notice still cuts coverage',
        async () => {
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionId, userId: fixture.user.id });
            expect(await providerCancellation(fixture)).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            expect(row?.status).toBe('CANCELLED');
            expect(row?.serviceEndsAt).toEqual(fixture.clock.now());
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(coverageLosses)
                        .where(
                            and(
                                eq(coverageLosses.userId, fixture.user.id),
                                eq(coverageLosses.vertical, 'accommodation')
                            )
                        )
                ).length
            ).toBe(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — an unrelated before-cancel kind does not count as our cancellation',
        async () => {
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionId, userId: fixture.user.id });
            await outboxBeforeCancelNotice().beforeCancel({
                subscriptionId,
                userId: fixture.user.id,
                kind: 'SCHEDULED_CANCELLATION'
            });
            expect(await providerCancellation(fixture)).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, subscriptionId))
                )[0]?.status
            ).toBe('CANCELLED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — our cancellation notice for another subscription does not match this row',
        async () => {
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionId, userId: fixture.user.id });
            await outboxBeforeCancelNotice().beforeCancel({
                subscriptionId: crypto.randomUUID(),
                userId: fixture.user.id,
                kind: 'ARREARS_SUSPENSION'
            });
            expect(await providerCancellation(fixture)).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, subscriptionId))
                )[0]?.status
            ).toBe('CANCELLED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — an AUTHORIZATION_EXPIRED notice mirrors an ACTIVE row without a credited payment',
        async () => {
            const fixture = await paymentFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionId, userId: fixture.user.id });
            await outboxBeforeCancelNotice().beforeCancel({
                subscriptionId,
                userId: fixture.user.id,
                kind: 'AUTHORIZATION_EXPIRED'
            });
            await fixture.provider.cancel({ authorizationId: fixture.started.authorizationId });
            const ports = {
                provider: fixture.provider,
                clock: fixture.clock,
                beforeCancelNotice: outboxBeforeCancelNotice(),
                payments: noCreditedPayments,
                firstCharge: {
                    readFirstCharge: async () => ({ outcome: 'NOT_REJECTED' as const })
                },
                coverageNotices: fixture.coverageNotices
            };
            const result = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: authorizationDelivery(fixture.started.authorizationId)
                },
                {
                    ...ports,
                    cancellationSeen: providerLinkCancellationSeen,
                    delegates: createProviderNoticeMirrorDelegates(ports)
                }
            );
            expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            expect(row?.status).toBe('CANCEL_SCHEDULED');
            expect(row?.serviceEndsAt).toEqual(fixture.clock.now());
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(reconciliationMarks)
                        .where(eq(reconciliationMarks.subscriptionId, subscriptionId))
                ).length
            ).toBe(0);
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(coverageLosses)
                        .where(eq(coverageLosses.userId, fixture.user.id))
                ).length
            ).toBe(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'h — the active-state guard refuses a row that is already suspended',
        async () => {
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionId, userId: fixture.user.id });
            await outboxBeforeCancelNotice().beforeCancel({
                subscriptionId,
                userId: fixture.user.id,
                kind: 'ARREARS_SUSPENSION'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, subscriptionId));
            const [before] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            const result = await mirrorOurCancellationOnActive(
                { subscriptionId, readAt: fixture.clock.now(), everyMonths: 1 },
                { clock: fixture.clock }
            );
            const [after] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            expect(result).toEqual({ outcome: 'LOST_RACE' });
            expect(after).toEqual(before);
        }
    );
});
