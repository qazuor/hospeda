import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    providerLinks,
    reconciliationMarks,
    refunds,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { vi } from 'vitest';
import type { CoverageNotices } from '../../../../src/services/billing/payment/payment-ports.js';
import {
    createGraceExpiryCheck,
    graceExpiredOccurrenceId
} from '../../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { retainPaymentForSuccession } from '../../../../src/services/billing/subscription/succession-retained-payment.js';
import {
    type SuspendForArrearsPorts,
    suspendForArrears
} from '../../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { getServiceTestDb } from '../helpers.js';
import { graceWithFailedCycle } from './grace-fixtures.js';

const HOUR_MS = 3_600_000;

type GraceFixture = Awaited<ReturnType<typeof graceWithFailedCycle>>;

/** What one case seeded, so its cleanup retires exactly those rows. */
export interface SeededSuccession {
    readonly subscriptionIds: readonly string[];
    readonly userId: string;
}

/**
 * Retires what the cases seeded (HOS-1561): retentions first (they point at the
 * payments), then open marks, the users' outbox rows, and the rows to `CANCELLED`
 * with the clock empty, so no live row, open mark or open retention outlives them.
 */
export async function retireSuccessionCases(cases: readonly SeededSuccession[]): Promise<void> {
    const db = getServiceTestDb();
    for (const { subscriptionIds, userId } of cases) {
        await db
            .delete(successionRetainedPayments)
            .where(inArray(successionRetainedPayments.subscriptionId, [...subscriptionIds]));
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: userId })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, [...subscriptionIds]),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, [...subscriptionIds]));
    }
}

/**
 * Seeds a live PRINCIPAL successor of the same user + vertical, in
 * `PENDING_AUTHORIZATION`, pointing at `succeedsId` (molde: `grace-exit.test.ts`).
 */
export async function seedLiveSuccessor(fixture: GraceFixture, succeedsId: string) {
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

/** Reads one subscription row; it must exist. */
export async function subscriptionRow(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('Subscription disappeared');
    return row;
}

/** Every retention (open or closed) of one row. */
export async function retentionsOf(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(successionRetainedPayments)
        .where(eq(successionRetainedPayments.subscriptionId, subscriptionId));
}

/** The open marks of one row. */
export async function openMarksOf(subscriptionId: string) {
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

/** The refunds of one payment. */
export async function refundsOf(paymentId: string) {
    return getServiceTestDb().select().from(refunds).where(eq(refunds.paymentId, paymentId));
}

/** The `domain_event` rows about one subscription. */
export async function domainEventsOf(subscriptionId: string) {
    return getServiceTestDb()
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(eq(domainEvent.entityId, subscriptionId));
}

/** The payment recorded for a provider charge. */
export async function paymentFor(chargeId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    if (!row) throw new Error('Payment fact missing');
    return row;
}

/**
 * Retains `paymentId` for `subscriptionId` the way S19 does it: in a transaction
 * of its own that locks the row first.
 */
export async function retainInOwnTransaction(input: {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly unpaidSince: Date;
    readonly now: Date;
}) {
    return getServiceTestDb().transaction(async (tx) => {
        await tx
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .for('update');
        return retainPaymentForSuccession({
            subscriptionId: input.subscriptionId,
            payment: { source: 'PAYMENT', id: input.paymentId },
            unpaidSince: input.unpaidSince,
            now: input.now,
            tx
        });
    });
}

/**
 * A predecessor in `GRACE_PERIOD` by a failed cycle (optionally approved on a
 * retry), with its live PRINCIPAL successor seeded, and spies on the
 * before-cancel notice, the provider's `cancel` and the coverage listener. The
 * sweep's check and S6 run WITHOUT a `retainedPeriodPayment` port: the real
 * default reads `succession_retained_payment`.
 */
export async function predecessorInGrace({
    approveOnAttempt
}: {
    readonly approveOnAttempt?: 2 | 3 | 4;
} = {}) {
    const fixture = await graceWithFailedCycle({ approveOnAttempt });
    const subscriptionId = fixture.started.subscriptionId;
    const successor = await seedLiveSuccessor(fixture, subscriptionId);
    const inGrace = await subscriptionRow(subscriptionId);
    if (!inGrace.graceEndsAt || !inGrace.graceStartedAt) throw new Error('Grace clock missing');
    const graceEndsAt = inGrace.graceEndsAt;

    const coverageSeen: CoverageChangedEvent[] = [];
    const coverageNotices: CoverageNotices = {
        emitCoverageChanged: vi.fn(async (event) => {
            coverageSeen.push(event);
        })
    };
    let onBeforeCancel: (() => Promise<void>) | undefined;
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => {
        await onBeforeCancel?.();
        return 'SENT';
    });
    const real = fixture.provider as PaymentProvider;
    const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => real.cancel(input));
    const provider = new Proxy(real, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    const s6Ports: SuspendForArrearsPorts = {
        provider,
        clock: fixture.clock,
        beforeCancelNotice: { beforeCancel },
        coverageNotices
    };
    const chargePorts = { ...fixture.ports, provider, coverageNotices };

    /** Moves the clock one hour past the grace end. */
    const expireClock = () =>
        fixture.clock.advance({
            ms: graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
        });
    /** The sweep's per-row check, with S6's real default port. */
    const runCheck = async () => {
        const [row] = await getServiceTestDb()
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(eq(subscriptions.id, subscriptionId));
        if (!row) throw new Error('Predecessor disappeared');
        const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
        const read = await provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        await createGraceExpiryCheck({ ...chargePorts, ...s6Ports })({ ...row, read, act });
    };
    /** S6 by its first event, with its real default port. */
    const runS6 = () =>
        suspendForArrears(
            {
                subscriptionId,
                event: 'GRACE_EXPIRED',
                occurrenceId: graceExpiredOccurrenceId({ subscriptionId, graceEndsAt })
            },
            s6Ports
        );
    const authorizationStatus = async () =>
        (await real.readAuthorization({ authorizationId: fixture.started.authorizationId }))
            .snapshot.status;

    return {
        fixture,
        subscriptionId,
        successor,
        graceStartedAt: inGrace.graceStartedAt,
        graceEndsAt,
        coverageSeen,
        beforeCancel,
        cancel,
        chargePorts,
        expireClock,
        runCheck,
        runS6,
        authorizationStatus,
        seeded: { subscriptionIds: [subscriptionId, successor.id], userId: fixture.user.id },
        setBeforeCancel: (hook: () => Promise<void>) => {
            onBeforeCancel = hook;
        }
    };
}
