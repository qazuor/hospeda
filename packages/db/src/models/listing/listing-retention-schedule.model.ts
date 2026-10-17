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

export const listingRetentionScheduleModel = { readLastOwnerActAt };
