import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { applyGraceReminder, type GraceReminderOutcome } from './grace-reminder-notice.js';

const logger = createLogger('send-grace-reminders');
const inputSchema = z.strictObject({ limit: z.number().int().positive().max(10_000) });
/** Result for one subscription considered during a grace reminder run. */
export interface GraceReminderRunRow {
    readonly subscriptionId: string;
    readonly outcome: GraceReminderOutcome | 'FAILED';
    readonly milestone: string | null;
    readonly error?: string;
}
/** Counts and per-subscription outcomes from a grace reminder run. */
export interface SendGraceRemindersResult {
    readonly enqueued: number;
    readonly alreadyEnqueued: number;
    readonly notDue: number;
    readonly noDeadline: number;
    readonly skipped: number;
    readonly failed: number;
    readonly rows: readonly GraceReminderRunRow[];
}

/** Enqueues due grace reminders in stable pages, isolating each subscription transaction. */
export async function sendGraceReminders(
    input: { readonly limit: number; readonly db?: DrizzleClient },
    ports: {
        readonly clock: Clock;
        readonly readRecipientEmail?: (userId: string) => Promise<string | null>;
    }
): Promise<SendGraceRemindersResult> {
    const parsed = inputSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid grace reminder run limit',
            parsed.error.issues
        );
    const dbPkg = await import('@repo/db');
    const db = input.db ?? dbPkg.getDb();
    const now = ports.clock.now();
    const selected = await db
        .select({ id: dbPkg.subscriptions.id })
        .from(dbPkg.subscriptions)
        .where(
            dbPkg.and(
                dbPkg.eq(dbPkg.subscriptions.class, 'PRINCIPAL'),
                dbPkg.eq(dbPkg.subscriptions.status, 'GRACE_PERIOD'),
                dbPkg.gt(dbPkg.subscriptions.graceEndsAt, now)
            )
        )
        .orderBy(dbPkg.asc(dbPkg.subscriptions.graceEndsAt), dbPkg.asc(dbPkg.subscriptions.id))
        .limit(parsed.data.limit);
    const counts = {
        enqueued: 0,
        alreadyEnqueued: 0,
        notDue: 0,
        noDeadline: 0,
        skipped: 0,
        failed: 0
    };
    const rows: GraceReminderRunRow[] = [];
    for (const { id } of selected) {
        try {
            const result = await db.transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: id,
                    now,
                    readRecipientEmail: ports.readRecipientEmail
                })
            );
            if (result.outcome === 'ENQUEUED') counts.enqueued++;
            if (result.outcome === 'ALREADY_ENQUEUED') counts.alreadyEnqueued++;
            if (result.outcome === 'NOT_DUE') counts.notDue++;
            if (result.outcome === 'NO_DEADLINE') counts.noDeadline++;
            if (result.outcome === 'SKIPPED') counts.skipped++;
            rows.push({ subscriptionId: id, ...result });
        } catch (error) {
            counts.failed++;
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ subscriptionId: id, error }, 'Grace reminder row failed; run continues');
            rows.push({ subscriptionId: id, outcome: 'FAILED', milestone: null, error: message });
        }
    }
    if (selected.length === parsed.data.limit)
        logger.warn({ limit: parsed.data.limit }, 'Grace reminder page is full');
    logger.info(counts, 'Grace reminder run finished');
    return { ...counts, rows };
}
