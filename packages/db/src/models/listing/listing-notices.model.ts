import { PublicationStatusEnum } from '@repo/schemas';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type DomainEventChange,
    domainEvent
} from '../../schemas/domain-event/domain_event.dbschema.ts';
import { fixRequests } from '../../schemas/listing/fix_request.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import type { OpenListingFixRequest } from './listing-moderation.model.ts';
import type { ListingVertical } from './listing-publication.model.ts';

const TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodations',
    venue: 'gastronomies',
    experience: 'experiences'
};

const STATUSES: ReadonlySet<string> = new Set(Object.values(PublicationStatusEnum));

/** One `listing.status_changed` event, flattened to what the notices read. */
export interface ListingStatusChangeFact {
    readonly listingId: string;
    readonly from: PublicationStatusEnum | null;
    readonly to: PublicationStatusEnum;
    readonly actorType: string;
    readonly reason: string | null;
    readonly occurredAt: Date;
    readonly correlationId: string;
    /** The `archiveOrigin` change of an archive event (`PB4`/`PB5`), if any. */
    readonly archiveOrigin: PublicationStatusEnum | null;
}

/** The last lift of a moderation (`MODERATED` → another state but `PURGED`). */
export interface ListingLiftFact {
    readonly at: Date;
    /** Where the lift's intention left the listing (follows its own chain, e.g. `PB13` → `PB3`). */
    readonly returnedTo: PublicationStatusEnum;
}

/** One listing of an owner with the facts its notices are built from (H2). */
export interface ListingNoticeRow {
    readonly id: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly deletionAnnouncedAt: Date | null;
    /** The most recent transition INTO the listing's current status, if recorded. */
    readonly enteredCurrentStatus: ListingStatusChangeFact | null;
    /** The most recent lift of a moderation, if any. */
    readonly lastLift: ListingLiftFact | null;
    /** The open fix request, if any. */
    readonly openFixRequest: OpenListingFixRequest | null;
}

/** A listing row as the notices query reads it. */
export interface ListingNoticeListing {
    readonly id: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly deletionAnnouncedAt: Date | null;
}

/** A `listing.status_changed` row as the notices query reads it. */
export interface ListingStatusChangedEventRow {
    readonly entityId: string;
    readonly actorType: string;
    readonly reason: string | null;
    readonly occurredAt: Date;
    readonly correlationId: string;
    readonly changes: readonly DomainEventChange[];
}

/** An open fix request row keyed by its listing. */
export interface ListingOpenFixRequestRow extends OpenListingFixRequest {
    readonly listingId: string;
}

function asStatus(value: unknown): PublicationStatusEnum | null {
    return typeof value === 'string' && STATUSES.has(value)
        ? (value as PublicationStatusEnum)
        : null;
}

/** Flattens one event row; null when it carries no `publicationStatus` change. */
export function toStatusChangeFact(
    event: ListingStatusChangedEventRow
): ListingStatusChangeFact | null {
    const status = event.changes.find((change) => change.field === 'publicationStatus');
    const to = asStatus(status?.new);
    if (!to) return null;
    const origin = event.changes.find((change) => change.field === 'archiveOrigin');
    return {
        listingId: event.entityId,
        from: asStatus(status?.old),
        to,
        actorType: event.actorType,
        reason: event.reason,
        occurredAt: event.occurredAt,
        correlationId: event.correlationId,
        archiveOrigin: asStatus(origin?.new)
    };
}

/** Latest first; same instant keeps the later array position (insertion order). */
function latest<T extends { readonly occurredAt: Date }>(items: readonly T[]): T | null {
    let found: T | null = null;
    for (const item of items) {
        if (!found || item.occurredAt.getTime() >= found.occurredAt.getTime()) found = item;
    }
    return found;
}

/**
 * Resolves the last lift of a moderation and where its intention left the
 * listing. The events of one transaction share their instant, so the chain is
 * followed by status (`from` of the next = `to` of the previous) inside the
 * lift's correlation, never by order.
 */
function resolveLastLift(facts: readonly ListingStatusChangeFact[]): ListingLiftFact | null {
    const lift = latest(
        facts.filter(
            (fact) =>
                fact.from === PublicationStatusEnum.MODERATED &&
                fact.to !== PublicationStatusEnum.PURGED &&
                fact.to !== PublicationStatusEnum.MODERATED
        )
    );
    if (!lift) return null;
    const chain = facts.filter(
        (fact) => fact.correlationId === lift.correlationId && fact !== lift
    );
    let returnedTo = lift.to;
    const used = new Set<ListingStatusChangeFact>();
    for (;;) {
        const next = chain.find(
            (fact) =>
                !used.has(fact) &&
                fact.from === returnedTo &&
                fact.occurredAt.getTime() >= lift.occurredAt.getTime()
        );
        if (!next) break;
        used.add(next);
        returnedTo = next.to;
    }
    return { at: lift.occurredAt, returnedTo };
}

