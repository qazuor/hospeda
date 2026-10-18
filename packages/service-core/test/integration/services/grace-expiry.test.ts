import { randomUUID } from 'node:crypto';
import {
    and,
    coveredPeriods,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    providerLinks,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { readPeriodCharges } from '../../../src/services/billing/reconciliation/period-charges/read-period-charges.js';
import {
    createGraceExpiryCheck,
    type GraceExpiryCheckPorts,
    settleChargedPeriod
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { ReconciliationComparisonInput } from '../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import type { UnresolvedPeriodCharges } from '../../../src/services/billing/reconciliation/sweep/unresolved-period-charge.port.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { liftOpenMarkAsAdmin } from './support/admin-lift-fixtures.js';
import { graceFixture, graceWithFailedCycle } from './support/grace-fixtures.js';

afterAll(closeServiceTestPool);

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const seeded: { subscriptionId: string; userId: string }[] = [];

/** Retires each case's row, its open marks and outbox rows so no grace/suspended row or mark outlives it. */
afterEach(async () => {
    const db = getServiceTestDb();
    for (const { subscriptionId, userId } of seeded.splice(0)) {
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, subscriptionId));
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, [userId]));
    }
});

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
    return row ?? null;
}

type ChargeOverride = (input: {
    readonly chargeId: string;
    readonly callInRun: number;
}) => 'THROW' | 'PENDING' | null;

/**
 * A card principal in grace by a failed cycle, with the sweep's per-row input
 * built through a provider whose list, count and charge reads a case can bend.
 */
async function expiryFixture({
    graceDays = 7,
    approveOnAttempt
}: {
    readonly graceDays?: number;
    readonly approveOnAttempt?: 2 | 3 | 4;
} = {}) {
    const fixture = await graceWithFailedCycle({ graceDays, approveOnAttempt });
    const subscriptionId = fixture.started.subscriptionId;
    seeded.push({ subscriptionId, userId: fixture.user.id });
    const inGrace = await subscriptionRow(subscriptionId);
    if (!inGrace.graceEndsAt || !inGrace.graceStartedAt) throw new Error('Grace clock missing');

    const bend: {
        listFilter: ((ids: readonly string[]) => readonly string[]) | 'THROW' | null;
        countDelta: number;
        charge: ChargeOverride | null;
    } = { listFilter: null, countDelta: 0, charge: null };
    const readsInRun = new Map<string, number>();

    const real = fixture.provider as PaymentProvider;
    const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => real.cancel(input));
    const provider = new Proxy(real, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            if (property === 'listCharges') {
                return async (input: Parameters<PaymentProvider['listCharges']>[0]) => {
                    if (bend.listFilter === 'THROW') throw new Error('listing failed');
                    const listed = await target.listCharges(input);
                    return {
                        chargeIds: bend.listFilter
                            ? bend.listFilter(listed.chargeIds)
                            : listed.chargeIds
                    };
                };
            }
            if (property === 'readAuthorization') {
                return async (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                    const read = await target.readAuthorization(input);
                    if (bend.countDelta === 0 || read.snapshot.chargeRecordCount === null)
                        return read;
                    return {
                        ...read,
                        snapshot: {
                            ...read.snapshot,
                            chargeRecordCount: read.snapshot.chargeRecordCount + bend.countDelta
                        }
                    };
                };
            }
            if (property === 'readCharge') {
                return async (input: Parameters<PaymentProvider['readCharge']>[0]) => {
                    const callInRun = (readsInRun.get(input.chargeId) ?? 0) + 1;
                    readsInRun.set(input.chargeId, callInRun);
                    const decision = bend.charge?.({ chargeId: input.chargeId, callInRun });
                    if (decision === 'THROW') throw new Error('charge read failed');
                    const read = await target.readCharge(input);
                    if (decision === 'PENDING')
                        return { ...read, snapshot: { ...read.snapshot, status: 'pending' } };
                    return read;
                };
            }
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;

    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => 'SENT');
    const notify = vi.fn<UnresolvedPeriodCharges['notify']>(async () => undefined);
    const ports: GraceExpiryCheckPorts = {
        provider,
        clock: fixture.clock,
        beforeCancelNotice: { beforeCancel },
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy,
        coverageNotices: fixture.coverageNotices,
        unresolvedPeriodCharges: { notify }
    };

    const checkInput = async (): Promise<ReconciliationComparisonInput> => {
        const [row] = await getServiceTestDb()
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(eq(subscriptions.id, subscriptionId));
        if (!row) throw new Error('Grace expiry fixture disappeared');
        const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
        const read = await provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        return { ...row, read, act };
    };
    /** One sweep pass of the check over this row only. */
    const runCheck = async () => {
        readsInRun.clear();
        await createGraceExpiryCheck(ports)(await checkInput());
    };
    const advanceTo = (instant: number) => {
        fixture.clock.advance({ ms: instant - fixture.clock.now().getTime() });
    };

    return {
        fixture,
        subscriptionId,
        graceStartedAt: inGrace.graceStartedAt,
        graceEndsAt: inGrace.graceEndsAt,
        bend,
        real,
        provider,
        cancel,
        beforeCancel,
        notify,
        ports,
        checkInput,
        runCheck,
        advanceTo
    };
}

