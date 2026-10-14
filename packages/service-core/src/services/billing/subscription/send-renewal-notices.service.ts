import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { BillingDeadlineValuesSchema, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import {
    applyRenewalNotice,
    type CurrentRenewalDeadlines,
    RENEWAL_NOTICE_LOOKAHEAD_DAYS,
    type RenewalNoticeOutcome
} from './renewal-notice.js';

const logger = createLogger('send-renewal-notices');

/** One row handled during a renewal notice run. */
export interface RenewalNoticeRunRow {
    readonly subscriptionId: string;
    readonly outcome: RenewalNoticeOutcome | 'FAILED';
    readonly milestone: string | null;
    readonly error?: string;
}

/** Aggregate counts and row details from one renewal notice run. */
export interface SendRenewalNoticesResult {
    readonly enqueued: number;
    readonly alreadyEnqueued: number;
    readonly stamped: number;
    readonly notDue: number;
    readonly skipped: number;
    readonly failed: number;
    readonly rows: readonly RenewalNoticeRunRow[];
}

const runInputSchema = z.strictObject({ limit: z.number().int().positive().max(10_000) });
const currentDeadlinesSchema = z.strictObject({
    version: z.number().int().positive(),
    values: z.unknown()
});

/** Enqueues the due renewal notices, using one transaction for each selected subscription. */
export async function sendRenewalNotices(
    input: { readonly limit: number; readonly db?: DrizzleClient },
    ports: {
        readonly clock: Clock;
        readonly readCurrentDeadlines?: () => Promise<CurrentRenewalDeadlines>;
    }
): Promise<SendRenewalNoticesResult> {
    const parsed = runInputSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid renewal notice run limit',
            parsed.error.issues,
            'INVALID_SEND_RENEWAL_NOTICES_INPUT'
        );
    const dbPackage = await import('@repo/db');
    const db = input.db ?? dbPackage.getDb();
    const now = ports.clock.now();
    const readCurrentDeadlines =
        ports.readCurrentDeadlines ??
        (async () => {
            const { getCurrentBillingDeadlines } = await import(
                '../deadlines/billing-deadlines.service'
            );
            const deadline = await getCurrentBillingDeadlines();
            return {
                version: deadline.version,
                values: BillingDeadlineValuesSchema.parse(deadline.values)
            };
        });
    const currentRaw = await readCurrentDeadlines();
    const current = currentDeadlinesSchema.safeParse(currentRaw);
    if (!current.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Current billing deadlines are invalid',
            current.error.issues
        );
    const { and: dbAnd, asc: dbAsc, eq: dbEq, gt: dbGt, lte: dbLte, subscriptions } = dbPackage;
    const horizon = new Date(now.getTime() + RENEWAL_NOTICE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const selected = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
            dbAnd(
                dbEq(subscriptions.class, 'PRINCIPAL'),
                dbEq(subscriptions.status, 'ACTIVE'),
                dbEq(subscriptions.paymentMethod, 'CARD'),
                dbGt(subscriptions.nextChargeAt, now),
                dbLte(subscriptions.nextChargeAt, horizon)
            )
        )
        .orderBy(dbAsc(subscriptions.nextChargeAt), dbAsc(subscriptions.id))
        .limit(parsed.data.limit);
    const rows: RenewalNoticeRunRow[] = [];
    const counts = {
        enqueued: 0,
        alreadyEnqueued: 0,
        stamped: 0,
        notDue: 0,
        skipped: 0,
        failed: 0
    };
    for (const { id: subscriptionId } of selected) {
        try {
            const result = await db.transaction((tx) =>
                applyRenewalNotice({ tx, subscriptionId, now, current: current.data })
            );
            if (result.outcome === 'ENQUEUED') counts.enqueued += 1;
            if (result.outcome === 'ALREADY_ENQUEUED') counts.alreadyEnqueued += 1;
            if (result.stamped) counts.stamped += 1;
            if (result.outcome === 'STAMPED_NOT_DUE' || result.outcome === 'NOT_DUE')
                counts.notDue += 1;
            if (result.outcome === 'SKIPPED') counts.skipped += 1;
            rows.push({ subscriptionId, outcome: result.outcome, milestone: result.milestone });
        } catch (error) {
            counts.failed += 1;
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ subscriptionId, error }, 'Renewal notice row failed; run continues');
            rows.push({ subscriptionId, outcome: 'FAILED', milestone: null, error: message });
        }
    }
    if (selected.length === parsed.data.limit)
        logger.warn({ limit: parsed.data.limit }, 'Renewal notice page is full');
    logger.info(counts, 'Renewal notice run finished');
    return { ...counts, rows };
}
