import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { emailOutbox, eq, inArray, providerLinks, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    createGraceExpiryCheck,
    graceExpiredOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { ReconciliationComparisonInput } from '../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import type {
    BeforeCancelNotice,
    BeforeCancelNoticeStatus
} from '../../../src/services/billing/subscription/start-subscription.service.js';
import type { RetainedPeriodPayment } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import {
    type SuspendForArrearsPorts,
    suspendForArrears
} from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

afterAll(closeServiceTestPool);

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const seeded: { subscriptionId: string; userId: string }[] = [];

/** Retires each case's row and outbox rows so no GRACE_PERIOD/SUSPENDED row outlives it. */
afterEach(async () => {
    const db = getServiceTestDb();
    const cases = seeded.splice(0);
    if (cases.length === 0) return;
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
        .where(
            inArray(
                subscriptions.id,
                cases.map(({ subscriptionId }) => subscriptionId)
            )
        );
    await db.delete(emailOutbox).where(
        inArray(
            emailOutbox.recipientUserId,
            cases.map(({ userId }) => userId)
        )
    );
});

async function subscriptionRow(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('Subscription disappeared');
    return row;
}

/**
 * A card principal in grace by a failed cycle WITHOUT `approveOnAttempt` (D-9),
 * plus spies for the notice, the coverage listener and the provider calls.
 */
async function suspensionFixture({
    notice = 'SENT',
    expired = true
}: {
    readonly notice?: BeforeCancelNoticeStatus;
    readonly expired?: boolean;
} = {}) {
    const fixture = await graceWithFailedCycle();
    const subscriptionId = fixture.started.subscriptionId;
    seeded.push({ subscriptionId, userId: fixture.user.id });
    const inGrace = await subscriptionRow(subscriptionId);
    if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
    const graceEndsAt = inGrace.graceEndsAt;
    if (expired) {
        // Past the clock, well before the provider pauses the failed record (~1 cycle later).
        fixture.clock.advance({
            ms: graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
        });
    }

    const sequence: string[] = [];
    let noticeStatus: BeforeCancelNoticeStatus = notice;
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => {
        sequence.push('notice');
        return noticeStatus;
    });
    const beforeCancelNotice: BeforeCancelNotice = { beforeCancel };

    const coverageSeen: { event: CoverageChangedEvent; statusAtEmit: string }[] = [];
    const coverageNotices: CoverageNotices = {
        emitCoverageChanged: vi.fn(async (event) => {
            const row = await subscriptionRow(subscriptionId);
            coverageSeen.push({ event, statusAtEmit: row.status });
        })
    };

    let cancelBehaviour: 'OK' | 'THROW' = 'OK';
    let beforeCancelCall: (() => Promise<void>) | undefined;
    const real = fixture.provider as PaymentProvider;
    const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => {
        sequence.push('cancel');
        if (cancelBehaviour === 'THROW') throw new Error('provider cancel failed');
        await beforeCancelCall?.();
        return real.cancel(input);
    });
    const provider = new Proxy(real, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });

    const ports: SuspendForArrearsPorts = {
        provider,
        clock: fixture.clock,
        beforeCancelNotice,
        coverageNotices
    };
    const occurrenceId = graceExpiredOccurrenceId({ subscriptionId, graceEndsAt });

    /** The sweep's per-row input, read at the current clock through the instrumented provider. */
    const checkInput = async (): Promise<ReconciliationComparisonInput> => {
        const [row] = await getServiceTestDb()
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(eq(subscriptions.id, subscriptionId));
        if (!row) throw new Error('Grace suspension fixture disappeared');
        const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
        const read = await provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        return { ...row, read, act };
    };
    const runCheck = async (extra: Partial<SuspendForArrearsPorts> = {}) =>
        createGraceExpiryCheck({ ...ports, ...extra })(await checkInput());
    const runS6 = (extra: Partial<SuspendForArrearsPorts> = {}) =>
        suspendForArrears(
            { subscriptionId, event: 'GRACE_EXPIRED', occurrenceId },
            { ...ports, ...extra }
        );
    const authorizationStatus = async () =>
        (await real.readAuthorization({ authorizationId: fixture.started.authorizationId }))
            .snapshot.status;

    return {
        fixture,
        subscriptionId,
        graceEndsAt,
        graceStartedAt: inGrace.graceStartedAt,
        occurrenceId,
        sequence,
        beforeCancel,
        coverageNotices,
        coverageSeen,
        cancel,
        provider,
        runCheck,
        runS6,
        authorizationStatus,
        setNotice: (status: BeforeCancelNoticeStatus) => {
            noticeStatus = status;
        },
        setCancel: (behaviour: 'OK' | 'THROW') => {
            cancelBehaviour = behaviour;
        },
        onCancel: (hook: () => Promise<void>) => {
            beforeCancelCall = hook;
        }
    };
}

