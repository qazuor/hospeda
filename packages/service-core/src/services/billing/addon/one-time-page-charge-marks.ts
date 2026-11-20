import { randomUUID } from 'node:crypto';
import {
    and,
    type DomainEventChange,
    domainEvent,
    eq,
    getDb,
    isNotNull,
    ne,
    or,
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

/**
 * Opens (or accumulates on) one mark for one payment of a page purchase, with the provider's id
 * first in its event. A repeated notice, A3 or the sweep accumulates on the same open mark; a
 * charge already held by a lifted mark, or by a mark of another reason, opens nothing. There is no
 * `payment` row to hang: the money activated nothing, so the charge id and amounts (and, for a
 * refundable reason, the proposed refund) travel in the event.
 *
 * @param input.instanceId - The one-time page purchase
 * @param input.chargeId - The provider's id of the payment
 * @param input.reason - The reason to open
 * @param input.detail - What else travels in the event
 * @param input.trigger - Who opens it
 * @returns `MARKED` once a mark holds this charge; `UNKNOWN` when it could not be opened
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
                accumulatesOn: input.reason
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
