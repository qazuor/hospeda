import {
    eq,
    inArray,
    manualPayments,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { readReconciliationMarkEvents } from '../../../src/services/billing/reconciliation/actionable-mark-events.js';
import { listActionableReconciliationMarks } from '../../../src/services/billing/reconciliation/actionable-marks.js';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import type { HangablePayment } from '../../../src/services/billing/reconciliation/reconciliation-mark-payments.port.js';
import { lateRejectionDetail } from '../../../src/services/billing/subscription/late-payment-conditions.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';

type Fixture = {
    readonly userId: string;
    readonly subscriptionId: string;
};
const fixtures: Fixture[] = [];
const paymentIds: string[] = [];
const manualPaymentIds: string[] = [];
let hangClockTick = 1_790_000_000_000;

afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getServiceTestDb();
    for (const fixture of fixtures) {
        const ownedMarks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, fixture.subscriptionId));
        for (const mark of ownedMarks) {
            await db
                .delete(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, mark.id));
            await db.delete(reconciliationMarks).where(eq(reconciliationMarks.id, mark.id));
        }
    }
    if (paymentIds.length)
        await db.delete(payments).where(inArray(payments.id, paymentIds.splice(0)));
    if (manualPaymentIds.length)
        await db
            .delete(manualPayments)
            .where(inArray(manualPayments.id, manualPaymentIds.splice(0)));
    for (const fixture of fixtures.splice(0)) {
        await db.delete(subscriptions).where(eq(subscriptions.id, fixture.subscriptionId));
        await db.delete(users).where(eq(users.id, fixture.userId));
    }
});

async function seedFixture(
    options: { readonly status?: string; readonly anchored?: boolean } = {}
): Promise<Fixture> {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `actionable-${crypto.randomUUID()}@example.test`,
            displayName: 'Actionable mark test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('No test user');
    let planId: string | null = null;
    let planVersionId: string | null = null;
    let optionId: string | null = null;
    if (options.anchored !== false) {
        const pool = getServiceTestPool();
        planId =
            (
                await pool.query<{ id: string }>(
                    'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
                    ['accommodation', `actionable-${crypto.randomUUID()}`, 'Actionable test plan']
                )
            ).rows[0]?.id ?? null;
        planVersionId =
            (
                await pool.query<{ id: string }>(
                    "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
                    [planId, Math.floor(Math.random() * 1e8) + 1]
                )
            ).rows[0]?.id ?? null;
        optionId =
            (
                await pool.query<{ id: string }>(
                    "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
                    [planVersionId]
                )
            ).rows[0]?.id ?? null;
    }
    const [subscription] =
        options.anchored === false
            ? await db
                  .insert(subscriptions)
                  .values({
                      userId: user.id,
                      vertical: 'accommodation',
                      paymentMethod: 'MANUAL',
                      status: 'CANCELLED',
                      class: 'COMPLEMENTO'
                  })
                  .returning({ id: subscriptions.id })
            : await db
                  .insert(subscriptions)
                  .values({
                      userId: user.id,
                      vertical: 'accommodation',
                      planVersionId,
                      billingOptionId: optionId,
                      paymentMethod: 'CARD',
                      status: options.status ?? 'ACTIVE',
                      class: 'PRINCIPAL',
                      ...(options.status === 'GRACE_PERIOD'
                          ? {
                                graceStartedAt: new Date(),
                                graceEndsAt: new Date(Date.now() + 86_400_000)
                            }
                          : {})
                  })
                  .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('No test subscription');
    const fixture = { userId: user.id, subscriptionId: subscription.id };
    fixtures.push(fixture);
    return fixture;
}

async function seedProviderPayment(subscriptionId: string, amount: number) {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId,
            amount,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'mercadopago',
            providerFactId: `actionable-${crypto.randomUUID()}`,
            factAt: new Date()
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('No test payment');
    paymentIds.push(payment.id);
    return { source: 'PAYMENT' as const, id: payment.id };
}

async function seedManualPayment(subscriptionId: string) {
    const [manual] = await getServiceTestDb()
        .insert(manualPayments)
        .values({
            subscriptionId,
            periodStart: new Date(),
            status: 'AWAITING'
        })
        .returning({ id: manualPayments.id });
    if (!manual) throw new Error('No test manual payment');
    manualPaymentIds.push(manual.id);
    return { source: 'MANUAL_PAYMENT' as const, id: manual.id };
}