/**
 * Pure assembly of the notice rows of one owner's listings from the three
 * reads (listings, their status events, their open fix requests). Exported for
 * the unit test.
 *
 * @param input.listings - The owner's listings, in display order.
 * @param input.events - Their `listing.status_changed` events, oldest first.
 * @param input.fixRequests - Their open fix requests.
 * @returns One row per listing, in the same order.
 */
export function assembleListingNoticeRows(input: {
    readonly listings: readonly ListingNoticeListing[];
    readonly events: readonly ListingStatusChangedEventRow[];
    readonly fixRequests: readonly ListingOpenFixRequestRow[];
}): readonly ListingNoticeRow[] {
    const factsByListing = new Map<string, ListingStatusChangeFact[]>();
    for (const event of input.events) {
        const fact = toStatusChangeFact(event);
        if (!fact) continue;
        const list = factsByListing.get(fact.listingId) ?? [];
        list.push(fact);
        factsByListing.set(fact.listingId, list);
    }
    const fixByListing = new Map(input.fixRequests.map((row) => [row.listingId, row]));
    return input.listings.map((listing) => {
        const facts = factsByListing.get(listing.id) ?? [];
        const fix = fixByListing.get(listing.id);
        return {
            id: listing.id,
            publicationStatus: listing.publicationStatus,
            deletionAnnouncedAt: listing.deletionAnnouncedAt,
            enteredCurrentStatus: latest(
                facts.filter((fact) => fact.to === listing.publicationStatus)
            ),
            lastLift: resolveLastLift(facts),
            openFixRequest: fix
                ? {
                      id: fix.id,
                      reason: fix.reason,
                      suggestedDate: fix.suggestedDate,
                      openedAt: fix.openedAt,
                      openedById: fix.openedById,
                      ownerReportedFixedAt: fix.ownerReportedFixedAt
                  }
                : null
        };
    });
}

/**
 * Composition read of Mi Cuenta (HOS-1492, V8a.1b, H2): every listing of one
 * owner in one vertical — `PURGED` ones included, they keep `deleted_at` NULL —
 * with the facts its notices are built from. Three queries per call (listings,
 * their status events, their open fix requests), never one per listing.
 */
export const listingNoticesModel = {
    /**
     * Reads the notice rows of an owner's listings in a vertical.
     *
     * @param args.vertical - The listing vertical (also the events' entity type).
     * @param args.ownerId - The owner.
     * @param args.tx - Optional transaction; the shared client otherwise.
     * @returns One row per non-deleted listing, oldest first.
     */
    async readOwnerListingNotices(args: {
        readonly vertical: ListingVertical;
        readonly ownerId: string;
        readonly tx?: DrizzleClient;
    }): Promise<readonly ListingNoticeRow[]> {
        const client = args.tx ?? getDb();
        const result = await client.execute(sql<{
            id: string;
            publicationStatus: string;
            deletionAnnouncedAt: string | Date | null;
        }>`
            SELECT id, publication_status AS "publicationStatus",
                   deletion_announced_at AS "deletionAnnouncedAt"
            FROM ${sql.identifier(TABLES[args.vertical])}
            WHERE owner_id = ${args.ownerId}::uuid AND deleted_at IS NULL
            ORDER BY created_at ASC, id ASC`);
        const listings: ListingNoticeListing[] = result.rows.map((row) => ({
            id: String(row.id),
            publicationStatus: row.publicationStatus as PublicationStatusEnum,
            deletionAnnouncedAt:
                row.deletionAnnouncedAt === null || row.deletionAnnouncedAt === undefined
                    ? null
                    : new Date(String(row.deletionAnnouncedAt))
        }));
        if (listings.length === 0) return [];
        const ids = listings.map((listing) => listing.id);
        const events = await client
            .select({
                entityId: domainEvent.entityId,
                actorType: domainEvent.actorType,
                reason: domainEvent.reason,
                occurredAt: domainEvent.occurredAt,
                correlationId: domainEvent.correlationId,
                changes: domainEvent.changes
            })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.eventType, 'listing.status_changed'),
                    eq(domainEvent.entityType, args.vertical),
                    inArray(domainEvent.entityId, ids)
                )
            )
            .orderBy(asc(domainEvent.occurredAt));
        const open = await client
            .select()
            .from(fixRequests)
            .where(
                and(
                    eq(fixRequests.entityType, args.vertical),
                    inArray(fixRequests.entityId, ids),
                    isNull(fixRequests.closedAt)
                )
            );
        return assembleListingNoticeRows({
            listings,
            events,
            fixRequests: open.map((row) => ({
                listingId: row.entityId,
                id: row.id,
                reason: row.reason,
                suggestedDate: row.suggestedDate,
                openedAt: row.openedAt,
                openedById: row.openedById,
                ownerReportedFixedAt: row.ownerReportedFixedAt
            }))
        });
    }
};
