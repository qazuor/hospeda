import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    coverageLosses,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    providerLinks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { vi } from 'vitest';
import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../../src/services/billing/notice/provider-notice-delegates.js';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import type { CoverageNotices } from '../../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import type { ReconciliationComparisonInput } from '../../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import { createSuccessorGraceCheck } from '../../../../src/services/billing/reconciliation/sweep/successor-grace-check.js';
import { activateSubscription } from '../../../../src/services/billing/subscription/activate-subscription.service.js';
import { providerLinkCancellationSeen } from '../../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import type {
    BeforeCancelNotice,
    BeforeCancelNoticeStatus
} from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';
import { graceFixture } from './grace-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';
import { paymentFixture } from './payment-fixtures.js';
import { authorizationDelivery } from './succession-retention-fixtures.js';
import { noTouristVip } from './tourist-vip.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const ARREARS = 'billing.arrears-suspension';
const AFTER_REJECTION = 'subscription.provider_cancelled_after_rejection';
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };

/** The status the succession was declared from (only the successor's first charge records it). */
export type SuccessionBase = 'ACTIVE' | 'CANCEL_SCHEDULED' | 'SUSPENDED';

/** Rows seeded by the fixture, retired by {@link retireSuccessorGraceRows}. */
export interface SeededSuccessorCase {
    readonly subscriptionIds: readonly string[];
    readonly userId: string;
}

/**
 * Seeds, on ONE fake provider, a card predecessor and an ACTIVE card successor
 * with an authorized provider link and no payment of its own (AC:B7:4, TEST:B7:2).
 *
 * The predecessor is left `CANCELLED` (as S17 leaves it), so S5 on the successor does not fail condition 3. The successor's first charge
 * is the window + 24 h when declared from `ACTIVE`/`CANCEL_SCHEDULED`, and its
 * birth instant when declared from `SUSPENDED` (AC:B3:24).
 */
export async function successorGraceFixture({
    graceDays = 7,
    declaredFrom = 'ACTIVE',
    predecessorPaid = true,
    predecessorPaymentMethod = 'CARD',
    successorPaymentMethod = 'CARD',
    succession = 'IN_PROGRESS'
}: {
    readonly graceDays?: number;
    readonly declaredFrom?: SuccessionBase;
    readonly predecessorPaid?: boolean;
    readonly predecessorPaymentMethod?: 'CARD' | 'MANUAL';
    readonly successorPaymentMethod?: 'CARD' | 'MANUAL';
    /** `IN_PROGRESS`: both traces; `CLOSED`: only the predecessor's `sucedida_por` (INV:D15). */
    readonly succession?: 'IN_PROGRESS' | 'CLOSED';
} = {}) {
    const base = predecessorPaid
        ? await graceFixture({ graceDays })
        : await paymentFixture().then((fixture) => {
              fixture.clock.advance({ ms: 31 * DAY_MS });
              return fixture;
          });
    const { provider, clock, user, coverageNotices } = base;
    const predecessorId = base.started.subscriptionId;
    const planPolicy = vi.fn(async () => ({
        graceDays,
        allowsPause: false,
        current: true,
        sellable: true
    }));

    const [predecessorRow] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, predecessorId));
    if (!predecessorRow?.billingOptionId) throw new Error('Predecessor fixture row missing');
    // The base the succession was declared from, then S17's cancellation.
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: declaredFrom })
        .where(eq(subscriptions.id, predecessorId));
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: 'CANCELLED', paymentMethod: predecessorPaymentMethod })
        .where(eq(subscriptions.id, predecessorId));

    const bornAt = clock.now();
    const started = await startSubscription(
        {
            userId: user.id,
            billingOptionId: predecessorRow.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        {
            provider,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy
        }
    );
    await provider.approve({ authorizationId: started.authorizationId });
    await activateSubscription(started.subscriptionId, {
        provider,
        clock,
        beforeCancelNotice,
        touristVipInheritance: noTouristVip
    });
    const [successorRow] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (successorRow?.status !== 'ACTIVE') throw new Error('Successor fixture is not ACTIVE');
    const authorizationWindowEndsAt =
        successorRow.authorizationWindowEndsAt ?? new Date(bornAt.getTime() + 72 * HOUR_MS);
    const firstChargeAt =
        declaredFrom === 'SUSPENDED'
            ? bornAt
            : new Date(authorizationWindowEndsAt.getTime() + 24 * HOUR_MS);

    await getServiceTestDb()
        .update(subscriptions)
        .set({
            firstChargeAt,
            authorizationWindowEndsAt,
            paymentMethod: successorPaymentMethod,
            succeedsId: succession === 'IN_PROGRESS' ? predecessorId : null
        })
        .where(eq(subscriptions.id, started.subscriptionId));
    // `sucedida_por` is written at declaration and survives the succession's close (INV:D15).
    await getServiceTestDb()
        .update(subscriptions)
        .set({ succeededById: started.subscriptionId })
        .where(eq(subscriptions.id, predecessorId));
    return {
        provider,
        clock,
        user,
        coverageNotices,
        planPolicy,
        predecessorId,
        successorId: started.subscriptionId,
        successorAuthorizationId: started.authorizationId,
        bornAt,
        firstChargeAt,
        authorizationWindowEndsAt,
        ports: {
            provider,
            clock,
            beforeCancelNotice,
            payments: creditedPaymentsFromLedger,
            planPolicy,
            coverageNotices
        }
    };
}

/** Retires the seeded rows: CANCELLED with an empty clock; the users' outbox and coverage-loss rows deleted. */
export async function retireSuccessorGraceRows(cases: readonly SeededSuccessorCase[]) {
    if (cases.length === 0) return;
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
        .where(
            inArray(
                subscriptions.id,
                cases.flatMap(({ subscriptionIds }) => subscriptionIds)
            )
        );
    await db.delete(emailOutbox).where(
        inArray(
            emailOutbox.recipientUserId,
            cases.map(({ userId }) => userId)
        )
    );
    await db.delete(coverageLosses).where(
        inArray(
            coverageLosses.userId,
            cases.map(({ userId }) => userId)
        )
    );
}

export async function row(subscriptionId: string) {
    const [found] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!found) throw new Error('Successor sweep row disappeared');
    return found;
}

export async function arrearsMails(userId: string) {
    const rows = await getServiceTestDb()
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter(({ template }) => template === ARREARS);
}

export async function lossesOf(userId: string) {
    return getServiceTestDb()
        .select({ vertical: coverageLosses.vertical })
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, userId));
}

export async function afterRejectionEvents(subscriptionId: string) {
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
export async function sweepInput(
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
export function instrument(input: {
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
export async function successorInGrace({
    seeded,
    deliver = true
}: {
    /** The test's cleanup registry; the seeded rows are pushed to it. */
    readonly seeded: SeededSuccessorCase[];
    readonly deliver?: boolean;
}) {
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
