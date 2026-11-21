import type { DrizzleClient } from '@repo/db';
import { and, eq, idempotencyKeys, inArray, isNull, refundCalls, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import {
    type RefundCallRow,
    type RefundCallTally,
    readCitedProviderRefundIds,
    refundCallRetryCutoff,
    SETTLED_EXTERNALLY
} from './refund-call-tally';
import type { ChargeRefundsRead } from './refund-remainder-provider';

/**
 * HOS-2538 — the unanswered calls of a `CONFIRMED` refund that action 14 may settle from the
 * provider panel: every one of them must be past the retry limit, so "Retry with MP" can no
 * longer post it (`REFUND_CALL_TOO_OLD_TO_RETRY`) and a person has looked at the panel instead.
 *
 * A call inside the limit (`created_at >= now - REFUND_CALL_RETRY_LIMIT_MS`, exactly 24 hours
 * included) still belongs to the retry, which may post it under its idempotency key; settling it
 * here could race that POST into a second refund. A call of the retired order channel
 * (`addon_instance_id` set) is never settled here either (HOS-2179 T-7): its exit stays manual.
 *
 * @param input.tally - The refund's call tally, read under the refund lock.
 * @param input.now - The current instant, from the injected clock.
 * @returns The unanswered calls (all past the limit); empty when nothing is unanswered.
 * @throws ServiceError ALREADY_EXISTS `REFUND_CALL_UNANSWERED` when one is inside the limit or an order call.
 */
export function assertUnansweredCallsPastRetryLimit(input: {
    readonly tally: RefundCallTally;
    readonly now: Date;
}): readonly RefundCallRow[] {
    const cutoff = refundCallRetryCutoff({ now: input.now });
    const blocking = input.tally.unanswered.some(
        (call) => call.addonInstanceId !== null || call.createdAt >= cutoff
    );
    if (blocking)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'A provider call of this refund is still unanswered and was sent less than 24 hours ago; retry it with MP first',
            undefined,
            'REFUND_CALL_UNANSWERED'
        );
    return input.tally.unanswered;
}

/**
 * HOS-2538 — a stale call may have landed at the provider with its answer lost. If the charge read
 * shows a provider refund that nothing of ours cites, not rejected, for the amount of one of the
 * stale calls, other than the panel refund being cited, that refund may be the lost call's:
 * settling now would mark the call answered and leave that money uncounted for ever. "Retry with
 * MP" binds it instead (binding works past 24 hours), so this refuses.
 *
 * Sound because the charge was read before this transaction (the HOS-2517 causal order): every
 * provider refund in the read comes from something committed before it, which the cited check sees.
 *
 * @param input.tx - The transaction holding the payment and the refund `FOR UPDATE`.
 * @param input.read - The charge read for this decision.
 * @param input.stale - The stale unanswered calls.
 * @param input.reference - The panel refund id the person cites (excluded: it is the settlement).
 * @param input.currency - The payment currency.
 * @throws ServiceError ALREADY_EXISTS `UNCITED_PROVIDER_REFUND_ON_CHARGE` when such a refund exists.
 */
export async function assertNoUncitedRefundForStaleCalls(input: {
    readonly tx: DrizzleClient;
    readonly read: ChargeRefundsRead;
    readonly stale: readonly RefundCallRow[];
    readonly reference: string;
    readonly currency: string;
}): Promise<void> {
    if (input.stale.length === 0) return;
    const amounts = new Set(input.stale.map((call) => call.amount));
    const suspects = input.read.refunds
        .filter(
            (entry) =>
                entry.refundId !== input.reference &&
                entry.rejected !== true &&
                entry.amount.currency === input.currency &&
                amounts.has(entry.amount.amountMinor)
        )
        .map((entry) => entry.refundId);
    const cited = await readCitedProviderRefundIds({ db: input.tx, ids: suspects });
    const uncited = suspects.filter((id) => !cited.has(id));
    if (uncited.length > 0)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            `The charge shows provider refund ${uncited.join(', ')} for an unanswered call's amount that nothing of ours cites; the lost call may have landed: retry it with MP, which binds it`,
            undefined,
            'UNCITED_PROVIDER_REFUND_ON_CHARGE'
        );
}

/**
 * HOS-2538 — records action 14's answer on every stale call of the refund it closes: the call is
 * completed with `{ outcome: 'SETTLED_EXTERNALLY', code: 'SETTLED_EXTERNALLY', panelReference }`
 * and keeps `provider_refund_id` NULL. Completed, it is never resent (the resend replays only calls
 * without `completed_at`), and `completeCall` refuses to overwrite this answer, so no late answer
 * binds a provider refund to it. The panel refund it cites is the refund row's `external_ref`
 * (`PROVIDER_PANEL`), which `readCitedProviderRefundIds` already counts as cited.
 *
 * Each update is conditional on what the tally read (no id, and still unanswered); a call answered
 * in between makes the whole settlement fail with `REFUND_STATE_CHANGED`, rolling back.
 *
 * @param input.tx - The transaction holding the payment and the refund `FOR UPDATE`.
 * @param input.refundId - The refund being closed.
 * @param input.stale - The stale unanswered calls.
 * @param input.reference - The panel refund id the person cited.
 * @param input.now - The settlement instant.
 * @throws ServiceError ALREADY_EXISTS `REFUND_STATE_CHANGED` when a call changed since it was read.
 */
export async function markStaleCallsSettledExternally(input: {
    readonly tx: DrizzleClient;
    readonly refundId: string;
    readonly stale: readonly RefundCallRow[];
    readonly reference: string;
    readonly now: Date;
}): Promise<void> {
    if (input.stale.length === 0) return;
    const keys = input.stale.map((call) => call.idempotencyKey);
    const stillWithoutId = await input.tx
        .select({ key: refundCalls.idempotencyKey })
        .from(refundCalls)
        .where(
            and(
                eq(refundCalls.refundId, input.refundId),
                inArray(refundCalls.idempotencyKey, keys),
                isNull(refundCalls.providerRefundId)
            )
        );
    const marked =
        stillWithoutId.length === keys.length
            ? await input.tx
                  .update(idempotencyKeys)
                  .set({
                      result: {
                          outcome: SETTLED_EXTERNALLY,
                          code: SETTLED_EXTERNALLY,
                          panelReference: input.reference
                      },
                      completedAt: input.now
                  })
                  .where(
                      and(
                          inArray(idempotencyKeys.key, keys),
                          sql`(${idempotencyKeys.completedAt} IS NULL OR COALESCE(${idempotencyKeys.result}->>'outcome', '') NOT IN ('ACCEPTED', 'REJECTED', ${SETTLED_EXTERNALLY}))`
                      )
                  )
                  .returning({ key: idempotencyKeys.key })
            : [];
    if (marked.length !== keys.length)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'A provider call of this refund changed while it was being settled',
            undefined,
            'REFUND_STATE_CHANGED'
        );
}