describe('TEST:B7:5 — S6 when the grace clock runs out (AC:B7:7)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — suspends, empties the clock, cancels once and emits REMOVED after commit',
        async () => {
            const s = await suspensionFixture();
            await s.runCheck();

            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('SUSPENDED');
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(await s.authorizationStatus()).toBe('cancelled');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.beforeCancel).toHaveBeenCalledWith({
                subscriptionId: s.subscriptionId,
                userId: s.fixture.user.id,
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: `${s.subscriptionId}:grace-expired:${s.graceEndsAt.toISOString()}`
            });
            expect(s.coverageSeen).toEqual([
                {
                    event: {
                        userId: s.fixture.user.id,
                        vertical: 'accommodation',
                        sourceType: 'SUBSCRIPTION',
                        change: 'REMOVED'
                    },
                    statusAtEmit: 'SUSPENDED'
                }
            ]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — our notice goes out before the provider cancel',
        async () => {
            const s = await suspensionFixture();
            await s.runCheck();
            expect(s.sequence).toEqual(['notice', 'cancel']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — a failed cancel defers without writing; the next run suspends',
        async () => {
            const s = await suspensionFixture();
            s.setCancel('THROW');
            expect(await s.runS6()).toEqual({
                outcome: 'DEFERRED',
                subscriptionId: s.subscriptionId,
                reason: 'CANCEL_FAILED'
            });
            const deferred = await subscriptionRow(s.subscriptionId);
            expect(deferred.status).toBe('GRACE_PERIOD');
            expect(deferred.graceEndsAt).toEqual(s.graceEndsAt);
            expect(deferred.graceStartedAt).toEqual(s.graceStartedAt);
            expect(s.coverageSeen).toEqual([]);

            s.setCancel('OK');
            s.fixture.clock.advance({ ms: DAY_MS });
            await s.runCheck();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(await s.authorizationStatus()).toBe('cancelled');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — a transient notice defers without calling the provider',
        async () => {
            const s = await suspensionFixture({ notice: 'NOT_YET_SENT' });
            expect(await s.runS6()).toEqual({
                outcome: 'DEFERRED',
                subscriptionId: s.subscriptionId,
                reason: 'NOTICE_NOT_SENT'
            });
            expect(s.cancel).not.toHaveBeenCalled();
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).toEqual(s.graceEndsAt);
            expect(await s.authorizationStatus()).not.toBe('cancelled');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e1 — a definitively failed notice cancels anyway and escalates',
        async () => {
            const s = await suspensionFixture({ notice: 'DELIVERY_EXHAUSTED' });
            expect(await s.runS6()).toEqual({
                outcome: 'SUSPENDED',
                subscriptionId: s.subscriptionId,
                cancelCall: 'SENT',
                escalated: 'DELIVERY_EXHAUSTED'
            });
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e2 — no recipient cancels anyway and escalates',
        async () => {
            const s = await suspensionFixture({ notice: 'NO_RECIPIENT' });
            expect(await s.runS6()).toEqual({
                outcome: 'SUSPENDED',
                subscriptionId: s.subscriptionId,
                cancelCall: 'SENT',
                escalated: 'NO_RECIPIENT'
            });
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — an authorization already cancelled is not cancelled again',
        async () => {
            const s = await suspensionFixture();
            await s.fixture.provider.cancel({ authorizationId: s.fixture.started.authorizationId });
            expect(await s.runS6()).toEqual({
                outcome: 'SUSPENDED',
                subscriptionId: s.subscriptionId,
                cancelCall: 'NOT_NEEDED'
            });
            expect(s.cancel).toHaveBeenCalledTimes(0);
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — GR-2 branch 1: no late provider payment after suspending',
        async () => {
            const s = await suspensionFixture();
            await s.runCheck();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');

            const failed = await s.fixture.provider.readCharge({ chargeId: s.fixture.chargeId });
            const expiresAt = Date.parse(failed.snapshot.expiresAt ?? '');
            expect(Number.isFinite(expiresAt)).toBe(true);
            s.fixture.clock.advance({
                ms: expiresAt + DAY_MS - s.fixture.clock.now().getTime()
            });
            const { chargeIds } = await s.fixture.provider.listCharges({
                authorizationId: s.fixture.started.authorizationId
            });
            const sinceFailed = [];
            for (const chargeId of chargeIds) {
                const { snapshot } = await s.fixture.provider.readCharge({ chargeId });
                if (Date.parse(snapshot.createdAt) >= s.fixture.chargeCreatedAt)
                    sinceFailed.push(snapshot);
            }
            expect(sinceFailed.length).toBeGreaterThan(0);
            expect(sinceFailed.some((charge) => charge.status === 'approved')).toBe(false);

            await s.runCheck();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'h — GR-2 branch 2: a charge in flight at S6 is credited and does not reactivate',
        async () => {
            const s = await suspensionFixture();
            let inFlight: string | undefined;
            s.onCancel(async () => {
                const charged = await s.fixture.provider.charge({
                    authorizationId: s.fixture.started.authorizationId,
                    amount: { amountMinor: 250000, currency: 'ARS' },
                    reference: s.subscriptionId
                });
                inFlight = charged.chargeId;
            });
            await s.runCheck();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(await s.authorizationStatus()).toBe('cancelled');
            if (!inFlight) throw new Error('In-flight charge was not created');

            const recorded = await recordChargeFact(
                { chargeId: inFlight },
                {
                    provider: s.fixture.provider,
                    clock: s.fixture.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    payments: creditedPaymentsFromLedger,
                    coverageNotices: s.coverageNotices
                }
            );
            expect(recorded).toMatchObject({ outcome: 'CREDITED' });
            if (recorded.outcome !== 'CREDITED') throw new Error('Not credited');
            expect(recorded.credit.outcome).toBe('CREDITED');
            expect(recorded.exit).toBeUndefined();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'i — a clock that has not run out changes nothing',
        async () => {
            const s = await suspensionFixture({ expired: false });
            await s.runCheck();
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).toEqual(s.graceEndsAt);
            expect(s.cancel).not.toHaveBeenCalled();
            expect(s.beforeCancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'j — a payment retained by S19 keeps the row in grace',
        async () => {
            const s = await suspensionFixture();
            const retainedPeriodPayment: RetainedPeriodPayment = {
                hasRetainedPeriodPayment: vi.fn(async () => true)
            };
            expect(await s.runS6({ retainedPeriodPayment })).toEqual({
                outcome: 'NOT_APPLICABLE',
                reason: 'RETAINED_PAYMENT'
            });
            expect(retainedPeriodPayment.hasRetainedPeriodPayment).toHaveBeenCalledWith({
                subscriptionId: s.subscriptionId
            });
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
        }
    );
});
