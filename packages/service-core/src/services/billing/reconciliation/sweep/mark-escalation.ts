import type { Clock } from '@repo/billing-verticals-contract';
import { type DrizzleClient, domainEventModel, getDb, reconciliationMarkModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../../types';
import {
    enqueueMarkEscalatedNotice,
    type MarkEscalatedNoticeRecipients
} from '../escalation-notice.js';

const DAY_MS = 86_400_000;

/** Whether an open mark has reached its captured deadline 17. */
export function isMarkEscalationDue(input: {
    readonly placedAt: Date;
    readonly days: number;
    readonly now: Date;
}): boolean {
    return (
        Number.isInteger(input.days) &&
        input.days > 0 &&
        input.now.getTime() - input.placedAt.getTime() >= input.days * DAY_MS
    );
}

/** Summary of one mark escalation pass. */
export interface MarkEscalationSummary {
    readonly examined: number;
    readonly due: number;
    readonly escalated: number;
    readonly alreadyHandled: number;
    readonly failures: readonly { readonly markId: string; readonly message: string }[];
}

/** Optional transaction port for isolated callers and tests. */
export interface MarkEscalationPorts {
    readonly clock: Clock;
    readonly tx?: DrizzleClient;
    /** Omit to run the pass without enqueuing escalation notices. */
    readonly notice?: { readonly recipients?: MarkEscalatedNoticeRecipients };
}

/** Escalates overdue marks, recording the mark and its domain event atomically. */
export async function runMarkEscalation(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: MarkEscalationPorts
): Promise<MarkEscalationSummary> {
    let examined = 0;
    let due = 0;
    let escalated = 0;
    let alreadyHandled = 0;
    const failures: { markId: string; message: string }[] = [];
    let afterMarkId: string | undefined;
    for (;;) {
        const page = await reconciliationMarkModel.listOpenUnescalatedPage({
            afterMarkId,
            limit: input.pageSize,
            tx: ports.tx
        });
        for (const mark of page) {
            examined++;
            if (mark.deadlineDays === null) {
                const error = new ServiceError(
                    ServiceErrorCode.CONFIGURATION_ERROR,
                    'Billing deadline 17 is missing for this reconciliation mark',
                    undefined,
                    'MARK_ESCALATION_DEADLINE_MISSING'
                );
                failures.push({ markId: mark.id, message: `${error.reason}: ${error.message}` });
                continue;
            }
            const deadlineDays = mark.deadlineDays;
            const now = ports.clock.now();
            if (!isMarkEscalationDue({ placedAt: mark.placedAt, days: deadlineDays, now }))
                continue;
            due++;
            try {
                const didEscalate = await (ports.tx ?? getDb()).transaction(async (tx) => {
                    const updated = await reconciliationMarkModel.markEscalated({
                        markId: mark.id,
                        escalatedAt: now,
                        tx
                    });
                    if (!updated) return false;
                    const subjectType =
                        mark.subscriptionId === null ? 'addon_instance' : 'subscription';
                    const subjectId = mark.subscriptionId ?? mark.addonInstanceId;
                    if (subjectId === null) throw new Error('Reconciliation mark has no subject');
                    await domainEventModel.insert({
                        eventType: 'reconciliation.mark_escalated',
                        entityType: subjectType,
                        entityId: subjectId,
                        actorType: 'job',
                        correlationId: input.correlationId,
                        reason: mark.reason,
                        occurredAt: now,
                        changes: [
                            { field: 'reconciliation_mark.id', new: mark.id },
                            { field: 'reconciliation_mark.reason', new: mark.reason },
                            {
                                field: 'reconciliation_mark.placed_at',
                                new: mark.placedAt.toISOString()
                            },
                            {
                                field: 'reconciliation_mark.deadlines_version',
                                new: mark.deadlinesVersion
                            },
                            { field: 'reconciliation_mark.escalation_days', new: mark.deadlineDays }
                        ],
                        tx
                    });
                    if (ports.notice)
                        await enqueueMarkEscalatedNotice(
                            {
                                tx,
                                markId: mark.id,
                                subject: { subjectType, subjectId },
                                reason: mark.reason,
                                placedAt: mark.placedAt,
                                escalatedAt: now,
                                escalationDays: deadlineDays,
                                correlationId: input.correlationId
                            },
                            ports.notice
                        );
                    return true;
                });
                if (didEscalate) escalated++;
                else alreadyHandled++;
            } catch (error) {
                failures.push({
                    markId: mark.id,
                    message: error instanceof Error ? error.message : String(error)
                });
            }
        }
        if (page.length < input.pageSize) break;
        afterMarkId = page.at(-1)?.id;
    }
    return { examined, due, escalated, alreadyHandled, failures };
}
