import {
    type DrizzleClient,
    domainEventModel,
    eq,
    RECONCILIATION_MARK_REASON_CATALOG,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { applyS21 } from '../../../src/services/billing/subscription/complement-s21';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    orphanNow as now,
    orphanPorts,
    readDecisions,
    seedComplement,
    seedComplementCharge,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures';

afterAll(closeServiceTestPool);

async function seedCase(
    tx: DrizzleClient,
    input: {
        readonly cause?: 'OTHER_CAUSE' | 'GRANT_REVOKED' | 'REVOCATION';
        readonly daysAgo?: number;
        readonly status?: string;
        readonly cycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
        readonly coveredPeriodStart?: Date;
        readonly withCharge?: boolean;
    } = {}
) {
    const { userId } = await seedOrphanOwner(tx);
    const complement = await seedComplement(tx, {
        userId,
        vertical: 'accommodation',
        status: 'ACTIVE'
    });
    const instance = await seedOrphanInstance(tx, {
        ownerId: userId,
        scopeType: 'USER',
        compatibleVerticals: ['accommodation'],
        status: 'CANCELLED',
        complementSubscriptionId: complement.subscriptionId,
        cycle: input.cycle
    });
    const factAt = new Date(now.getTime() - (input.daysAgo ?? 11) * 24 * 60 * 60 * 1000);
    const charge =
        input.withCharge === false
            ? undefined
            : await seedComplementCharge(tx, {
                  subscriptionId: complement.subscriptionId,
                  factAt,
                  status: input.status,
                  coveredPeriodStart: input.coveredPeriodStart
              });
    return {
        complementId: complement.subscriptionId,
        productId: instance.productId,
        paymentId: charge?.paymentId,
        cause: input.cause ?? 'OTHER_CAUSE'
    };
}

async function readRows(tx: DrizzleClient, subscriptionId: string, paymentId?: string) {
    const marks = await tx
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    const refundsForPayment = paymentId
        ? await tx.select().from(refunds).where(eq(refunds.paymentId, paymentId))
        : [];
    const hangs = paymentId
        ? await tx
              .select()
              .from(reconciliationMarkPayments)
              .where(eq(reconciliationMarkPayments.paymentId, paymentId))
        : [];
    return { marks, refunds: refundsForPayment, hangs };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B5:14 TEST:B5:15 AC:B5:29 S21 settles the last complement charge',
    () => {
        it('TEST:B5:14 opens reason 14 with its credited payment hung and no refund', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedCase(tx);
                await applyS21({ tx, complementSubscriptionId: seeded.complementId, now });
                const rows = await readRows(tx, seeded.complementId, seeded.paymentId);
                expect(rows.marks.map((mark) => mark.reason)).toEqual([
                    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
                ]);
                expect(
                    RECONCILIATION_MARK_REASON_CATALOG
                        .COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA.defaultProposal
                ).toBe('NO_REFUND');
                expect(rows.hangs).toHaveLength(1);
                expect(rows.hangs[0]?.resolvedAt).toBeNull();
                expect(rows.refunds).toEqual([]);
                const events = await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.complementId,
                    tx
                });
                expect(
                    events.some((event) => event.eventType === 'reconciliation.mark_opened')
                ).toBe(true);
            });
        });

        it('TEST:B5:14 opens reason 15 for grant revocation', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedCase(tx, { cause: 'GRANT_REVOKED' });
                await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now,
                    cause: seeded.cause
                });
                const rows = await readRows(tx, seeded.complementId, seeded.paymentId);
                expect(rows.marks.map((mark) => mark.reason)).toEqual([
                    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION'
                ]);
                expect(
                    RECONCILIATION_MARK_REASON_CATALOG
                        .COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION.defaultProposal
                ).toBe('REFUND');
                expect(rows.hangs).toHaveLength(1);
                expect(rows.refunds).toEqual([]);
            });
        });

        it('TEST:B5:15 requests RF1 inside the revocation window and opens no mark', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedCase(tx, { cause: 'REVOCATION', daysAgo: 3 });
                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now,
                    cause: seeded.cause
                });
                const rows = await readRows(tx, seeded.complementId, seeded.paymentId);
                expect(result).toMatchObject({
                    charge: { kind: 'REFUND_REQUESTED', amount: 250000 }
                });
                expect(rows.refunds).toHaveLength(1);
                expect(rows.refunds[0]).toMatchObject({
                    status: 'REQUESTED',
                    reason: 'ADDON_ORPHAN',
                    amount: 250000
                });
                expect(rows.marks).toEqual([]);
                expect(await readDecisions(tx, seeded.complementId)).toEqual([]);
            });
        });

        it('TEST:B5:15 uses reason 14 after the revocation window', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedCase(tx, { cause: 'REVOCATION', daysAgo: 12 });
                await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now,
                    cause: seeded.cause
                });
                const rows = await readRows(tx, seeded.complementId, seeded.paymentId);
                expect(rows.marks.map((mark) => mark.reason)).toEqual([
                    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
                ]);
                expect(rows.refunds).toEqual([]);
            });
        });

        it('TEST:B5:15 ignores ended, absent, refunded and charged-back charges', async () => {
            await withServiceTestTransaction(async (tx) => {
                const ended = await seedCase(tx, { daysAgo: 40 });
                await applyS21({ tx, complementSubscriptionId: ended.complementId, now });
                expect(await readRows(tx, ended.complementId, ended.paymentId)).toMatchObject({
                    marks: [],
                    refunds: [],
                    hangs: []
                });
                const absent = await seedCase(tx, { withCharge: false });
                await applyS21({ tx, complementSubscriptionId: absent.complementId, now });
                expect(await readRows(tx, absent.complementId)).toMatchObject({
                    marks: [],
                    refunds: [],
                    hangs: []
                });
                for (const status of ['REFUNDED', 'CHARGED_BACK']) {
                    const seeded = await seedCase(tx, { status });
                    await applyS21({ tx, complementSubscriptionId: seeded.complementId, now });
                    expect(await readRows(tx, seeded.complementId, seeded.paymentId)).toMatchObject(
                        { marks: [], refunds: [], hangs: [] }
                    );
                }
            });
        });

        it('TEST:B5:15 uses the product cycle and an open covered period over fact_at', async () => {
            await withServiceTestTransaction(async (tx) => {
                const annual = await seedCase(tx, { daysAgo: 240, cycle: 'annual' });
                await applyS21({ tx, complementSubscriptionId: annual.complementId, now });
                expect(
                    (await readRows(tx, annual.complementId, annual.paymentId)).marks
                ).toHaveLength(1);
                const quarterly = await seedCase(tx, { daysAgo: 120, cycle: 'quarterly' });
                await applyS21({ tx, complementSubscriptionId: quarterly.complementId, now });
                expect(
                    (await readRows(tx, quarterly.complementId, quarterly.paymentId)).marks
                ).toEqual([]);
                const reimputed = await seedCase(tx, {
                    daysAgo: 40,
                    coveredPeriodStart: new Date('2026-10-01T10:00:00.000Z')
                });
                await applyS21({ tx, complementSubscriptionId: reimputed.complementId, now });
                expect(
                    (await readRows(tx, reimputed.complementId, reimputed.paymentId)).marks
                ).toHaveLength(1);
            });
        });

        it('TEST:B5:15 discounts pending and executed refunds from RF1 balance', async () => {
            await withServiceTestTransaction(async (tx) => {
                const claimed = await seedCase(tx, { cause: 'REVOCATION', daysAgo: 3 });
                await tx.insert(refunds).values({
                    paymentId: claimed.paymentId,
                    amount: 250000,
                    reason: 'ADDON_ORPHAN',
                    status: 'REQUESTED'
                });
                const result = await applyS21({
                    tx,
                    complementSubscriptionId: claimed.complementId,
                    now,
                    cause: claimed.cause
                });
                expect(result).toMatchObject({
                    charge: { kind: 'NOTHING', why: 'BALANCE_CLAIMED' }
                });
                expect(
                    (await readRows(tx, claimed.complementId, claimed.paymentId)).refunds
                ).toHaveLength(1);
                const partial = await seedCase(tx, { cause: 'REVOCATION', daysAgo: 3 });
                await tx.insert(refunds).values({
                    paymentId: partial.paymentId,
                    amount: 100000,
                    reason: 'ADDON_ORPHAN',
                    status: 'EXECUTED',
                    executedVia: 'PROVIDER'
                });
                const partialResult = await applyS21({
                    tx,
                    complementSubscriptionId: partial.complementId,
                    now,
                    cause: partial.cause
                });
                expect(partialResult).toMatchObject({
                    charge: { kind: 'REFUND_REQUESTED', amount: 150000 }
                });
            });
        });

        it('TEST:B5:15 does not settle twice and does not duplicate an open mark', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedCase(tx);
                const first = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });
                const second = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });
                expect(first.outcome).toBe('CANCELLED');
                expect(second).toEqual({ outcome: 'ALREADY_CANCELLED' });
                expect(
                    (await readRows(tx, seeded.complementId, seeded.paymentId)).marks
                ).toHaveLength(1);
            });
        });

        it('TEST:B5:15 accumulates the new payment on an open mark of the same reason', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedCase(tx);
                const firstPayment = seeded.paymentId;
                if (!firstPayment) throw new Error('seeded mark payment missing');
                const paymentsPort = createPaymentReconciliationMarkPayments({ now: () => now });
                await openReconciliationMark(
                    {
                        subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.complementId },
                        reason: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA',
                        payment: { source: 'PAYMENT', id: firstPayment },
                        actor: { type: 'job' },
                        correlationId: crypto.randomUUID(),
                        tx
                    },
                    { markPayments: paymentsPort }
                );
                const second = await seedComplementCharge(tx, {
                    subscriptionId: seeded.complementId,
                    factAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
                });
                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });
                expect(result).toMatchObject({
                    charge: { kind: 'MARK_OPENED', outcome: 'ACCUMULATED' }
                });
                const rows = await readRows(tx, seeded.complementId, second.paymentId);
                expect(rows.marks).toHaveLength(1);
                expect(rows.hangs).toHaveLength(1);
            });
        });

        it.each([
            { cause: 'REVOCATION' as const, expected: 'REFUND_REQUESTED' as const },
            { cause: undefined, expected: 'MARK_OPENED' as const }
        ])('TEST:B5:15 carries $cause from runOrphanhood into S21', async ({ cause, expected }) => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId: principalId } = await seedPrincipal(tx, {
                    userId,
                    vertical: 'accommodation',
                    status: 'CANCELLED'
                });
                const complement = await seedComplement(tx, {
                    userId,
                    vertical: 'accommodation',
                    status: 'ACTIVE'
                });
                const instance = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: ['accommodation'],
                    targetId: principalId,
                    status: 'ACTIVE',
                    complementSubscriptionId: complement.subscriptionId
                });
                const charge = await seedComplementCharge(tx, {
                    subscriptionId: complement.subscriptionId,
                    factAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
                });
                const { ports } = orphanPorts(tx);
                const result = await runOrphanhood(
                    { tx, subscriptionId: principalId, now, s21Cause: cause },
                    ports
                );
                expect(result.cancelled.map((addon) => addon.instanceId)).toContain(
                    instance.instanceId
                );
                const chargeOutcome = await readRows(
                    tx,
                    complement.subscriptionId,
                    charge.paymentId
                );
                if (expected === 'REFUND_REQUESTED')
                    expect(chargeOutcome.refunds).toMatchObject([
                        { status: 'REQUESTED', reason: 'ADDON_ORPHAN' }
                    ]);
                else
                    expect(chargeOutcome.marks.map((mark) => mark.reason)).toEqual([
                        'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
                    ]);
            });
        });
    }
);