describe('TEST:B7:4 — the grace clock ran out: charged, unknown and mark 21 (AC:B7:8)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — the approved retry whose notice was lost is settled by the sweep: P1 + S5, never S6',
        async () => {
            const e = await expiryFixture({ graceDays: 10, approveOnAttempt: 2 });
            const record = await e.real.readCharge({ chargeId: e.fixture.chargeId });
            const created = Date.parse(record.snapshot.createdAt);
            const expires = Date.parse(record.snapshot.expiresAt ?? record.snapshot.createdAt);
            // The approved retry (attempt 2) happens before the clock runs out.
            expect(created + (expires - created) / 4).toBeLessThan(e.graceEndsAt.getTime());

            e.advanceTo(e.graceEndsAt.getTime() + HOUR_MS);
            await e.runCheck();

            const row = await subscriptionRow(e.subscriptionId);
            expect(row.status).toBe('ACTIVE');
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            const payment = await paymentFor(e.fixture.chargeId);
            expect(payment?.status).toBe('SUCCEEDED');
            const covered = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment?.id ?? randomUUID()));
            expect(covered).toHaveLength(1);
            expect(e.cancel).not.toHaveBeenCalled();
            expect(e.beforeCancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'a2 — an older, already credited charge read as "charged" does not reactivate; the unpaid period then runs S6',
        async () => {
            const e = await expiryFixture();
            e.advanceTo(e.graceEndsAt.getTime() + HOUR_MS);
            // Hide the failed record and keep the counter consistent: the newest listed is the paid one.
            const failedChargeId = e.fixture.chargeId;
            e.bend.listFilter = (ids) => ids.filter((id) => id !== failedChargeId);
            e.bend.countDelta = -1;
            const input = await e.checkInput();
            await expect(
                readPeriodCharges(
                    { authorizationRead: input.read, act: input.act },
                    { provider: e.provider }
                )
            ).resolves.toEqual({ verdict: 'CHARGED', chargeId: e.fixture.initialChargeId });

            await e.runCheck();

            const row = await subscriptionRow(e.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).toEqual(e.graceEndsAt);
            expect(await openMarks(e.subscriptionId)).toEqual([]);
            expect(e.cancel).not.toHaveBeenCalled();

            e.bend.listFilter = null;
            e.bend.countDelta = 0;
            await e.runCheck();

            const suspended = await subscriptionRow(e.subscriptionId);
            expect(suspended.status).toBe('SUSPENDED');
            expect(e.cancel).toHaveBeenCalledTimes(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'a3 — S5 run by the sweep opens reason 7 with the job as actor',
        async () => {
            const e = await expiryFixture({ graceDays: 10, approveOnAttempt: 2 });
            await e.real.changeAmount({
                authorizationId: e.fixture.started.authorizationId,
                amount: { amountMinor: 300000, currency: 'ARS' }
            });
            e.advanceTo(e.graceEndsAt.getTime() + HOUR_MS);
            await e.runCheck();

            const row = await subscriptionRow(e.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            const marks = await openMarks(e.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
            const events = await getServiceTestDb()
                .select()
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.entityId, e.subscriptionId),
                        eq(domainEvent.eventType, 'reconciliation.mark_opened')
                    )
                );
            expect(events.map((event) => event.actorType)).toEqual(['job']);
            expect(e.cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — the charge cannot be settled: the check throws, the row stays in grace, the next run reactivates',
        async () => {
            const e = await expiryFixture({ graceDays: 10, approveOnAttempt: 2 });
            const chargeId = e.fixture.chargeId;
            // The §4 read reads it once; the settling re-read by id is the second read in the run.
            e.bend.charge = (input) =>
                input.chargeId === chargeId && input.callInRun >= 2 ? 'THROW' : null;
            e.advanceTo(e.graceEndsAt.getTime() + HOUR_MS);

            await expect(e.runCheck()).rejects.toThrow('charge read failed');

            const row = await subscriptionRow(e.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).toEqual(e.graceEndsAt);
            expect((await paymentFor(chargeId))?.status).not.toBe('SUCCEEDED');
            expect(e.cancel).not.toHaveBeenCalled();

            e.bend.charge = null;
            await e.runCheck();

            expect((await subscriptionRow(e.subscriptionId)).status).toBe('ACTIVE');
            expect((await paymentFor(chargeId))?.status).toBe('SUCCEEDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — settleChargedPeriod on an ACTIVE row only credits (P1, no S5, no S6)',
        async () => {
            const fixture = await graceFixture();
            seeded.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: randomUUID()
            });
            const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => 'SENT');

            const result = await settleChargedPeriod(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: { beforeCancel },
                    payments: creditedPaymentsFromLedger,
                    planPolicy: fixture.planPolicy,
                    coverageNotices: fixture.coverageNotices
                }
            );

            expect(result).toMatchObject({ outcome: 'CREDITED' });
            expect(result.outcome === 'CREDITED' ? result.exit : 'not credited').toBeUndefined();
            expect((await paymentFor(chargeId))?.status).toBe('SUCCEEDED');
            const row = await subscriptionRow(fixture.started.subscriptionId);
            expect(row.status).toBe('ACTIVE');
            expect(row.graceEndsAt).toBeNull();
            expect(beforeCancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — "still unknown": no S6; a notice after one day from the record, reason 21 at three days, then it accumulates',
        async () => {
            const e = await expiryFixture({ graceDays: 1 });
            const record = await e.real.readCharge({ chargeId: e.fixture.chargeId });
            const createdAt = Date.parse(record.snapshot.createdAt);
            const initialChargeId = e.fixture.initialChargeId;
            // Incomplete inventory: the list omits the paid record, the newest one is still read.
            e.bend.listFilter = (ids) => ids.filter((id) => id !== initialChargeId);

            e.advanceTo(createdAt + DAY_MS);
            expect(e.graceEndsAt.getTime()).toBeLessThanOrEqual(createdAt + DAY_MS);
            await e.runCheck();
            expect(e.notify).not.toHaveBeenCalled();
            expect(e.cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(e.subscriptionId)).status).toBe('GRACE_PERIOD');

            e.advanceTo(createdAt + DAY_MS + 1);
            await e.runCheck();
            expect(e.notify).toHaveBeenCalledTimes(1);
            expect(e.notify).toHaveBeenCalledWith({
                subscriptionId: e.subscriptionId,
                chargeId: e.fixture.chargeId,
                since: new Date(createdAt),
                reason: 'INCOMPLETE_INVENTORY'
            });
            expect(await openMarks(e.subscriptionId)).toEqual([]);

            e.advanceTo(createdAt + 2 * DAY_MS);
            await e.runCheck();
            expect(await openMarks(e.subscriptionId)).toEqual([]);

            e.advanceTo(createdAt + 3 * DAY_MS);
            await e.runCheck();
            const opened = await openMarks(e.subscriptionId);
            expect(opened.map((mark) => mark.reason)).toEqual(['COBRO_DEL_PERIODO_SIN_RESOLVER']);

            await e.runCheck();
            const accumulated = await openMarks(e.subscriptionId);
            expect(accumulated.map((mark) => mark.id)).toEqual(opened.map((mark) => mark.id));
            expect(e.cancel).not.toHaveBeenCalled();
            expect(e.beforeCancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(e.subscriptionId)).status).toBe('GRACE_PERIOD');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — a failed read: no S6, and the wait is aged from grace_started_at',
        async () => {
            const e = await expiryFixture({ graceDays: 1 });
            e.bend.listFilter = 'THROW';
            e.advanceTo(e.graceEndsAt.getTime() + 1);
            await e.runCheck();

            expect(e.cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(e.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(e.graceEndsAt.getTime() - e.graceStartedAt.getTime()).toBe(DAY_MS);
            expect(e.notify).toHaveBeenCalledWith({
                subscriptionId: e.subscriptionId,
                chargeId: null,
                since: e.graceStartedAt,
                reason: 'READ_FAILED'
            });
            expect(await openMarks(e.subscriptionId)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1697:9 AC:1697:4 f — with reason 21 open, a later "did not charge" still does not run S6',
        async () => {
            const e = await expiryFixture();
            await openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: e.subscriptionId },
                reason: 'COBRO_DEL_PERIODO_SIN_RESOLVER',
                actor: { type: 'job' },
                correlationId: randomUUID()
            });
            e.advanceTo(e.graceEndsAt.getTime() + HOUR_MS);
            const input = await e.checkInput();
            await expect(
                readPeriodCharges(
                    { authorizationRead: input.read, act: input.act },
                    { provider: e.provider }
                )
            ).resolves.toMatchObject({ verdict: 'NOT_CHARGED' });

            await e.runCheck();

            expect(e.cancel).not.toHaveBeenCalled();
            expect(e.beforeCancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(e.subscriptionId)).status).toBe('GRACE_PERIOD');

            // A person lifts reason 21 through action 7 (S15), not by hand.
            await liftOpenMarkAsAdmin({
                subscriptionId: e.subscriptionId,
                reason: 'COBRO_DEL_PERIODO_SIN_RESOLVER'
            });
            await e.runCheck();
            expect((await subscriptionRow(e.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('g — a pending current record: no S6', async () => {
        const e = await expiryFixture();
        const chargeId = e.fixture.chargeId;
        e.bend.charge = (input) => (input.chargeId === chargeId ? 'PENDING' : null);
        e.advanceTo(e.graceEndsAt.getTime() + HOUR_MS);
        await e.runCheck();

        expect(e.cancel).not.toHaveBeenCalled();
        expect(e.beforeCancel).not.toHaveBeenCalled();
        const row = await subscriptionRow(e.subscriptionId);
        expect(row.status).toBe('GRACE_PERIOD');
        expect(row.graceEndsAt).toEqual(e.graceEndsAt);
        // Seven days after the record started it is past the three-day bound: reason 21.
        expect((await openMarks(e.subscriptionId)).map((mark) => mark.reason)).toEqual([
            'COBRO_DEL_PERIODO_SIN_RESOLVER'
        ]);
    });
});
