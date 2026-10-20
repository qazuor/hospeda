import {
    and,
    asc,
    domainEvent,
    eq,
    getDb,
    isNull,
    or,
    RECONCILIATION_MARK_REASON_CATALOG,
    type ReconciliationMarkReason,
    reconciliationMarks
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { LATE_PAYMENT_FAILED_CONDITION_FIELD } from '../subscription/late-payment-conditions.js';
import type { ReconciliationMarkEventEntry } from './actionable-marks.js';

const inputSchema = z.object({ markId: z.uuid() });
const OUTCOME_FIELD = 'reconciliation_mark.outcome';

function notFound(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.NOT_FOUND,
        'Reconciliation mark not found',
        undefined,
        'RECONCILIATION_MARK_NOT_FOUND'
    );
}

function fieldValue(
    changes: readonly { readonly field: string; readonly new?: unknown }[],
    field: string
) {
    const change = changes.find((entry) => entry.field === field);
    return { present: change !== undefined, value: change?.new };
}

function failedCondition(value: unknown): 1 | 2 | 3 | 4 | null {
    return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

/** Reads a mark and its critical events using subject, reason, and the mark's database placement instant. */
export async function readReconciliationMarkEvents(input: { readonly markId: string }): Promise<{
    readonly mark: {
        readonly markId: string;
        readonly reason: ReconciliationMarkReason;
        readonly reasonNumber: number;
        readonly openedAt: Date;
        readonly liftedAt: Date | null;
        readonly subject: { readonly kind: 'SUBSCRIPTION' | 'ADDON_INSTANCE'; readonly id: string };
    };
    readonly events: readonly ReconciliationMarkEventEntry[];
}> {
    if (!inputSchema.safeParse(input).success) throw notFound();
    return getDb().transaction(async (tx) => {
        const [row] = await tx
            .select({
                markId: reconciliationMarks.id,
                reason: reconciliationMarks.reason,
                openedAt: reconciliationMarks.placedAt,
                liftedAt: reconciliationMarks.liftedAt,
                subscriptionId: reconciliationMarks.subscriptionId,
                addonInstanceId: reconciliationMarks.addonInstanceId
            })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.id, input.markId))
            .limit(1);
        if (!row) throw notFound();

        const reason = row.reason as ReconciliationMarkReason;
        const subject = row.subscriptionId
            ? { kind: 'SUBSCRIPTION' as const, id: row.subscriptionId }
            : { kind: 'ADDON_INSTANCE' as const, id: row.addonInstanceId as string };
        let entityType: string;
        switch (subject.kind) {
            case 'SUBSCRIPTION':
                entityType = 'subscription';
                break;
            case 'ADDON_INSTANCE':
                entityType = 'addon_instance';
                break;
        }
        const events = await tx
            .select({
                eventId: domainEvent.id,
                occurredAt: domainEvent.occurredAt,
                actorType: domainEvent.actorType,
                actorId: domainEvent.actorId,
                correlationId: domainEvent.correlationId,
                changes: domainEvent.changes
            })
            .from(domainEvent)
            .innerJoin(reconciliationMarks, eq(reconciliationMarks.id, row.markId))
            .where(
                and(
                    eq(domainEvent.eventType, 'reconciliation.mark_opened'),
                    eq(domainEvent.entityType, entityType),
                    eq(domainEvent.entityId, subject.id),
                    sql`${domainEvent.changes} @> jsonb_build_array(jsonb_build_object('field', 'reconciliation_mark.reason', 'new', ${reason}::text))`,
                    sql`${domainEvent.occurredAt} >= ${reconciliationMarks.placedAt}`,
                    or(
                        isNull(reconciliationMarks.liftedAt),
                        sql`${domainEvent.occurredAt} <= ${reconciliationMarks.liftedAt}`
                    )
                )
            )
            .orderBy(asc(domainEvent.occurredAt), asc(domainEvent.id));
        const parsedEvents = events.map((event): ReconciliationMarkEventEntry => {
            const outcome = fieldValue(event.changes, OUTCOME_FIELD);
            const condition = fieldValue(event.changes, LATE_PAYMENT_FAILED_CONDITION_FIELD);
            return {
                eventId: event.eventId,
                occurredAt: event.occurredAt,
                actorType: event.actorType,
                actorId: event.actorId,
                correlationId: event.correlationId,
                outcome: typeof outcome.value === 'string' ? outcome.value : null,
                failedCondition: failedCondition(condition.value),
                conditionRecorded: condition.present,
                changes: event.changes
            };
        });
        return {
            mark: {
                markId: row.markId,
                reason,
                reasonNumber: RECONCILIATION_MARK_REASON_CATALOG[reason].number,
                openedAt: row.openedAt,
                liftedAt: row.liftedAt,
                subject
            },
            events: parsedEvents
        };
    });
}
