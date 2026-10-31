import { EntityTypeEnum } from '@repo/schemas';
import { type SQL, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type { DrizzleClient } from '../../types.ts';
import { listingModerationModel } from './listing-moderation.model.ts';
import type { ListingVertical } from './listing-publication.model.ts';

/** Rows whose remote asset must be removed after the purge transaction commits. */
export interface MarkedPurgeMedia {
    readonly mediaId: string;
    readonly publicId: string | null;
}

/** Rows whose calendar credentials must be revoked after the purge commits. */
export interface MarkedPurgeCalendar {
    readonly connectionId: string;
    readonly provider: string;
}

/** Closed result of deleting listing-owned content and marking external assets. */
export interface PurgeListingContentResult {
    readonly markedMedia: readonly MarkedPurgeMedia[];
    readonly markedCalendar: readonly MarkedPurgeCalendar[];
    readonly closedAlerts: readonly { readonly alertId: string; readonly touristUserId: string }[];
    readonly closedFixRequestId: string | null;
}

const LISTING_TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};

const MEDIA_TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodation_media',
    venue: 'venue_media',
    experience: 'experience_media'
};

const MEDIA_FKS: Record<ListingVertical, string> = {
    accommodation: 'accommodation_id',
    venue: 'venue_id',
    experience: 'experience_id'
};

const CONTENT_TABLES: Record<ListingVertical, readonly { table: string; fk: string }[]> = {
    accommodation: [
        { table: 'accommodation_faqs', fk: 'accommodation_id' },
        { table: 'r_accommodation_amenity', fk: 'accommodation_id' },
        { table: 'r_accommodation_feature', fk: 'accommodation_id' },
        { table: 'r_entity_tag', fk: 'entity_id' },
        { table: 'qr_codes', fk: 'entity_id' },
        { table: 'entity_view_monthly_rollups', fk: 'entity_id' },
        { table: 'owner_promotions', fk: 'accommodation_id' },
        { table: 'accommodation_external_listings', fk: 'accommodation_id' },
        { table: 'accommodation_external_reputation', fk: 'accommodation_id' },
        { table: 'accommodation_occupancy', fk: 'accommodation_id' },
        { table: 'accommodation_ia_data', fk: 'accommodation_id' }
    ],
    venue: [
        { table: 'venue_faqs', fk: 'venue_id' },
        { table: 'r_venue_amenity', fk: 'venue_id' },
        { table: 'r_venue_feature', fk: 'venue_id' },
        { table: 'r_entity_tag', fk: 'entity_id' },
        { table: 'qr_codes', fk: 'entity_id' },
        { table: 'entity_view_monthly_rollups', fk: 'entity_id' },
        { table: 'venue_menu_items', fk: 'venue_id' },
        { table: 'venue_menu_sections', fk: 'venue_id' },
        { table: 'venue_daily_specials', fk: 'venue_id' },
        { table: 'venue_events', fk: 'venue_id' }
    ],
    experience: [
        { table: 'experience_faqs', fk: 'experience_id' },
        { table: 'r_experience_amenity', fk: 'experience_id' },
        { table: 'r_experience_feature', fk: 'experience_id' },
        { table: 'r_entity_tag', fk: 'entity_id' },
        { table: 'qr_codes', fk: 'entity_id' },
        { table: 'entity_view_monthly_rollups', fk: 'entity_id' },
        { table: 'experience_certificates', fk: 'experience_id' }
    ]
};

const BLANK_CONTENT: Record<ListingVertical, SQL> = {
    accommodation: sql`summary = '', description = '', rich_description = NULL,
        name_i18n = NULL, summary_i18n = NULL, description_i18n = NULL, rich_description_i18n = NULL,
        translation_meta = NULL, contact_info = NULL, social_networks = NULL, price = NULL,
        location = NULL, videos = NULL, seo = NULL, extra_info = NULL`,
    venue: sql`summary = '', description = '', rich_description = NULL,
        name_i18n = NULL, summary_i18n = NULL, description_i18n = NULL, rich_description_i18n = NULL,
        menu_url = NULL, menu_file_url = NULL, menu_file_public_id = NULL,
        menu_file_kind = NULL, contact_info = NULL, social_networks = NULL, opening_hours = NULL,
        price_range = NULL, videos = NULL, seo = NULL`,
    experience: sql`summary = '', description = '', rich_description = NULL,
        name_i18n = NULL, summary_i18n = NULL, description_i18n = NULL, rich_description_i18n = NULL,
        price_from = NULL, price_unit = NULL, is_price_on_request = true,
        meeting_point = NULL, meeting_point_lat = NULL, meeting_point_long = NULL,
        meeting_point_directions = '{}', duration_minutes = NULL, what_to_bring = '{}',
        requirements = '{}', cancellation_policy = NULL, accepts_private_groups = false,
        contact_info = NULL, social_networks = NULL, opening_hours = NULL, videos = NULL, seo = NULL`
};

