import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    type DomainEventChange,
    type DrizzleClient,
    domainEvent,
    eq,
    getDb,
    inArray,
    isNotNull,
    ne,
    or,
    payments,
    type ReconciliationMarkReason,
    reconciliationMarkPayments,
    reconciliationMarks,
    sql
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { type AnyColumn, exists, notExists, type SQL } from 'drizzle-orm';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';

const logger = createLogger('addon-one-time-page-charge-marks');

/**
 * The reasons a payment made on a one-time page may raise on its instance (HOS-2179): another
 * amount (MOT:5, AC-8), a second collection on the same page (MOT:20, §5.8, AC-11) and money
 * on a purchase that closed with no payment (MOT:23, §5.9, AC-12). One payment raises at most
 * one of them: A2 decides the amount first.
 */
export const ONE_TIME_PAGE_CHARGE_MARK_REASONS = [
    'DIVERGENCIA_DE_MONTO',
    'COBRO_DUPLICADO',
    'ORDEN_PAGADA_SIN_INSTANCIA'
] as const satisfies readonly ReconciliationMarkReason[];

/** One reason of {@link ONE_TIME_PAGE_CHARGE_MARK_REASONS}. */
export type OneTimePageChargeMarkReason = (typeof ONE_TIME_PAGE_CHARGE_MARK_REASONS)[number];

/**
 * The subquery behind {@link heldByPageChargeMark}: the payment hangs, resolved or not, from a
 * mark on an add-on instance with one of the three page-charge reasons. Other reasons an
 * instance may carry later (a chargeback, for one) do not make a payment held.
 */
function pageChargeMarkHolding(paymentId: AnyColumn) {
    return getDb()
        .select({ one: sql`1` })
        .from(reconciliationMarkPayments)
        .innerJoin(
            reconciliationMarks,
            eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
        )
        .where(
            and(
                eq(reconciliationMarkPayments.paymentId, paymentId),
                isNotNull(reconciliationMarks.addonInstanceId),
                inArray(reconciliationMarks.reason, [...ONE_TIME_PAGE_CHARGE_MARK_REASONS])
            )
        );
}

/**
 * D1 of HOS-2179 (owner, 2026-11-20): a page charge a mark holds has its own `payment` row, so a
 * person can refund it through the ordinary refund path. That row is NOT the purchase's payment:
 * it never activated anything, was never credited, and stays held after its refund resolves the
 * mark. This condition is true for such a row. Every reader that means "the payment of the
 * purchase" (the one that activated it) filters with {@link notHeldByPageChargeMark}.
 *
 * @param paymentId - The `payment.id` column of the row being read
 * @returns A condition true when a page-charge mark holds that payment
 */
export function heldByPageChargeMark(paymentId: AnyColumn = payments.id): SQL {
    return exists(pageChargeMarkHolding(paymentId));
}

/**
 * The negation of {@link heldByPageChargeMark}: the payment is not held by a page-charge mark.
 * On a one-time instance that leaves only the payment that activated it.
 *
 * @param paymentId - The `payment.id` column of the row being read
 * @returns A condition true when no page-charge mark holds that payment
 */
export function notHeldByPageChargeMark(paymentId: AnyColumn = payments.id): SQL {
    return notExists(pageChargeMarkHolding(paymentId));
}

/** Who opens the mark: the notice receiver (`provider`) or the reconciliation sweep (`job`). */
export interface OneTimePageMarkTrigger {
    readonly actor: 'provider' | 'job';
    readonly correlationId?: string;
}

/**
 * Whether a mark on the instance already holds this provider charge, so no other mark may open
 * for the same money: one payment raises at most one mark (§5.8-§5.10), even when a later re-read
 * would classify it differently (a price fixed after a divergence). No reason filter is needed:
 * ck_reconciliation_mark_instance_reasons admits only these three reasons on an instance. A charge is tied to its mark
 * only through the `provider.charge_id` of an opening event, because the open-mark uniqueness is
 * per (instance, reason) over OPEN marks only.
 *
 * @param input.instanceId - The one-time page purchase
 * @param input.chargeId - The provider's id of the payment
 * @param input.accumulatesOn - A reason whose OPEN mark does not count: a repeat of that reason
 *   accumulates on it instead. Lifted marks of it still count, so a lift is never undone.
 * @returns True when such a mark names the charge
 */
export async function chargeNamedByMark(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly accumulatesOn?: OneTimePageChargeMarkReason;
}): Promise<boolean> {
    const [named] = await getDb()
        .select({ id: reconciliationMarks.id })
        .from(reconciliationMarks)
        .innerJoin(
            domainEvent,
            and(
                eq(domainEvent.eventType, 'reconciliation.mark_opened'),
                eq(domainEvent.entityType, 'addon_instance'),
                eq(domainEvent.entityId, input.instanceId),
                sql`${domainEvent.changes} @> jsonb_build_array(jsonb_build_object('field', 'reconciliation_mark.id', 'new', ${reconciliationMarks.id}::text))`,
                sql`${domainEvent.changes} @> ${JSON.stringify([{ field: 'provider.charge_id', new: input.chargeId }])}::jsonb`
            )
        )
        .where(
            and(
                eq(reconciliationMarks.addonInstanceId, input.instanceId),
                input.accumulatesOn
                    ? or(
                          ne(reconciliationMarks.reason, input.accumulatesOn),
                          isNotNull(reconciliationMarks.liftedAt)
                      )
                    : undefined
            )
        )
        .limit(1);
    return named !== undefined;
}

