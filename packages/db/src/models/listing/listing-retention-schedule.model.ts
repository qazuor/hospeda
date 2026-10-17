import { VerticalDeadlineValuesSchema } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import type { ListingVertical } from './listing-publication.model.ts';

/** Reads the latest owner-created or owner-edited event for this listing. */
export async function readLastOwnerActAt(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly listingId: string;
}): Promise<Date | null> {
    const result = await args.tx.execute(sql<{ occurredAt: Date | null }>`
        SELECT max(occurred_at) AS "occurredAt"
        FROM domain_event
        WHERE entity_type = ${args.vertical}
          AND entity_id = ${args.listingId}
          AND actor_type = 'owner'
          AND event_type IN ('listing.created', 'listing.edited')`);
    const occurredAt = result.rows[0]?.occurredAt;
    return occurredAt === null || occurredAt === undefined ? null : new Date(String(occurredAt));
}

/** Reads plazo 4 from the immutable deadline version used by the listing. */
export async function readRetentionNoticeDeadlines(args: {
    readonly tx: DrizzleClient;
    readonly deadlinesVersion: number;
}): Promise<{ readonly beforeArchiveDays: number; readonly beforeDeletionDays: number }> {
    const result = await args.tx.execute(
        sql<{
            values: unknown;
        }>`SELECT "values" FROM vertical_deadline_version WHERE version = ${args.deadlinesVersion} LIMIT 1`
    );
    const raw = result.rows[0]?.values;
    const parsed = VerticalDeadlineValuesSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid deadline version ${args.deadlinesVersion}`);
    return {
        beforeArchiveDays: parsed.data['4'].beforeArchiveDays,
        beforeDeletionDays: parsed.data['4'].beforeDeletionDays
    };
}

export const listingRetentionScheduleModel = { readLastOwnerActAt, readRetentionNoticeDeadlines };
