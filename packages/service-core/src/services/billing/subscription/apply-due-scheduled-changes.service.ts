import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    asc,
    eq,
    getDb,
    inArray,
    lte,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    type ApplyScheduledChangeResult,
    applyScheduledChangeInTx
} from './apply-scheduled-change.service.js';

const logger = createLogger('apply-due-scheduled-changes');
const inputSchema = z.strictObject({ limit: z.number().int().min(1).max(1000) });
const LIVE_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'] as const;

/** Emits the S38 coverage notice after commit; delivery failure is a warning. */
export async function finishAppliedScheduledChange(input: {
    readonly applied: Extract<ApplyScheduledChangeResult, { outcome: 'APPLIED' }>;
    readonly ports: { readonly coverageNotices: CoverageNotices };
}): Promise<{ readonly warnings: readonly 'COVERAGE_NOTICE_FAILED'[] }> {
    const { applied } = input;
    const vertical = VerticalEnumSchema.safeParse(applied.vertical);
    if (!vertical.success) {
        logger.error(
            { subscriptionId: applied.subscriptionId, vertical: applied.vertical },
            'Coverage notice subject is invalid after S38 commit'
        );
        return { warnings: ['COVERAGE_NOTICE_FAILED'] };
    }
    try {
        await input.ports.coverageNotices.emitCoverageChanged({
            userId: applied.userId,
            vertical: vertical.data,
            sourceType: 'SUBSCRIPTION',
            change: 'CHANGED'
        });
        return { warnings: [] };
    } catch (error) {
        logger.error(
            { subscriptionId: applied.subscriptionId, error },
            'Coverage changed notice failed after scheduled change commit'
        );
        return { warnings: ['COVERAGE_NOTICE_FAILED'] };
    }
}

/** Applies due S38 queue entries, committing each subscription independently. */
export async function applyDueScheduledChanges(
    input: { readonly limit: number },
    ports: { readonly clock: Clock; readonly coverageNotices: CoverageNotices }
): Promise<{
    readonly applied: number;
    readonly waiting: number;
    readonly notApplicable: number;
    readonly failed: number;
    readonly warnings: readonly string[];
}> {
    const { limit } = inputSchema.parse(input);
    const now = ports.clock.now();
    const db = getDb();
    const due = await db
        .select({
            subscriptionId: subscriptions.id,
            effectiveAt: subscriptionScheduledChanges.effectiveAt
        })
        .from(subscriptionScheduledChanges)
        .innerJoin(subscriptions, eq(subscriptions.id, subscriptionScheduledChanges.subscriptionId))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, [...LIVE_STATUSES]),
                lte(subscriptionScheduledChanges.effectiveAt, now)
            )
        )
        .orderBy(asc(subscriptionScheduledChanges.effectiveAt))
        .limit(limit);
    const waitingRows = await db
        .select({ subscriptionId: subscriptions.id })
        .from(subscriptionScheduledChanges)
        .innerJoin(subscriptions, eq(subscriptions.id, subscriptionScheduledChanges.subscriptionId))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, ['PAUSED', 'SUSPENDED']),
                lte(subscriptionScheduledChanges.effectiveAt, now)
            )
        );
    const summary = {
        applied: 0,
        waiting: waitingRows.length,
        notApplicable: 0,
        failed: 0,
        warnings: [] as string[]
    };
    for (const row of due) {
        try {
            const result = await db.transaction((tx) =>
                applyScheduledChangeInTx({ subscriptionId: row.subscriptionId, now, tx })
            );
            if (result.outcome === 'NOT_APPLICABLE') {
                if (result.reason === 'WAITS_PAUSED' || result.reason === 'WAITS_SUSPENDED')
                    summary.waiting++;
                else summary.notApplicable++;
                continue;
            }
            summary.applied++;
            const finished = await finishAppliedScheduledChange({ applied: result, ports });
            summary.warnings.push(...finished.warnings);
        } catch (error) {
            summary.failed++;
            logger.error(
                { subscriptionId: row.subscriptionId, error },
                'Scheduled change row failed; continuing batch'
            );
        }
    }
    return summary;
}
