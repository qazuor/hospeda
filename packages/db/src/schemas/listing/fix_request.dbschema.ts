import { VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import {
    check,
    date,
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { quotedList } from '../vertical/quoted-list.ts';

/**
 * The verticals that own a listing table, which are the only values
 * `fix_request.entity_type` admits. The vertical IS the table (`V/02` §2.5):
 * `accommodation` → `accommodations`, `gastronomy` → `gastronomies`,
 * `experience` → `experiences`. Tourist and partner own no listing.
 */
export const FIX_REQUEST_ENTITY_TYPES = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;

/** One vertical that owns a listing table. */
export type FixRequestEntityType = (typeof FIX_REQUEST_ENTITY_TYPES)[number];

/**
 * `fix_request` — spec name `pedido_de_arreglo` (HOS-1478, V6.8a; `V/02` §2.5,
 * revisión del owner 2026-09-28, C10).
 *
 * An admin asks the owner to fix a listing without taking it down. It is a MARK,
 * not a state: it moves neither the listing's `publication_status` nor its
 * inactivity clock. It records the listing, the reason, an optional suggested
 * date, whether (and when) the owner reported the fix, who opened it and when,
 * and when and by whom it was closed.
 *
 * - At most ONE open request per listing: the partial unique index over the open
 *   rows (`closed_at IS NULL`).
 * - The listing is referenced by `(entity_type, entity_id)` because it can live
 *   in any of the three listing tables; `entity_type` is what the `G-R9` schema
 *   walk finds it by.
 * - Opened and closed by the admin moderation action (ACC:12); also closed, in
 *   the same act and without mail, when the listing reaches `PURGED` (`PB9`,
 *   `PB12`) — so `closed_by_id` stays NULL on that close. The owner's notice
 *   (`owner_reported_fixed_at`) is written by its own operation and does not
 *   close the request.
 * - Closed rows are kept as the record of the moderation; no soft delete.
 * - `updated_at` is maintained by the generic `set_updated_at` trigger
 *   (extras/002).
 */
export const fixRequests = pgTable(
    'fix_request',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Vertical of the listing, i.e. which listing table `entity_id` points into. */
        entityType: varchar('entity_type', { length: 32 }).$type<FixRequestEntityType>().notNull(),

        /** Id of the listing row in the table named by `entity_type`. */
        entityId: uuid('entity_id').notNull(),

        /** Spec «el motivo»: what the admin asks to fix. */
        reason: text('reason').notNull(),

        /** Spec «una fecha sugerida (anulable)»: the date the admin suggests. */
        suggestedDate: date('suggested_date', { mode: 'string' }),

        /**
         * Spec «si el dueño avisó que corrigió y cuándo»: NULL until the owner
         * reports the fix; the instant of the report afterwards.
         */
        ownerReportedFixedAt: timestamp('owner_reported_fixed_at', { withTimezone: true }),

        /** Spec «quién lo abrió»: the admin who opened the request. */
        openedById: uuid('opened_by_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        /** Spec «y cuándo»: the instant the request was opened. */
        openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),

        /** Spec «cuándo lo cerró»: NULL while the request is open. */
        closedAt: timestamp('closed_at', { withTimezone: true }),

        /**
         * Spec «quién lo cerró»: the admin who closed it. NULL while open, and also
         * when the close came from the listing reaching `PURGED`.
         */
        closedById: uuid('closed_by_id').references(() => users.id, { onDelete: 'restrict' }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** At most one open request per listing (partial unique index over the open rows). */
        fix_request_one_open_per_listing_uidx: uniqueIndex('fix_request_one_open_per_listing_uidx')
            .on(table.entityType, table.entityId)
            .where(sql`${table.closedAt} IS NULL`),

        /** Every request of a listing, open or closed. */
        fix_request_entity_idx: index('fix_request_entity_idx').on(
            table.entityType,
            table.entityId
        ),

        fix_request_entity_type_check: check(
            'fix_request_entity_type_check',
            sql`${table.entityType} IN (${quotedList(FIX_REQUEST_ENTITY_TYPES)})`
        ),

        /** A closer can only be recorded on a closed request. */
        fix_request_closed_by_requires_closed_at_check: check(
            'fix_request_closed_by_requires_closed_at_check',
            sql`${table.closedById} IS NULL OR ${table.closedAt} IS NOT NULL`
        )
    })
);

/** Insert shape of a `fix_request` row. */
export type InsertFixRequest = typeof fixRequests.$inferInsert;
/** Select shape of a `fix_request` row. */
export type SelectFixRequest = typeof fixRequests.$inferSelect;
