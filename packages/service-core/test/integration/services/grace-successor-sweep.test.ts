// TEST:B7:2 — the successor of a paying predecessor in grace (AC:B7:4), second half: the sweep
// re-reads its preapproval by id every day and, read `cancelled` (fifth event) or `paused`
// (second event), S6 suspends it; the receiver does the same instead of the mirror (D-8), with
// one notice per grace shared by both (I-2).
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    coverageLosses,
    domainEvent,
    emailOutbox,
    eq,
    providerLinks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    createGraceExpiryCheck,
    graceExpiredOccurrenceId,
    successorProviderCancelledOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { ReconciliationComparisonInput } from '../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import { createSuccessorGraceCheck } from '../../../src/services/billing/reconciliation/sweep/successor-grace-check.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import type {
    BeforeCancelNotice,
    BeforeCancelNoticeStatus
} from '../../../src/services/billing/subscription/start-subscription.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { authorizationDelivery } from './support/succession-retention-fixtures.js';
import {
    retireSuccessorGraceRows,
    type SeededSuccessorCase,
    successorGraceFixture
} from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const ARREARS = 'billing.arrears-suspension';
const AFTER_REJECTION = 'subscription.provider_cancelled_after_rejection';
const seeded: SeededSuccessorCase[] = [];

afterEach(async () => {
    await retireSuccessorGraceRows(seeded.splice(0));
});

async function row(subscriptionId: string) {
    const [found] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!found) throw new Error('Successor sweep row disappeared');
    return found;
}

async function arrearsMails(userId: string) {
    const rows = await getServiceTestDb()
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter(({ template }) => template === ARREARS);
}

async function lossesOf(userId: string) {
    return getServiceTestDb()
        .select({ vertical: coverageLosses.vertical })
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, userId));
}

async function afterRejectionEvents(subscriptionId: string) {
    return getServiceTestDb()
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, AFTER_REJECTION)
            )
        );
}

/** The sweep's per-row input: act start, then the read by id through `provider`. */
async function sweepInput(
    subscriptionId: string,
    provider: PaymentProvider,
    clock: { now(): Date }
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

/**
 * Instruments a provider and the database-backed notice: counts our `cancel` calls,
 * records the notice/cancel order, and records each coverage event with the row's
 * committed status.
 */
function instrument(input: {
    readonly real: PaymentProvider;
    readonly subscriptionId: string;
    readonly deliver: boolean;
}) {
    const sequence: string[] = [];
    let deliver = input.deliver;
    let beforeNotice: (() => Promise<void>) | undefined;
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(
        async (notice): Promise<BeforeCancelNoticeStatus> => {
            sequence.push('notice');
            await beforeNotice?.();
            return outboxBeforeCancelNotice({ deliver }).beforeCancel(notice);
        }
    );
    const cancel = vi.fn<PaymentProvider['cancel']>(async (call) => {
        sequence.push('cancel');
        return input.real.cancel(call);
    });
    const provider = new Proxy(input.real, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    const coverage: { event: CoverageChangedEvent; statusCommitted: string | undefined }[] = [];
    const coverageNotices: CoverageNotices = {
        async emitCoverageChanged(event) {
            const [committed] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.subscriptionId));
            coverage.push({ event, statusCommitted: committed?.status });
        }
    };
    return {
        provider,
        cancel,
        sequence,
        beforeCancel,
        beforeCancelNotice: { beforeCancel } satisfies BeforeCancelNotice,
        coverageNotices,
        coverage,
        setDeliver: (value: boolean) => {
            deliver = value;
        },
        beforeNotice: (hook: () => Promise<void>) => {
            beforeNotice = hook;
        }
    };
}

/** A successor of a paying predecessor that entered grace through S4 (run 1, case a). */
async function successorInGrace({ deliver = true }: { readonly deliver?: boolean } = {}) {
    const fixture = await successorGraceFixture({ graceDays: 7 });
    seeded.push({
        subscriptionIds: [fixture.predecessorId, fixture.successorId],
        userId: fixture.user.id
    });
    const { chargeId } = await fixture.provider.declineCharge({
        authorizationId: fixture.successorAuthorizationId,
        declineReason: 'issuer_declined'
    });
    const entered = await recordChargeFact({ chargeId }, fixture.ports);
    if (entered.outcome !== 'GRACE' || entered.grace.outcome !== 'GRACE_STARTED')
        throw new Error(`Expected the successor to enter grace, got ${JSON.stringify(entered)}`);
    const { graceStartedAt, graceEndsAt } = entered.grace;
    const tools = instrument({
        real: fixture.provider,
        subscriptionId: fixture.successorId,
        deliver
    });
    const check = () =>
        createSuccessorGraceCheck({
            provider: tools.provider,
            clock: fixture.clock,
            beforeCancelNotice: tools.beforeCancelNotice,
            payments: creditedPaymentsFromLedger,
            coverageNotices: tools.coverageNotices
        });
    const runCheck = async () =>
        check()(await sweepInput(fixture.successorId, tools.provider, fixture.clock));
    const receive = () => {
        const ports = {
            provider: tools.provider,
            clock: fixture.clock,
            beforeCancelNotice: tools.beforeCancelNotice,
            coverageNotices: tools.coverageNotices
        };
        return processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: authorizationDelivery(fixture.successorAuthorizationId)
            },
            {
                ...ports,
                cancellationSeen: providerLinkCancellationSeen,
                delegates: createProviderNoticeMirrorDelegates(ports)
            }
        );
    };
    const authorizationStatus = async () =>
        (
            await fixture.provider.readAuthorization({
                authorizationId: fixture.successorAuthorizationId
            })
        ).snapshot.status;
    return {
        fixture,
        ...tools,
        graceStartedAt,
        graceEndsAt,
        runCheck,
        receive,
        authorizationStatus
    };
}

