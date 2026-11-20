import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    CREDITED_PAYMENT_CHECK_STATUSES,
    eq,
    getDb,
    inArray,
    isNotNull,
    payments,
    type ReconciliationMarkReason
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import {
    chargeNamedByMark,
    noteChargebackOnHeldCharge,
    type OneTimePageMarkTrigger
} from './one-time-page-charge-marks';

const logger = createLogger('addon-payment-chargeback');

/** Reason 17: the payer disputed a credited charge with their bank (MOT:17). */
const CHARGEBACK_REASON = 'CONTRACARGO' as const satisfies ReconciliationMarkReason;

/**
 * What the chargeback interface of a one-time addon payment did.
 *
 * - `MARKED`: `CONTRACARGO` is now open on the instance, naming the charge.
 * - `ALREADY_MARKED`: a mark of the instance already names the charge (open or lifted, of any
 *   reason), so nothing opened: one payment raises at most one mark, and a lift is never undone.
 *   When that mark is an OPEN page-charge mark holding the charge's payment (HOS-2179 D1), the
 *   chargeback settles it once: an event with `provider.charged_back: true`, the held payment
 *   resolved without a refund, and its waiting proposed refund failed. A refund already sent to
 *   the provider (`CONFIRMED`) or executed owns the outcome instead: then only the note.
 * - `NOT_APPLICABLE`: no credited payment of an addon instance holds the charge. The money
 *   activated nothing, so there is nothing to reconcile.
 * - `UNKNOWN`: the mark could not be opened; the caller leaves the read undecided.
 */
export type AddonPaymentChargebackResult =
    | { readonly outcome: 'MARKED'; readonly markId: string }
    | { readonly outcome: 'ALREADY_MARKED' | 'NOT_APPLICABLE' | 'UNKNOWN' };

/**
 * Opens `CONTRACARGO` (MOT:17) on the one-time addon instance whose credited payment the payer
 * charged back (HOS-2391, owner decision option 1). The instance and its payment are left as
 * they are: no revocation, no refund and no state change, because a chargeback is sometimes
 * reversed and a person decides from the mark. The caller has already read the charge by id and
 * seen it charged back; this only finds the payment and opens the mark. The charge id, the
 * payment id and the amount travel in the mark's event, as the other one-time marks carry them.
 *
 * @param input.chargeId - The provider's id of the charged-back payment
 * @param input.instanceId - When given, the payment must hang from this instance
 * @param input.trigger - Who read the chargeback: the notice (`provider`) or the sweep (`job`)
 * @param input.clock - The clock that stamps a held charge's resolution
 * @returns What was done
 */
export async function markAddonPaymentChargeback(input: {
    readonly chargeId: string;
    readonly instanceId?: string;
    readonly trigger: OneTimePageMarkTrigger;
    readonly clock: Clock;
}): Promise<AddonPaymentChargebackResult> {
    try {
        const [payment] = await getDb()
            .select({
                id: payments.id,
                addonInstanceId: payments.addonInstanceId,
                amount: payments.amount,
                currency: payments.currency
            })
            .from(payments)
            .where(
                and(
                    eq(payments.providerFactId, input.chargeId),
                    input.instanceId === undefined
                        ? isNotNull(payments.addonInstanceId)
                        : eq(payments.addonInstanceId, input.instanceId),
                    inArray(payments.status, [...CREDITED_PAYMENT_CHECK_STATUSES])
                )
            )
            .limit(1);
        const instanceId = payment?.addonInstanceId;
        if (!payment || !instanceId) return { outcome: 'NOT_APPLICABLE' };
        if (await chargeNamedByMark({ instanceId, chargeId: input.chargeId })) {
            // D1: a charge an open page-charge mark holds gets the chargeback noted on that
            // mark, so its refund proposal reads as stale. Any other naming mark stays as is.
            await noteChargebackOnHeldCharge({
                instanceId,
                chargeId: input.chargeId,
                trigger: input.trigger,
                clock: input.clock
            });
            return { outcome: 'ALREADY_MARKED' };
        }
        const opened = await openReconciliationMark({
            subject: { kind: 'ADDON_INSTANCE', addonInstanceId: instanceId },
            reason: 'CONTRACARGO' satisfies typeof CHARGEBACK_REASON,
            actor: { type: input.trigger.actor },
            correlationId: input.trigger.correlationId ?? randomUUID(),
            detail: [
                { field: 'provider.charge_id', new: input.chargeId },
                { field: 'payment.id', new: payment.id },
                { field: 'provider.charge_amount_minor', new: payment.amount },
                { field: 'provider.charge_currency', new: payment.currency }
            ]
        });
        return { outcome: 'MARKED', markId: opened.mark.id };
    } catch (error) {
        logger.error(
            {
                chargeId: input.chargeId,
                instanceId: input.instanceId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Could not open the chargeback mark of a one-time addon payment; left undecided'
        );
        return { outcome: 'UNKNOWN' };
    }
}
