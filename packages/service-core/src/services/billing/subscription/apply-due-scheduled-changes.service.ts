import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    asc,
    eq,
    getDb,
    inArray,
    lte,
    sql,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    type ApplyScheduledChangeResult,
    applyScheduledChangeInTx
} from './apply-scheduled-change.service.js';
import type { SurplusStep } from './scheduled-change-surplus-step.js';

const logger = createLogger('apply-due-scheduled-changes');
const inputSchema = z.strictObject({ limit: z.number().int().min(1).max(1000) });
const LIVE_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'] as const;

/** Emits the S38 coverage notice after commit; delivery failure is a warning. */
export async function finishAppliedScheduledChange(input: {
    readonly applied: Extract<ApplyScheduledChangeResult, { outcome: 'APPLIED' }>;
    readonly ports: {
        readonly coverageNotices: CoverageNotices;
        readonly surplusStep?: SurplusStep;
    };
}): Promise<{ readonly warnings: readonly string[] }> {
    const { applied } = input;
    const warnings: string[] = [];
    const vertical = VerticalEnumSchema.safeParse(applied.vertical);
    if (!vertical.success) {
        logger.error(
            { subscriptionId: applied.subscriptionId, vertical: applied.vertical },
            'Coverage notice subject is invalid after S38 commit'
        );
        return { warnings: ['COVERAGE_NOTICE_FAILED'] };
    }
    const publicationVertical = Object.hasOwn(PUBLICATION_LIMIT_KEYS, vertical.data)
        ? (vertical.data as keyof typeof PUBLICATION_LIMIT_KEYS)
        : undefined;
    const keepListingIds = publicationVertical
        ? applied.keepSelection?.[PUBLICATION_LIMIT_KEYS[publicationVertical]]
        : undefined;
    if (keepListingIds && keepListingIds.length > 0) {
        if (input.ports.surplusStep) {
            try {
                await input.ports.surplusStep.reconcile({
                    userId: applied.userId,
                    vertical: vertical.data,
                    keepListingIds
                });
            } catch (error) {
                logger.error(
                    { subscriptionId: applied.subscriptionId, error },
                    'Scheduled change surplus step failed'
                );
                warnings.push('SURPLUS_STEP_FAILED');
            }
        } else {
            logger.error(
                { subscriptionId: applied.subscriptionId },
                'Scheduled change surplus step is not registered'
            );
            warnings.push('SURPLUS_STEP_NOT_REGISTERED');
        }
    }
    try {
        await input.ports.coverageNotices.emitCoverageChanged({
            userId: applied.userId,
            vertical: vertical.data,
            sourceType: 'SUBSCRIPTION',
            change: 'CHANGED'
        });
        return { warnings };
    } catch (error) {
        logger.error(
            { subscriptionId: applied.subscriptionId, error },
            'Coverage changed notice failed after scheduled change commit'
        );
        warnings.push('COVERAGE_NOTICE_FAILED');
        return { warnings };
    }
}

/**
 * Applies due S38 queue entries, committing each subscription independently.
 * `limit` is the keyset page size, not a cap: the run walks every due row.
 */
export async function applyDueScheduledChanges(
    input: { readonly limit: number },
    ports: {
        readonly clock: Clock;
        readonly coverageNotices: CoverageNotices;
        readonly surplusStep?: SurplusStep;
    }
): Promise<{
    readonly applied: number;
    readonly waiting: number;
    readonly notApplicable: number;
    readonly failed: number;
    readonly warnings: readonly string[];
    readonly results: readonly {
        readonly subscriptionId: string;
        readonly outcome: 'APPLIED' | 'NOT_APPLICABLE' | 'FAILED';
        readonly reason?: string;
    }[];
}> {
    const { limit } = inputSchema.parse(input);
    const now = ports.clock.now();
    const db = getDb();
    const waitingRows = await db
        .select({ subscriptionId: subscriptions.id, status: subscriptions.status })
        .from(subscriptionScheduledChanges)
        .innerJoin(subscriptions, eq(subscriptions.id, subscriptionScheduledChanges.subscriptionId))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, ['PAUSED', 'SUSPENDED']),
                lte(subscriptionScheduledChanges.effectiveAt, now)
            )
        );
    const results: {
        subscriptionId: string;
        outcome: 'APPLIED' | 'NOT_APPLICABLE' | 'FAILED';
        reason?: string;
    }[] = waitingRows.map((row) => ({
        subscriptionId: row.subscriptionId,
        outcome: 'NOT_APPLICABLE',
        reason: row.status === 'PAUSED' ? 'WAITS_PAUSED' : 'WAITS_SUSPENDED'
    }));
    const summary = {
        applied: 0,
        waiting: waitingRows.length,
        notApplicable: 0,
        failed: 0,
        warnings: [] as string[],
        results
    };
    const visited = new Set<string>();
    let cursor: { readonly at: string; readonly id: string } | null = null;
    while (true) {
        const page = await db
            .select({
                id: subscriptionScheduledChanges.id,
                subscriptionId: subscriptions.id,
                cursorAt: sql<string>`${subscriptionScheduledChanges.effectiveAt}::text`
            })
            .from(subscriptionScheduledChanges)
            .innerJoin(
                subscriptions,
                eq(subscriptions.id, subscriptionScheduledChanges.subscriptionId)
            )
            .where(
                and(
                    eq(subscriptions.class, 'PRINCIPAL'),
                    inArray(subscriptions.status, [...LIVE_STATUSES]),
                    lte(subscriptionScheduledChanges.effectiveAt, now),
                    cursor
                        ? sql`(${subscriptionScheduledChanges.effectiveAt}, ${subscriptionScheduledChanges.id}) > (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
                        : undefined
                )
            )
            .orderBy(
                asc(subscriptionScheduledChanges.effectiveAt),
                asc(subscriptionScheduledChanges.id)
            )
            .limit(limit);
        if (page.length === 0) break;
        const last = page[page.length - 1];
        if (!last) break;
        cursor = { at: last.cursorAt, id: last.id };
        let progressed = false;
        for (const row of page) {
            // The queue holds one row per subscription, but a client can replace it mid-run
            // (DELETE + INSERT, new id, possibly a later effective_at). Visit each once.
            if (visited.has(row.subscriptionId)) continue;
            visited.add(row.subscriptionId);
            progressed = true;
            try {
                const result = await db.transaction((tx) =>
                    applyScheduledChangeInTx({ subscriptionId: row.subscriptionId, now, tx })
                );
                summary.results.push({
                    subscriptionId: row.subscriptionId,
                    outcome: result.outcome,
                    ...(result.outcome === 'NOT_APPLICABLE' ? { reason: result.reason } : {})
                });
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
                summary.results.push({ subscriptionId: row.subscriptionId, outcome: 'FAILED' });
                logger.error(
                    { subscriptionId: row.subscriptionId, error },
                    'Scheduled change row failed; continuing batch'
                );
            }
        }
        if (!progressed) {
            logger.warn(
                { limit, cursorAt: cursor.at },
                'Scheduled change page had no unvisited subscriptions; stopping to avoid a replay loop'
            );
            break;
        }
        if (page.length < limit) break;
    }
    return summary;
}
