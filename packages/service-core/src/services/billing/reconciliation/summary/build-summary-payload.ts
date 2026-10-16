import type { SelectDomainEvent, SelectReconciliationSummaryWindow } from '@repo/db';
import {
    RECONCILIATION_SUMMARY_LINE_CAP,
    type ReconciliationSummaryPayload,
    type SummarySubjectType
} from './summary-types.js';

type Change = { field: string; new?: unknown };
function values(event: SelectDomainEvent): Map<string, unknown> {
    return new Map(
        (event.changes as readonly Change[]).map((change) => [change.field, change.new])
    );
}
function text(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}
function integer(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}
function iso(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function subject(value: string): value is SummarySubjectType {
    return value === 'subscription' || value === 'addon_instance';
}
function sorted<T>(rows: T[], key: (row: T) => string): T[] {
    return rows.sort((a, b) => key(a).localeCompare(key(b)));
}
/** Builds the contract payload from stored events without side effects. */
export function buildReconciliationSummaryPayload(input: {
    readonly window: SelectReconciliationSummaryWindow;
    readonly events: readonly SelectDomainEvent[];
}): ReconciliationSummaryPayload {
    const marksByKey = new Map<
        string,
        { reason: string; subjectType: SummarySubjectType; subjectId: string; count: number }
    >();
    const escalations: ReconciliationSummaryPayload['escalations'][number][] = [];
    const underCharges: ReconciliationSummaryPayload['underCharges'][number][] = [];
    const pauseGifts: ReconciliationSummaryPayload['pauseGifts'][number][] = [];
    const omitted = { marks: 0, escalations: 0, underCharges: 0, pauseGifts: 0 };
    for (const event of input.events) {
        const fields = values(event);
        if (event.eventType === 'reconciliation.mark_opened') {
            const reason = fields.get('reconciliation_mark.reason');
            if (!text(reason) || !subject(event.entityType) || !text(event.entityId)) {
                omitted.marks++;
                continue;
            }
            const key = JSON.stringify([reason, event.entityType, event.entityId]);
            const prior = marksByKey.get(key);
            if (prior) prior.count++;
            else
                marksByKey.set(key, {
                    reason,
                    subjectType: event.entityType,
                    subjectId: event.entityId,
                    count: 1
                });
        } else if (event.eventType === 'reconciliation.mark_escalated') {
            const reason = fields.get('reconciliation_mark.reason');
            const markId = fields.get('reconciliation_mark.id');
            if (
                !text(reason) ||
                !text(markId) ||
                !subject(event.entityType) ||
                !text(event.entityId)
            ) {
                omitted.escalations++;
                continue;
            }
            escalations.push({
                reason,
                subjectType: event.entityType,
                subjectId: event.entityId,
                markId
            });
        } else if (event.eventType === 'reconciliation.undercharge_detected') {
            const subscriptionId = fields.get('subscription.id'),
                currency = fields.get('payment.currency');
            const expectedMinor = fields.get('payment.expected_minor'),
                chargedMinor = fields.get('payment.charged_minor'),
                differenceMinor = fields.get('payment.difference_minor');
            if (
                !text(subscriptionId) ||
                !text(event.entityId) ||
                !text(currency) ||
                !integer(expectedMinor) ||
                !integer(chargedMinor) ||
                !integer(differenceMinor)
            ) {
                omitted.underCharges++;
                continue;
            }
            underCharges.push({
                subscriptionId,
                paymentId: event.entityId,
                currency,
                expectedMinor,
                chargedMinor,
                differenceMinor
            });
        } else if (event.eventType === 'reconciliation.pause_gift_detected') {
            const subscriptionId = fields.get('subscription.id'),
                pauseStartedAt = fields.get('pause.starts_at'),
                pauseEndedAt = fields.get('pause.ended_at');
            const skippedChargeAt = fields.get('charge.first_skipped_at'),
                nextChargeAfterReturnAt = fields.get('charge.next_after_return_at'),
                giftDays = fields.get('gift.days');
            if (
                !text(subscriptionId) ||
                !text(event.entityId) ||
                !iso(pauseStartedAt) ||
                !iso(pauseEndedAt) ||
                !iso(skippedChargeAt) ||
                !iso(nextChargeAfterReturnAt) ||
                !integer(giftDays)
            ) {
                omitted.pauseGifts++;
                continue;
            }
            pauseGifts.push({
                subscriptionId,
                pauseId: event.entityId,
                pauseStartedAt,
                pauseEndedAt,
                skippedChargeAt,
                nextChargeAfterReturnAt,
                giftDays
            });
        }
    }
    const allMarks = [...marksByKey.values()].sort(
        (a, b) =>
            b.count - a.count ||
            a.reason.localeCompare(b.reason) ||
            a.subjectId.localeCompare(b.subjectId)
    );
    sorted(escalations, (row) => `${row.reason}|${row.subjectId}`);
    sorted(underCharges, (row) => `${row.subscriptionId}|${row.paymentId}`);
    sorted(pauseGifts, (row) => `${row.subscriptionId}|${row.pauseId}`);
    const cap = <T>(rows: T[], key: keyof typeof omitted) => {
        omitted[key] += Math.max(0, rows.length - RECONCILIATION_SUMMARY_LINE_CAP);
        return rows.slice(0, RECONCILIATION_SUMMARY_LINE_CAP);
    };
    return {
        windowId: input.window.id,
        coversFrom: input.window.coversFrom.toISOString(),
        closesAt: input.window.closesAt.toISOString(),
        windowMinutes: input.window.windowMinutes,
        totals: { events: input.events.length },
        marks: cap(allMarks, 'marks'),
        escalations: cap(escalations, 'escalations'),
        underCharges: cap(underCharges, 'underCharges'),
        pauseGifts: cap(pauseGifts, 'pauseGifts'),
        omitted
    };
}
