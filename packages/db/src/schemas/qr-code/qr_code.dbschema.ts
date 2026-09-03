import type { QrCodeRenderOptions } from '@repo/schemas';
import {
    boolean,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { QrCodeSourcePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * QR codes (HOS-981).
 *
 * A printed QR encodes a URL carrying {@link qrCodes.slug}, and the platform
 * answers that URL with a redirect to {@link qrCodes.targetUrl}. The entire
 * point of the indirection is that `targetUrl` is editable: a sticker on a
 * counter, a code on a brochure and a code silkscreened on a sign can all be
 * repointed years later without reprinting anything.
 *
 * Consequently `slug` is immutable in practice — it is the half that is already
 * out in the world on paper — and the schemas layer refuses it on update.
 */
export const qrCodes = pgTable(
    'qr_codes',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * The identifier inside the printed URL. UNIQUE, and drawn from an
         * alphabet with no ambiguous characters (`generateShortId` in
         * `@repo/utils`) because a person sometimes types this off a sticker.
         */
        slug: varchar('slug', { length: 64 }).notNull(),

        /** Where a scan is sent. The editable half. */
        targetUrl: text('target_url').notNull(),

        /** Human name, so an operator can find this code in the panel next year. */
        label: varchar('label', { length: 200 }).notNull(),

        description: text('description'),

        /** MANUAL (an operator made it) vs GENERATED (the platform did, for an entity). */
        source: QrCodeSourcePgEnum('source').notNull(),

        /** The entity this code was derived from, when `source = GENERATED`. */
        entityType: varchar('entity_type', { length: 100 }),
        entityId: uuid('entity_id'),

        /**
         * Render configuration, as one document.
         *
         * `jsonb` rather than a spread of typed columns on purpose: this
         * configuration is expected to grow — a centre logo lands with the admin
         * panel that configures it — and a document absorbs that growth without
         * a second migration over a table that by then holds production rows.
         */
        renderOptions: jsonb('render_options').$type<QrCodeRenderOptions>().notNull(),

        /**
         * Retiring a code without deleting it. A retired code stops redirecting
         * but keeps every scan already recorded against it.
         */
        isActive: boolean('is_active').notNull().default(true),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * UNIQUE over the whole table, soft-deleted rows included. A slug that
         * was printed once must never be reissued to a different target, or a
         * sticker already in the field silently starts pointing somewhere else.
         */
        qrCodes_slug_unique: uniqueIndex('qrCodes_slug_unique').on(table.slug),
        qrCodes_entity_idx: index('qrCodes_entity_idx').on(table.entityType, table.entityId),
        qrCodes_isActive_idx: index('qrCodes_isActive_idx').on(table.isActive)
    })
);

export type InsertQrCode = typeof qrCodes.$inferInsert;
export type SelectQrCode = typeof qrCodes.$inferSelect;
