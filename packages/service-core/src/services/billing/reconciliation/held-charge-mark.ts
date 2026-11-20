import { ONE_TIME_PAGE_CHARGE_MARK_REASONS } from '../addon/one-time-page-charge-marks.js';

/**
 * Whether a mark is a page-charge mark of a one-time addon instance: DIVERGENCIA_DE_MONTO,
 * COBRO_DUPLICADO or ORDEN_PAGADA_SIN_INSTANCIA (mark 23). Since HOS-2179 D1 such a mark hangs the
 * charge's own `payment` row, and (owner decision, option 3) that money is closed only by
 * refunding it: action 7 never resolves it without a refund. A chargeback, which already gave the
 * money back, still resolves it on its own path.
 *
 * @param input.reason - The mark's reason
 * @param input.addonInstanceId - The mark's addon instance, or null for a subscription mark
 * @returns True for a page-charge mark of an addon instance
 */
export function isHeldChargeMark(input: {
    readonly reason: string;
    readonly addonInstanceId: string | null;
}): boolean {
    return (
        input.addonInstanceId !== null &&
        (ONE_TIME_PAGE_CHARGE_MARK_REASONS as readonly string[]).includes(input.reason)
    );
}

/**
 * Whether action 7 must stay closed for an open mark: a page-charge mark that still holds an
 * unresolved payment. It opens once a refund settles that payment
 * (`resolveHungPaymentsBySettlement`), or a chargeback resolves it.
 *
 * @param input.reason - The mark's reason
 * @param input.addonInstanceId - The mark's addon instance, or null
 * @param input.payments - The payments hung from the mark, with their resolution
 * @returns True when the mark can only be closed through a refund right now
 */
export function liftRequiresRefund(input: {
    readonly reason: string;
    readonly addonInstanceId: string | null;
    readonly payments: readonly { readonly resolvedAt: Date | null }[];
}): boolean {
    return isHeldChargeMark(input) && input.payments.some((payment) => payment.resolvedAt === null);
}