const open = (
    fixture: Fixture,
    reason:
        | 'DIVERGENCIA_DE_MONTO'
        | 'PAGO_TARDIO_RECHAZADO'
        | 'COBRO_DUPLICADO'
        | 'REEMBOLSO_POR_CONFIRMAR',
    payment?: HangablePayment,
    detail?: Parameters<typeof openReconciliationMark>[0]['detail']
) =>
    openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.subscriptionId },
            reason,
            ...(payment ? { payment } : {}),
            ...(detail ? { detail } : {}),
            actor: { type: 'admin', id: fixture.userId },
            correlationId: crypto.randomUUID()
        },
        {
            markPayments: createPaymentReconciliationMarkPayments({
                now: () => new Date(hangClockTick++)
            })
        }
    );

async function allActionableMarks() {
    const items: Awaited<ReturnType<typeof listActionableReconciliationMarks>>['items'][number][] =
        [];
    let page = 1;
    let total = 0;
    do {
        const result = await listActionableReconciliationMarks({ page, pageSize: 100 });
        items.push(...result.items);
        total = result.total;
        page++;
    } while (items.length < total);
    return items;
}

describe('TEST:1620:6 — actionable reconciliation mark reads', () => {
    it('a-g/i: lists mark units and resolves only the current reason-7 events from placed_at', async () => {
        const subject = await seedFixture({ status: 'GRACE_PERIOD' });
        const otherSubject = await seedFixture();
        const orderingSubject = await seedFixture();
        const oldReasonFive = await open(subject, 'DIVERGENCIA_DE_MONTO');
        await liftReconciliationMark(
            {
                markId: oldReasonFive.mark.id,
                expectedVersion: oldReasonFive.mark.version,
                liftedBy: subject.userId
            },
            {
                clock: { now: () => new Date() },
                markPayments: createPaymentReconciliationMarkPayments({ now: () => new Date() })
            }
        );
        const previousReasonSeven = await open(subject, 'PAGO_TARDIO_RECHAZADO');
        await liftReconciliationMark(
            {
                markId: previousReasonSeven.mark.id,
                expectedVersion: previousReasonSeven.mark.version,
                liftedBy: subject.userId
            },
            {
                clock: { now: () => new Date() },
                markPayments: createPaymentReconciliationMarkPayments({ now: () => new Date() })
            }
        );
        const olderNonRefund = await open(orderingSubject, 'DIVERGENCIA_DE_MONTO');
        const laterRefund = await open(orderingSubject, 'COBRO_DUPLICADO');
        const firstPayment = await seedProviderPayment(subject.subscriptionId, 1200);
        const secondPayment = await seedProviderPayment(subject.subscriptionId, 2500);
        const currentReasonSeven = await open(
            subject,
            'PAGO_TARDIO_RECHAZADO',
            firstPayment,
            lateRejectionDetail({ failedCondition: 2 })
        );
        await open(subject, 'PAGO_TARDIO_RECHAZADO', secondPayment);
        const newerReasonFive = await open(subject, 'DIVERGENCIA_DE_MONTO');
        await open(otherSubject, 'PAGO_TARDIO_RECHAZADO');

        const items = await allActionableMarks();
        const ours = items.filter((item) =>
            [
                laterRefund.mark.id,
                olderNonRefund.mark.id,
                currentReasonSeven.mark.id,
                newerReasonFive.mark.id,
                previousReasonSeven.mark.id
            ].includes(item.markId)
        );
        const ids = items.map((item) => item.markId);
        expect(ours.map((item) => item.markId)).toContain(currentReasonSeven.mark.id);
        expect(ids).not.toContain(previousReasonSeven.mark.id);
        expect(ours).toHaveLength(4);
        expect(ours.find((item) => item.markId === currentReasonSeven.mark.id)).toMatchObject({
            reason: 'PAGO_TARDIO_RECHAZADO',
            reasonNumber: 7,
            refundConfirmation: true,
            defaultProposal: 'REFUND',
            eventLink: { markId: currentReasonSeven.mark.id },
            subject: { kind: 'SUBSCRIPTION', id: subject.subscriptionId, status: 'GRACE_PERIOD' },
            paymentCount: 2,
            totalAmount: [{ currency: 'ARS', amountMinor: 3700 }],
            unknownAmountCount: 0
        });
        expect(ours.find((item) => item.markId === newerReasonFive.mark.id)?.eventLink).toBeNull();
        expect(ids.indexOf(laterRefund.mark.id)).toBeLessThan(ids.indexOf(olderNonRefund.mark.id));
        expect(ids.indexOf(currentReasonSeven.mark.id)).toBeLessThan(
            ids.indexOf(newerReasonFive.mark.id)
        );
        const listedPayments =
            ours.find((item) => item.markId === currentReasonSeven.mark.id)?.payments ?? [];
        expect(listedPayments.map((payment) => payment.paymentId)).toEqual([
            firstPayment.id,
            secondPayment.id
        ]);
        expect(listedPayments[0]?.hungAt.getTime()).toBeLessThan(
            listedPayments[1]?.hungAt.getTime() ?? 0
        );

        const events = await readReconciliationMarkEvents({ markId: currentReasonSeven.mark.id });
        expect(events.mark).toMatchObject({ markId: currentReasonSeven.mark.id, reasonNumber: 7 });
        expect(events.events).toHaveLength(2);
        expect(events.events.map((event) => event.outcome).sort()).toEqual([
            'ACCUMULATED',
            'OPENED'
        ]);
        expect(events.events.find((event) => event.failedCondition === 2)).toMatchObject({
            conditionRecorded: true
        });
        expect(events.events.find((event) => event.outcome === 'ACCUMULATED')).toMatchObject({
            conditionRecorded: false
        });
        const liftedEvents = await readReconciliationMarkEvents({
            markId: previousReasonSeven.mark.id
        });
        expect(liftedEvents.mark.liftedAt).toBeInstanceOf(Date);
        expect(liftedEvents.events).toHaveLength(1);
        expect(liftedEvents.events[0]).toMatchObject({ outcome: 'OPENED' });
        const exactInstant = await getServiceTestPool().query<{ exact: boolean }>(
            `SELECT event.occurred_at = mark.placed_at AS exact
               FROM domain_event AS event
               JOIN reconciliation_mark AS mark ON mark.id = $1
              WHERE event.event_type = 'reconciliation.mark_opened'
                AND event.entity_type = 'subscription'
                AND event.entity_id = mark.subscription_id::text
                AND event.changes @> jsonb_build_array(jsonb_build_object('field', 'reconciliation_mark.id', 'new', mark.id))
                AND event.changes @> '[{"field":"reconciliation_mark.outcome","new":"OPENED"}]'::jsonb`,
            [currentReasonSeven.mark.id]
        );
        expect(exactInstant.rows).toEqual([{ exact: true }]);
    });

    it('d: prices an anchored manual payment and counts an unanchored amount as unknown', async () => {
        const anchored = await seedFixture();
        const unanchored = await seedFixture({ anchored: false });
        const anchoredManual = await seedManualPayment(anchored.subscriptionId);
        const unknownManual = await seedManualPayment(unanchored.subscriptionId);
        const knownMark = await open(anchored, 'REEMBOLSO_POR_CONFIRMAR', anchoredManual);
        const unknownMark = await open(unanchored, 'REEMBOLSO_POR_CONFIRMAR', unknownManual);

        const items = await allActionableMarks();
        expect(items.find((item) => item.markId === knownMark.mark.id)).toMatchObject({
            defaultProposal: 'REFUND',
            paymentCount: 1,
            payments: [
                {
                    source: 'MANUAL_PAYMENT',
                    amountMinor: 250000,
                    currency: 'ARS',
                    status: 'AWAITING'
                }
            ],
            totalAmount: [{ currency: 'ARS', amountMinor: 250000 }],
            unknownAmountCount: 0
        });
        expect(items.find((item) => item.markId === unknownMark.mark.id)).toMatchObject({
            payments: [{ source: 'MANUAL_PAYMENT', amountMinor: null, currency: null }],
            totalAmount: [],
            unknownAmountCount: 1
        });
    });

    it('h: returns not-found for malformed and nonexistent mark ids', async () => {
        await expect(readReconciliationMarkEvents({ markId: 'not-a-uuid' })).rejects.toMatchObject({
            code: 'NOT_FOUND',
            reason: 'RECONCILIATION_MARK_NOT_FOUND'
        });
        await expect(
            readReconciliationMarkEvents({ markId: crypto.randomUUID() })
        ).rejects.toMatchObject({
            code: 'NOT_FOUND',
            reason: 'RECONCILIATION_MARK_NOT_FOUND'
        });
    });
});