/** The approved page charge a mark holds, as the fresh read by id gave it. */
export interface HeldPageCharge {
    readonly amount: { readonly amountMinor: number; readonly currency: string };
    /** When the provider created the charge: the refund window runs from here. */
    readonly createdAt: Date;
}

/**
 * Reads, or inserts, the held `payment` row of one page charge (D1). It is born `SUCCEEDED`,
 * because the provider did take the money and the refund path refunds only such a row, but it
 * never goes through P1 (`creditPayment`): no receipt, no covered period, no billing fact.
 * Keyed by `(provider, provider_fact_id)` like every payment, so concurrent entries converge.
 *
 * @returns The row and whether it still has to be hung from the mark. An existing row that no
 *   page-charge mark holds is the purchase's own payment: it is never hung (fails closed).
 */
async function heldPaymentFor(input: {
    readonly tx: DrizzleClient;
    readonly instanceId: string;
    readonly chargeId: string;
    readonly charge: HeldPageCharge;
}): Promise<{ readonly paymentId: string; readonly hang: boolean }> {
    const existing = async () =>
        (
            await input.tx
                .select({
                    id: payments.id,
                    addonInstanceId: payments.addonInstanceId,
                    held: heldByPageChargeMark()
                })
                .from(payments)
                .where(
                    and(
                        eq(payments.provider, 'MERCADO_PAGO'),
                        eq(payments.providerFactId, input.chargeId)
                    )
                )
                .limit(1)
        )[0];
    let row = await existing();
    if (!row) {
        const [inserted] = await input.tx
            .insert(payments)
            .values({
                addonInstanceId: input.instanceId,
                subscriptionId: null,
                amount: input.charge.amount.amountMinor,
                currency: input.charge.amount.currency,
                status: 'SUCCEEDED',
                provider: 'MERCADO_PAGO',
                providerFactId: input.chargeId,
                providerPaymentId: input.chargeId,
                factAt: input.charge.createdAt
            })
            .onConflictDoNothing()
            .returning({ id: payments.id });
        if (inserted) return { paymentId: inserted.id, hang: true };
        // A concurrent entry wrote the row first; the insert waited for it to commit.
        row = await existing();
        if (!row) throw new Error('The held page payment could not be read back');
    }
    if (row.addonInstanceId !== input.instanceId || !row.held)
        throw new Error('The charge already has a payment that no page-charge mark holds');
    return { paymentId: row.id, hang: false };
}

/**
 * Opens (or accumulates on) one mark for one payment of a page purchase, with the provider's id
 * first in its event. A repeated notice, A3 or the sweep accumulates on the same open mark; a
 * charge already held by a lifted mark, or by a mark of another reason, opens nothing. The charge
 * id and amounts (and, for a refundable reason, the proposed refund) travel in the event.
 *
 * D1 of HOS-2179 (owner, 2026-11-20): in the same transaction the charge gets its held `payment`
 * row, hung from the mark through `reconciliation_mark_payment`, so a person can refund it
 * through RF1/RF2 and RF3 resolves the mark's payment once the refund executes. The row is never
 * credited (see {@link heldByPageChargeMark}). A charge already hung keeps its single row.
 *
 * @param input.instanceId - The one-time page purchase
 * @param input.chargeId - The provider's id of the payment
 * @param input.charge - The amount and creation instant the fresh read gave
 * @param input.reason - The reason to open
 * @param input.detail - What else travels in the event
 * @param input.trigger - Who opens it
 * @param input.clock - The clock that stamps when the payment was hung
 * @returns `MARKED` once a mark holds this charge; `UNKNOWN` when it could not be opened
 */
export async function openOneTimePageChargeMark(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly charge: HeldPageCharge;
    readonly reason: OneTimePageChargeMarkReason;
    readonly detail: readonly DomainEventChange[];
    readonly trigger?: OneTimePageMarkTrigger;
    readonly clock: Clock;
}): Promise<'MARKED' | 'UNKNOWN'> {
    try {
        if (
            await chargeNamedByMark({
                instanceId: input.instanceId,
                chargeId: input.chargeId,
                accumulatesOn: input.reason
            })
        )
            return 'MARKED';
        await getDb().transaction(async (tx) => {
            // A catalog-typed reason, as GUARD:G-R1-F (a) requires of every opening.
            const reason: ReconciliationMarkReason = input.reason;
            const held = await heldPaymentFor({
                tx,
                instanceId: input.instanceId,
                chargeId: input.chargeId,
                charge: input.charge
            });
            await openReconciliationMark(
                {
                    subject: { kind: 'ADDON_INSTANCE', addonInstanceId: input.instanceId },
                    reason,
                    ...(held.hang
                        ? { payment: { source: 'PAYMENT' as const, id: held.paymentId } }
                        : {}),
                    actor: { type: input.trigger?.actor ?? 'provider' },
                    correlationId: input.trigger?.correlationId ?? randomUUID(),
                    detail: [{ field: 'provider.charge_id', new: input.chargeId }, ...input.detail],
                    tx
                },
                { markPayments: createPaymentReconciliationMarkPayments(input.clock) }
            );
        });
    } catch (error) {
        logger.error(
            {
                instanceId: input.instanceId,
                chargeId: input.chargeId,
                reason: input.reason,
                error: error instanceof Error ? error.message : String(error)
            },
            'Could not open the one-time page payment mark; left undecided'
        );
        return 'UNKNOWN';
    }
    return 'MARKED';
}
