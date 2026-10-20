import type { PublicationStatusEnum } from '@repo/schemas';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { domainEvent } from '../../schemas/domain-event/domain_event.dbschema.ts';
import { fixRequests } from '../../schemas/listing/fix_request.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { domainEventModel } from '../domain-event/domain-event.model.ts';
import type { ListingVertical } from './listing-publication.model.ts';

const TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

/** Origin of the most recent transition into MODERATED, if one was recorded. */
export interface ListingModerationOrigin {
    readonly from: PublicationStatusEnum;
    readonly archiveOrigin: PublicationStatusEnum | null;
}

/** An open owner fix request. */
export interface OpenListingFixRequest {
    readonly id: string;
    readonly reason: string;
    readonly suggestedDate: string | null;
    readonly openedAt: Date;
    readonly openedById: string;
    readonly ownerReportedFixedAt: Date | null;
}

/** Transaction-bound persistence for listing moderation and fix requests. */
export const listingModerationModel = {
    /** Reads the latest audited transition into MODERATED. */
    async readModerationOrigin(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
    }): Promise<ListingModerationOrigin | null> {
        const tableName = TABLES[args.vertical];
        const rows = await args.tx
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.eventType, 'listing.status_changed'),
                    eq(domainEvent.entityType, args.vertical),
                    eq(domainEvent.entityId, args.listingId),
                    sql`${domainEvent.changes} @> ${JSON.stringify([{ field: 'publicationStatus', new: 'MODERATED' }])}::jsonb`,
                    sql`EXISTS (SELECT 1 FROM ${sql.identifier(tableName)} WHERE id = ${args.listingId}::uuid)`
                )
            )
            .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
            .limit(1);
        const event = rows[0];
        if (!event) return null;
        const statusChange = event.changes.find((change) => change.field === 'publicationStatus');
        if (!statusChange || typeof statusChange.old !== 'string') return null;
        const archiveChange = event.changes.find((change) => change.field === 'archiveOrigin');
        return {
            from: statusChange.old as PublicationStatusEnum,
            archiveOrigin:
                archiveChange && typeof archiveChange.new === 'string'
                    ? (archiveChange.new as PublicationStatusEnum)
                    : null
        };
    },

    /** Reads the sole open fix request for a listing. */
    async readOpenFixRequest(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
    }): Promise<OpenListingFixRequest | null> {
        const rows = await args.tx
            .select()
            .from(fixRequests)
            .where(
                and(
                    eq(fixRequests.entityType, args.vertical),
                    eq(fixRequests.entityId, args.listingId),
                    isNull(fixRequests.closedAt)
                )
            )
            .limit(1);
        const row = rows[0];
        return row
            ? {
                  id: row.id,
                  reason: row.reason,
                  suggestedDate: row.suggestedDate,
                  openedAt: row.openedAt,
                  openedById: row.openedById,
                  ownerReportedFixedAt: row.ownerReportedFixedAt
              }
            : null;
    },

    /** Opens a request, returning ALREADY_OPEN when the partial unique index conflicts. */
    async openFixRequest(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly reason: string;
        readonly suggestedDate: string | null;
        readonly openedById: string;
        readonly openedAt: Date;
    }): Promise<
        | { readonly opened: true; readonly id: string }
        | { readonly opened: false; readonly reason: 'ALREADY_OPEN' }
    > {
        const rows = await args.tx
            .insert(fixRequests)
            .values({
                entityType: args.vertical,
                entityId: args.listingId,
                reason: args.reason,
                suggestedDate: args.suggestedDate,
                openedById: args.openedById,
                openedAt: args.openedAt
            })
            .onConflictDoNothing({
                target: [fixRequests.entityType, fixRequests.entityId],
                where: isNull(fixRequests.closedAt)
            })
            .returning({ id: fixRequests.id });
        const row = rows[0];
        return row ? { opened: true, id: row.id } : { opened: false, reason: 'ALREADY_OPEN' };
    },

    /** Closes the open request, with a null actor for a purge close. */
    async closeOpenFixRequest(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly closedAt: Date;
        readonly closedById: string | null;
    }): Promise<{ readonly id: string } | null> {
        const rows = await args.tx
            .update(fixRequests)
            .set({ closedAt: args.closedAt, closedById: args.closedById })
            .where(
                and(
                    eq(fixRequests.entityType, args.vertical),
                    eq(fixRequests.entityId, args.listingId),
                    isNull(fixRequests.closedAt)
                )
            )
            .returning({ id: fixRequests.id });
        return rows[0] ?? null;
    },

    /**
     * The owner reports the open fix request as fixed (row 30, HOS-1492, H4).
     * A conditional UPDATE over the open request that has no report yet: a
     * second report never rewrites the first instant. It neither closes the
     * request nor writes an event (the column IS the record).
     *
     * @returns `NO_OPEN` without an open request, `ALREADY` with the first
     * instant when it was already reported, `REPORTED` with `at` otherwise.
     */
    async reportFixed(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly at: Date;
    }): Promise<
        | { readonly status: 'NO_OPEN' }
        | { readonly status: 'ALREADY'; readonly at: Date }
        | { readonly status: 'REPORTED'; readonly at: Date }
    > {
        const rows = await args.tx
            .update(fixRequests)
            .set({ ownerReportedFixedAt: args.at })
            .where(
                and(
                    eq(fixRequests.entityType, args.vertical),
                    eq(fixRequests.entityId, args.listingId),
                    isNull(fixRequests.closedAt),
                    isNull(fixRequests.ownerReportedFixedAt)
                )
            )
            .returning({ at: fixRequests.ownerReportedFixedAt });
        const written = rows[0]?.at;
        if (written) return { status: 'REPORTED', at: written };
        const open = await listingModerationModel.readOpenFixRequest(args);
        if (!open) return { status: 'NO_OPEN' };
        if (!open.ownerReportedFixedAt)
            throw new Error('fix request report changed inside the owner transaction');
        return { status: 'ALREADY', at: open.ownerReportedFixedAt };
    },

    /** Writes a fix-request audit event in the caller's transaction. */
    async insertFixRequestEvent(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly eventType: 'listing.fix_request_opened' | 'listing.fix_request_closed';
        readonly fixRequestId: string;
        readonly actorType: 'owner' | 'admin';
        readonly actorId: string;
        readonly reason: string;
        readonly correlationId: string;
        readonly occurredAt?: Date;
    }): Promise<void> {
        const opened = args.eventType === 'listing.fix_request_opened';
        await domainEventModel.insert({
            tx: args.tx,
            eventType: args.eventType,
            entityType: args.vertical,
            entityId: args.listingId,
            actorType: args.actorType,
            actorId: args.actorId,
            reason: args.reason,
            correlationId: args.correlationId,
            occurredAt: args.occurredAt,
            changes: [
                {
                    field: 'fixRequest',
                    old: opened ? null : args.fixRequestId,
                    new: opened ? args.fixRequestId : null
                }
            ]
        });
    }
};
