import type {
    RetainedPayment,
    RetainedPaymentBranchResolver,
    RetainedPaymentsSource
} from './zero-call-ports.js';

/** The mark the zero-call check opens for a retained payment without a determinable branch. */
const RETAINED_PAYMENT_MARK_REASON = 'PAGO_PENDIENTE_SIN_RAMA';

/**
 * The real source of the zero-call check's retained payments (B11.8 second check,
 * HOS-1561 H11, Coord-74): every OPEN S19 retention (`succession_retained_payment`
 * with `released_at IS NULL`) of a provider payment, as `{ subscriptionId,
 * payment: { source: 'PAYMENT', id } }`.
 *
 * It EXCLUDES a retention whose payment already hangs unresolved
 * (`reconciliation_mark_payment.resolved_at IS NULL`) from an OPEN mark
 * (`lifted_at IS NULL`) of that same subscription with reason
 * `PAGO_PENDIENTE_SIN_RAMA`: the person already has it in front of them, and
 * listing it again would make every daily sweep fail with
 * `MARK_PAYMENT_ALREADY_HUNG`.
 *
 * Manual-payment retentions are not listed: they have no writer until Phase 4
 * (HOS-1561 H3). A read error propagates (the check reports it; never an empty
 * list). `@repo/db` is imported lazily: this module is exported from the
 * service-core barrel, which API unit tests load with `@repo/db` mocked whole.
 */
export const retainedPaymentsFromLedger: RetainedPaymentsSource = {
    async listRetainedPayments(): Promise<ReadonlyArray<RetainedPayment>> {
        const {
            and,
            eq,
            getDb,
            isNotNull,
            isNull,
            reconciliationMarkPayments,
            reconciliationMarks,
            sql,
            successionRetainedPayments
        } = await import('@repo/db');
        const db = getDb();
        const alreadyHung = db
            .select({ id: reconciliationMarkPayments.id })
            .from(reconciliationMarkPayments)
            .innerJoin(
                reconciliationMarks,
                eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
            )
            .where(
                and(
                    eq(reconciliationMarkPayments.paymentId, successionRetainedPayments.paymentId),
                    isNull(reconciliationMarkPayments.resolvedAt),
                    eq(
                        reconciliationMarks.subscriptionId,
                        successionRetainedPayments.subscriptionId
                    ),
                    eq(reconciliationMarks.reason, RETAINED_PAYMENT_MARK_REASON),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        const rows = await db
            .select({
                subscriptionId: successionRetainedPayments.subscriptionId,
                paymentId: successionRetainedPayments.paymentId
            })
            .from(successionRetainedPayments)
            .where(
                and(
                    isNull(successionRetainedPayments.releasedAt),
                    isNotNull(successionRetainedPayments.paymentId),
                    sql`not exists ${alreadyHung}`
                )
            )
            .orderBy(successionRetainedPayments.retainedAt, successionRetainedPayments.id);
        const retained: RetainedPayment[] = [];
        for (const row of rows) {
            if (row.paymentId === null) continue;
            retained.push({
                subscriptionId: row.subscriptionId,
                payment: { source: 'PAYMENT', id: row.paymentId }
            });
        }
        return retained;
    }
};

/**
 * The zero-call check's branch resolver (HOS-1561 H11): it answers `NO_BRANCH`
 * ALWAYS, so the check opens `PAGO_PENDIENTE_SIN_RAMA` with the payment hung and
 * a person decides (contexto §7: «si la rama no es determinable, se abre la
 * marca»).
 *
 * Why no branch is ever determinable here: the check makes ZERO provider calls,
 * so it cannot re-evaluate (branch 2 needs a fresh provider read), and the acts
 * of the other branches are not this sweep's — S18 (branches 1, 5 and 6) is
 * B8b's and S13 (branch 4) is B9a's. The check only reaches retentions whose
 * predecessor has no live successor left, i.e. a succession that ended without
 * its act turning the flag off.
 */
export const noDeterminableRetainedPaymentBranch: RetainedPaymentBranchResolver = {
    async resolveByBranch() {
        return { kind: 'NO_BRANCH' };
    }
};
