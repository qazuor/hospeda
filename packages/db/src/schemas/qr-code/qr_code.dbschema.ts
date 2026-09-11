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
import { EntityTypePgEnum, QrCodePurposePgEnum, QrCodeSourcePgEnum } from '../enums.dbschema.ts';
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

        /**
         * The entity this code was derived from, when `source = GENERATED`.
         *
         * The shared `EntityTypePgEnum`, not free text: this names a business
         * entity, so it follows the same rule as `entity_comment`,
         * `user_bookmark`, `r_entity_tag` and `entity_view`. Free `text` in this
         * repo is for infra logs. The concrete failure a varchar invites is that
         * the generator writes `'hostTrade'` while an operator types
         * `'host_trade'`, the `(entity_type, entity_id)` lookup below finds
         * nothing, a second slug is minted for the same subject, and — since a
         * slug is UNIQUE forever and already printed — two live codes end up
         * pointing at destinations free to diverge.
         */
        entityType: EntityTypePgEnum('entity_type'),
        entityId: uuid('entity_id'),

        /**
         * WHICH code this is, for a subject that carries more than one.
         *
         * `(entity_type, entity_id)` names the SUBJECT, and that was assumed to
         * identify a code until it did not. A restaurant has two physical codes
         * that coexist — one on the door for its listing, one on the table for
         * its menu — and an experience has its listing code plus the one on its
         * certificate, which today resolve to the SAME URL. Nothing about the
         * target tells those apart; what distinguishes them is where they are
         * printed, and knowing which one brings people in is the product.
         *
         * So this is the third part of the identity, not a label: uniqueness is
         * `(entity_type, entity_id, purpose)`, enforced by the partial index in
         * `extras/040-hos981-qr-code-entity-purpose.index.sql` — a partial index
         * is not expressible in Drizzle, hence the extras carril.
         *
         * ## NULLABLE, and why that is the design and not a convenience
         *
         * A `MANUAL` code is one an operator typed into the admin panel: it has
         * no system purpose, and inventing one for it would be a claim the
         * lookup could later trip over. Postgres never treats one `NULL` as
         * equal to another inside a UNIQUE index, so those rows fall OUTSIDE
         * the constraint for free — several may exist for one subject, which is
         * exactly right — with no separate `WHERE purpose IS NOT NULL` clause
         * needed to arrange it. Somebody will doubt this in six months: it is
         * the standard SQL rule, not a quirk of this index.
         */
        purpose: QrCodePurposePgEnum('purpose'),

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