const ENTITY_TYPES: Record<ListingVertical, EntityTypeEnum> = {
    accommodation: EntityTypeEnum.ACCOMMODATION,
    venue: EntityTypeEnum.VENUE,
    experience: EntityTypeEnum.EXPERIENCE
};

const MARK_CALENDAR: Record<
    ListingVertical,
    (args: {
        readonly tx: DrizzleClient;
        readonly listingId: string;
        readonly at: Date;
    }) => Promise<readonly { readonly id: string; readonly provider: string }[]>
> = {
    accommodation: async ({ tx, listingId, at }) => {
        const result = await tx.execute(sql<{ id: string; provider: string }>`
            UPDATE accommodation_calendar_sync
            SET remote_deletion_pending_at = ${at}, is_active = false
            WHERE accommodation_id = ${listingId} AND remote_deletion_pending_at IS NULL
            RETURNING id, provider`);
        return result.rows.map((row) => ({ id: String(row.id), provider: String(row.provider) }));
    },
    venue: async () => [],
    experience: async () => []
};

/**
 * Carries each uploaded menu file and dish photo into venue_media before the purge
 * transaction deletes the rows that named them. The existing mark and post-commit deletion
 * path then handles them like gallery photos, with the daily retry covering any failure.
 */
const CARRY_REMOTE_ASSETS: Record<
    ListingVertical,
    (args: { readonly tx: DrizzleClient; readonly listingId: string }) => Promise<void>
> = {
    accommodation: async () => {},
    venue: async ({ tx, listingId }) => {
        await tx.execute(sql`
            INSERT INTO venue_media (venue_id, url, public_id, is_featured, sort_order)
            SELECT id, COALESCE(menu_file_url, ''), menu_file_public_id, false, 0
            FROM venues
            WHERE id = ${listingId} AND menu_file_public_id IS NOT NULL`);
        await tx.execute(sql`
            INSERT INTO venue_media (venue_id, url, public_id, is_featured, sort_order)
            SELECT venue_id, COALESCE(photo_url, ''), photo_public_id, false, 0
            FROM venue_menu_items
            WHERE venue_id = ${listingId} AND photo_public_id IS NOT NULL`);
    },
    experience: async () => {}
};

const CLOSE_PRICE_ALERTS: Record<
    ListingVertical,
    (args: {
        readonly tx: DrizzleClient;
        readonly listingId: string;
    }) => Promise<readonly { readonly id: string; readonly user_id: string }[]>
> = {
    accommodation: async ({ tx, listingId }) => {
        const result = await tx.execute(sql<{ id: string; user_id: string }>`
            UPDATE tourist_price_alerts SET is_active = false
            WHERE accommodation_id = ${listingId} AND is_active = true AND deleted_at IS NULL
            RETURNING id, user_id`);
        return result.rows.map((row) => ({ id: String(row.id), user_id: String(row.user_id) }));
    },
    venue: async () => [],
    experience: async () => []
};

function toDate(value: unknown): Date {
    return value instanceof Date ? value : new Date(String(value));
}