describe("TEST:B7:2 — the sweep re-reads the successor's preapproval every day (AC:B7:4)", () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'h — PA-6, the provider cancelled the preapproval: the next day S6 suspends (fifth event) without our cancel',
        async () => {
            // Arrange
            const s = await successorInGrace();
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert
            const successor = await row(s.fixture.successorId);
            expect(successor.status).toBe('SUSPENDED');
            expect(successor.graceStartedAt).toEqual(s.graceStartedAt);
            expect(s.cancel).not.toHaveBeenCalled();
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.beforeCancel.mock.calls[0]?.[0]).toMatchObject({
                subscriptionId: s.fixture.successorId,
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: successorProviderCancelledOccurrenceId({
                    subscriptionId: s.fixture.successorId,
                    graceStartedAt: s.graceStartedAt
                })
            });
            const mails = await arrearsMails(s.fixture.user.id);
            expect(mails).toHaveLength(1);
            expect(mails[0]?.payload).toMatchObject({
                subscriptionId: s.fixture.successorId,
                paymentMethod: 'CARD'
            });
            expect(await lossesOf(s.fixture.user.id)).toEqual([{ vertical: 'accommodation' }]);
            expect(s.coverage).toHaveLength(1);
            expect(s.coverage[0]).toEqual({
                event: {
                    userId: s.fixture.user.id,
                    vertical: 'accommodation',
                    sourceType: 'SUBSCRIPTION',
                    change: 'REMOVED'
                },
                statusCommitted: 'SUSPENDED'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'i — the provider paused the preapproval: S6 (second event) notices first, then cancels once',
        async () => {
            // Arrange
            const s = await successorInGrace();
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(s.sequence).toEqual(['notice', 'cancel']);
            expect(s.beforeCancel.mock.calls[0]?.[0]).toMatchObject({
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: `${s.fixture.successorId}:provider-pause-observed:${s.graceStartedAt.toISOString()}`
            });
            expect(await s.authorizationStatus()).toBe('cancelled');
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'j — an authorized preapproval: nothing happens, the grace keeps its clock',
        async () => {
            // Arrange
            const s = await successorInGrace();
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert
            const successor = await row(s.fixture.successorId);
            expect(successor.status).toBe('GRACE_PERIOD');
            expect(successor.graceStartedAt).toEqual(s.graceStartedAt);
            expect(successor.graceEndsAt).toEqual(s.graceEndsAt);
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await arrearsMails(s.fixture.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'k — a clock that already ran out with a cancelled preapproval is the first event, not this check (D-12)',
        async () => {
            // Arrange
            const s = await successorInGrace();
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            s.fixture.clock.advance({
                ms: s.graceEndsAt.getTime() + HOUR_MS - s.fixture.clock.now().getTime()
            });

            // Act
            await s.runCheck();

            // Assert: this check did not act.
            expect((await row(s.fixture.successorId)).status).toBe('GRACE_PERIOD');
            expect(s.beforeCancel).not.toHaveBeenCalled();

            // And the expiry check takes it by its first event.
            await createGraceExpiryCheck({
                provider: s.provider,
                clock: s.fixture.clock,
                beforeCancelNotice: s.beforeCancelNotice,
                payments: creditedPaymentsFromLedger,
                planPolicy: s.fixture.planPolicy,
                coverageNotices: s.coverageNotices
            })(await sweepInput(s.fixture.successorId, s.provider, s.fixture.clock));
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.beforeCancel.mock.calls[0]?.[0]).toMatchObject({
                occurrenceId: graceExpiredOccurrenceId({
                    subscriptionId: s.fixture.successorId,
                    graceEndsAt: s.graceEndsAt
                })
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'l — a normal row in grace (a payment of its own) with a cancelled preapproval is left alone',
        async () => {
            // Arrange
            const normal = await graceWithFailedCycle();
            seeded.push({
                subscriptionIds: [normal.started.subscriptionId],
                userId: normal.user.id
            });
            await normal.provider.cancel({ authorizationId: normal.started.authorizationId });
            normal.clock.advance({ ms: DAY_MS });
            const tools = instrument({
                real: normal.provider,
                subscriptionId: normal.started.subscriptionId,
                deliver: true
            });

            // Act
            await createSuccessorGraceCheck({
                provider: tools.provider,
                clock: normal.clock,
                beforeCancelNotice: tools.beforeCancelNotice,
                payments: creditedPaymentsFromLedger,
                coverageNotices: tools.coverageNotices
            })(await sweepInput(normal.started.subscriptionId, tools.provider, normal.clock));

            // Assert
            expect((await row(normal.started.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(tools.beforeCancel).not.toHaveBeenCalled();
            expect(await arrearsMails(normal.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'm — a notice not yet sent defers S6; the next run with the notice sent suspends',
        async () => {
            // Arrange
            const s = await successorInGrace({ deliver: false });
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert: deferred, nothing called, nothing written.
            expect((await row(s.fixture.successorId)).status).toBe('GRACE_PERIOD');
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await s.authorizationStatus()).toBe('paused');

            // Next run, the notice delivered.
            s.setDeliver(true);
            s.fixture.clock.advance({ ms: DAY_MS });
            await s.runCheck();
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'n — the receiver: a cancelled preapproval on the successor in grace is S6, not the mirror (D-8); a normal row is still mirrored',
        async () => {
            // Arrange
            const s = await successorInGrace();
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });

            // Act
            const received = await s.receive();

            // Assert
            expect(received).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(await afterRejectionEvents(s.fixture.successorId)).toEqual([]);
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);

            // Control: a normal row in grace is still mirrored to CANCELLED.
            const normal = await graceWithFailedCycle();
            seeded.push({
                subscriptionIds: [normal.started.subscriptionId],
                userId: normal.user.id
            });
            await normal.provider.cancel({ authorizationId: normal.started.authorizationId });
            const ports = {
                provider: normal.provider,
                clock: normal.clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
            };
            const mirrored = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: authorizationDelivery(normal.started.authorizationId)
                },
                {
                    ...ports,
                    cancellationSeen: providerLinkCancellationSeen,
                    delegates: createProviderNoticeMirrorDelegates(ports)
                }
            );
            expect(mirrored).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(normal.started.subscriptionId)).status).toBe('CANCELLED');
            expect(await afterRejectionEvents(normal.started.subscriptionId)).toHaveLength(1);
            expect(await arrearsMails(normal.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'o — dedup: the receiver suspends, the next day the sweep and S6 add no second notice',
        async () => {
            // Arrange
            const s = await successorInGrace();
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            await s.receive();
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();
            const again = await suspendForArrears(
                {
                    subscriptionId: s.fixture.successorId,
                    event: 'SUCCESSOR_PROVIDER_CANCELLED',
                    occurrenceId: successorProviderCancelledOccurrenceId({
                        subscriptionId: s.fixture.successorId,
                        graceStartedAt: s.graceStartedAt
                    })
                },
                {
                    provider: s.provider,
                    clock: s.fixture.clock,
                    beforeCancelNotice: s.beforeCancelNotice,
                    coverageNotices: s.coverageNotices
                }
            );

            // Assert
            expect(again).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'p — the row leaves grace before S6 writes: LOST_RACE, nothing written; a row already out of grace is NOT_IN_GRACE',
        async () => {
            // Arrange: the notice double moves the row out of grace, as S5 would.
            const s = await successorInGrace();
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });
            s.beforeNotice(async () => {
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ status: 'ACTIVE', graceStartedAt: null, graceEndsAt: null })
                    .where(eq(subscriptions.id, s.fixture.successorId));
            });
            const ports = {
                provider: s.provider,
                clock: s.fixture.clock,
                beforeCancelNotice: s.beforeCancelNotice,
                coverageNotices: s.coverageNotices
            };

            // Act
            const raced = await suspendForArrears(
                {
                    subscriptionId: s.fixture.successorId,
                    event: 'PROVIDER_PAUSE_OBSERVED',
                    occurrenceId: `${s.fixture.successorId}:provider-pause-observed:${s.graceStartedAt.toISOString()}`
                },
                ports
            );

            // Assert
            expect(raced).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' });
            expect((await row(s.fixture.successorId)).status).toBe('ACTIVE');
            expect(await lossesOf(s.fixture.user.id)).toEqual([]);
            expect(s.coverage).toEqual([]);

            // A row already out of grace: the fifth event does not apply and writes nothing.
            const outOfGrace = await suspendForArrears(
                {
                    subscriptionId: s.fixture.successorId,
                    event: 'SUCCESSOR_PROVIDER_CANCELLED',
                    occurrenceId: successorProviderCancelledOccurrenceId({
                        subscriptionId: s.fixture.successorId,
                        graceStartedAt: s.graceStartedAt
                    })
                },
                ports
            );
            expect(outOfGrace).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
            expect((await row(s.fixture.successorId)).status).toBe('ACTIVE');
            expect(await lossesOf(s.fixture.user.id)).toEqual([]);
        }
    );
});
