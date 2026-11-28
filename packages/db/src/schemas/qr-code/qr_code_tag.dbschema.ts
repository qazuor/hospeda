import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { TagColorPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * QR-code tags (HOS-2679): the admin-only catalog an operator uses to organise
 * QR codes ("Verano 2026", "Costanera", "Folletería").
 *
 * A catalog with a join table (`r_qr_code_qr_code_tag`) rather than a `text[]`
 * column on `qr_codes`, by owner decision: a typed array lets "verano" and
 * "Verano " coexist as two tags, and renaming one means rewriting every row that
 * carries it. Here a rename is one row.
 *
 * These tags organise the PANEL only. They never reach a scan, a redirect or a
 * UTM parameter — campaign attribution is `utm_campaign` on the target URL.
 */
export const qrCodeTags = pgTable(
    'qr_code_tags',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** What the operator reads in the panel. */
        name: varchar('name', { length: 80 }).notNull(),

        /**
         * Derived from `name` by the service on every write, never typed by the
         * operator. It is the dedupe key: "Verano 2026" and "verano  2026" both
         * slug to `verano-2026`, so the second is refused instead of becoming a
         * near-duplicate tag.
         */
        slug: varchar('slug', { length: 80 }).notNull(),

        /** Badge colour. Optional: an uncoloured tag renders neutral. */
        color: TagColorPgEnum('color'),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * UNIQUE over LIVE rows only. Unlike a QR slug, a tag slug is printed
         * nowhere: once a tag is deleted, creating it again is a legitimate
         * request and must not collide with the tombstone.
         */
        qrCodeTags_slug_live_unique: uniqueIndex('qrCodeTags_slug_live_unique')
            .on(table.slug)
            .where(sql`deleted_at IS NULL`)
    })
);

export type InsertQrCodeTag = typeof qrCodeTags.$inferInsert;
export type SelectQrCodeTag = typeof qrCodeTags.$inferSelect;
