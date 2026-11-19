import { randomUUID } from 'node:crypto';
import {
    and,
    type DomainEventChange,
    domainEvent,
    eq,
    getDb,
    inArray,
    isNotNull,
    type ReconciliationMarkReason,
    reconciliationMarks,
    sql
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';

const logger = createLogger('addon-one-time-page-charge-marks');

/**
 * The reasons a payment made on a one-time page may raise on its instance (HOS-2179): another
 * amount (MOT:5, AC-8), a second collection on the same page (MOT:20, §5.8, AC-11) and money
 * on a purchase that closed with no payment (MOT:23, §5.9, AC-12). One payment raises at most
 * one of them: A2 decides the amount first.
 */
export type OneTimePageChargeMarkReason = Extract<
    ReconciliationMarkReason,
    'DIVERGENCIA_DE_MONTO' | 'COBRO_DUPLICADO' | 'ORDEN_PAGADA_SIN_INSTANCIA'
>;

/** Every reason a one-time page payment can raise, in A2's decision order. */
export const ONE_TIME_PAGE_CHARGE_MARK_REASONS = [
    'DIVERGENCIA_DE_MONTO',
    'COBRO_DUPLICADO',
    'ORDEN_PAGADA_SIN_INSTANCIA'
] as const satisfies readonly OneTimePageChargeMarkReason[];

/** Who opens the mark: the notice receiver (`provider`) or the reconciliation sweep (`job`). */
export interface OneTimePageMarkTrigger {
    readonly actor: 'provider' | 'job';
    readonly correlationId?: string;
}

/**
 * Whether a mark of one of `reasons` on the instance already names this provider charge in one
 * of its opening events. The open-mark uniqueness is per (instance, reason) over OPEN marks only,
 * so a charge is tied to its mark only through the `provider.charge_id` of the event.
 *
 * @param input.instanceId - The one-time page purchase
 * @param input.chargeId - The provider's id of the payment
 * @param input.reasons - The reasons to look at
 * @param input.liftedOnly - Only marks a person already lifted count
 * @returns True when such a mark names the charge
 */
export async function chargeNamedByMark(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly reasons: readonly OneTimePageChargeMarkReason[];
    readonly liftedOnly: boolean;
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
                inArray(reconciliationMarks.reason, [...input.reasons]),
                input.liftedOnly ? isNotNull(reconciliationMarks.liftedAt) : undefined
            )
        )
        .limit(1);
    return named !== undefined;
}

/**
 * Opens (or accumulates on) one mark for one payment of a page purchase, with the provider's id
 * first in its event. A repeated notice, A3 or the sweep accumulates on the same open mark; a
 * charge whose mark of this reason a person already lifted does not reopen it. There is no
 * `payment` row to hang: the money activated nothing, so the charge id and amounts (and, for a
 * refundable reason, the proposed refund) travel in the event.
 *
 * @param input.instanceId - The one-time page purchase
 * @param input.chargeId - The provider's id of the payment
 * @param input.reason - The reason to open
 * @param input.detail - What else travels in the event
 * @param input.trigger - Who opens it
 * @returns `MARKED` once the mark is open or was lifted for this charge; `UNKNOWN` when it could not be opened
 */
export async function openOneTimePageChargeMark(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly reason: OneTimePageChargeMarkReason;
    readonly detail: readonly DomainEventChange[];
    readonly trigger?: OneTimePageMarkTrigger;
}): Promise<'MARKED' | 'UNKNOWN'> {
    try {
        if (
            await chargeNamedByMark({
                instanceId: input.instanceId,
                chargeId: input.chargeId,
                reasons: [input.reason],
                liftedOnly: true
            })
        )
            return 'MARKED';
        // A catalog-typed reason, as GUARD:G-R1-F (a) requires of every opening.
        const reason: ReconciliationMarkReason = input.reason;
        await openReconciliationMark({
            subject: { kind: 'ADDON_INSTANCE', addonInstanceId: input.instanceId },
            reason,
            actor: { type: input.trigger?.actor ?? 'provider' },
            correlationId: input.trigger?.correlationId ?? randomUUID(),
            detail: [{ field: 'provider.charge_id', new: input.chargeId }, ...input.detail]
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