/** Transaction-bound closed-list purge persistence for PB12. */
export const listingPurgeModel = {
    /**
     * Deletes listing-only rows, blanks listing content, and marks remote rows for post-commit work.
     * Uploaded venue menu files and dish photos are carried into marked media rows first.
     */
    async purgeListingContent(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly at: Date;
    }): Promise<PurgeListingContentResult> {
        const { tx, vertical, listingId, at } = args;
        await CARRY_REMOTE_ASSETS[vertical]({ tx, listingId });
        for (const item of CONTENT_TABLES[vertical]) {
            const entityPredicate =
                item.fk === 'entity_id'
                    ? sql`entity_type = ${ENTITY_TYPES[vertical]} AND entity_id = ${listingId}`
                    : sql`${sql.identifier(item.fk)} = ${listingId}`;
            await tx.execute(
                sql`DELETE FROM ${sql.identifier(item.table)} WHERE ${entityPredicate}`
            );
        }

        const markedMediaResult = await tx.execute(sql<{ id: string; public_id: string | null }>`
            UPDATE ${sql.identifier(MEDIA_TABLES[vertical])}
            SET remote_deletion_pending_at = ${at}
            WHERE ${sql.identifier(MEDIA_FKS[vertical])} = ${listingId}
              AND remote_deletion_pending_at IS NULL
            RETURNING id, public_id`);

        const markedCalendar = await MARK_CALENDAR[vertical]({ tx, listingId, at });
        const closedAlerts = await CLOSE_PRICE_ALERTS[vertical]({ tx, listingId });

        const closedFixRequest = await listingModerationModel.closeOpenFixRequest({
            tx,
            vertical,
            listingId,
            closedAt: at,
            closedById: null
        });

        await tx.execute(sql`UPDATE ${sql.identifier(LISTING_TABLES[vertical])}
            SET ${BLANK_CONTENT[vertical]}
            WHERE id = ${listingId}`);

        return {
            markedMedia: markedMediaResult.rows.map((row) => ({
                mediaId: String(row.id),
                publicId: row.public_id === null ? null : String(row.public_id)
            })),
            markedCalendar: markedCalendar.map((row) => ({
                connectionId: String(row.id),
                provider: String(row.provider)
            })),
            closedAlerts: closedAlerts.map((row) => ({
                alertId: String(row.id),
                touristUserId: String(row.user_id)
            })),
            closedFixRequestId: closedFixRequest?.id ?? null
        };
    },

    /** Removes one row only after a previous transaction marked it for deletion. */
    async deleteMarkedMedia(args: {
        readonly tx?: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly mediaId: string;
    }): Promise<boolean> {
        const result = await (
            args.tx ?? getDb()
        ).execute(sql`DELETE FROM ${sql.identifier(MEDIA_TABLES[args.vertical])}
            WHERE id = ${args.mediaId} AND remote_deletion_pending_at IS NOT NULL RETURNING id`);
        return result.rows.length > 0;
    },

    /**
     * Returns a keyset page of listing media rows still marked for remote deletion, across the
     * three verticals, ordered by `(vertical, id)`. Rows without the mark are never returned.
     */
    async listMarkedMedia(args: {
        readonly tx?: DrizzleClient;
        readonly after: { readonly vertical: ListingVertical; readonly mediaId: string } | null;
        readonly limit: number;
    }): Promise<{
        readonly items: readonly {
            readonly vertical: ListingVertical;
            readonly mediaId: string;
            readonly publicId: string | null;
            readonly markedAt: Date;
        }[];
        readonly next: { readonly vertical: ListingVertical; readonly mediaId: string } | null;
    }> {
        const branches = Object.entries(MEDIA_TABLES).map(
            ([vertical, table]) => sql`
            SELECT ${vertical}::text AS vertical, m.id::text AS "mediaId",
                m.public_id AS "publicId", m.remote_deletion_pending_at AS "markedAt"
            FROM ${sql.identifier(table)} m
            WHERE m.remote_deletion_pending_at IS NOT NULL`
        );
        const union = sql.join(branches, sql` UNION ALL `);
        const result = await (args.tx ?? getDb()).execute(sql<{
            vertical: string;
            mediaId: string;
            publicId: string | null;
            markedAt: Date | string;
        }>`
            SELECT * FROM (${union}) marked
            WHERE ${args.after === null ? sql`true` : sql`(vertical, "mediaId") > (${args.after.vertical}, ${args.after.mediaId})`}
            ORDER BY vertical, "mediaId" LIMIT ${args.limit + 1}`);
        const items = result.rows.slice(0, args.limit).map((row) => ({
            vertical: row.vertical as ListingVertical,
            mediaId: String(row.mediaId),
            publicId: row.publicId === null ? null : String(row.publicId),
            markedAt: toDate(row.markedAt)
        }));
        const last = items.at(-1);
        return {
            items,
            next:
                result.rows.length > args.limit && last
                    ? { vertical: last.vertical, mediaId: last.mediaId }
                    : null
        };
    },

    /** Returns a keyset page of calendar connections still marked for remote revocation, by id. */
    async listMarkedCalendarConnections(args: {
        readonly tx?: DrizzleClient;
        readonly after: string | null;
        readonly limit: number;
    }): Promise<{
        readonly items: readonly {
            readonly connectionId: string;
            readonly accommodationId: string;
            readonly provider: string;
            readonly markedAt: Date;
        }[];
        readonly next: string | null;
    }> {
        const result = await (args.tx ?? getDb()).execute(sql<{
            connectionId: string;
            accommodationId: string;
            provider: string;
            markedAt: Date | string;
        }>`
            SELECT * FROM (
                SELECT id::text AS "connectionId", accommodation_id::text AS "accommodationId",
                    provider::text AS provider, remote_deletion_pending_at AS "markedAt"
                FROM accommodation_calendar_sync
                WHERE remote_deletion_pending_at IS NOT NULL
            ) marked
            WHERE ${args.after === null ? sql`true` : sql`"connectionId" > ${args.after}`}
            ORDER BY "connectionId" LIMIT ${args.limit + 1}`);
        const items = result.rows.slice(0, args.limit).map((row) => ({
            connectionId: String(row.connectionId),
            accommodationId: String(row.accommodationId),
            provider: String(row.provider),
            markedAt: toDate(row.markedAt)
        }));
        const last = items.at(-1);
        return {
            items,
            next: result.rows.length > args.limit && last ? last.connectionId : null
        };
    },

    /** Removes one calendar row only after it was marked by PB12. */
    async deleteMarkedCalendarConnection(args: {
        readonly tx?: DrizzleClient;
        readonly connectionId: string;
    }): Promise<boolean> {
        const result = await (
            args.tx ?? getDb()
        ).execute(sql`DELETE FROM accommodation_calendar_sync
            WHERE id = ${args.connectionId} AND remote_deletion_pending_at IS NOT NULL RETURNING id`);
        return result.rows.length > 0;
    }
};
