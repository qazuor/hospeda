import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PartnerMentionChannelPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { partners } from './partner.dbschema.js';

/**
 * Log of manual promotion actions the Hospeda team performed for a partner (HOS-377).
 *
 * Half of what a partner pays for happens off-platform — a mention on Instagram, an
 * inclusion in the newsletter, a WhatsApp campaign — on services Hospeda does not
 * control and cannot query. This table is the record that those actions happened,
 * so the partner can be shown a verifiable history instead of being asked to trust
 * that ops followed through.
 *
 * It is deliberately a LOG OF FACTS, not an analytics table. There is no reach,
 * impression or click column and there must never be one: that data lives on
 * Instagram and in the email provider, and the owner explicitly rejected
 * integrating those APIs. The dead `partners.analytics` jsonb column is the earlier,
 * abandoned attempt at exactly that shape — do not resurrect it or build on it.
 *
 * ## Why `channel` is singular, and why that is not a limitation
 *
 * A campaign usually runs across several networks at once, and the admin logs all of
 * them in ONE submission. That does NOT make this row multi-channel: each network is
 * a separate publication with a separate {@link url}, and the whole value of the log
 * is the partner being able to open each link and verify it. A `channel[]` column
 * would need a positionally-synced `url[]` beside it — the same unbounded-blob
 * anti-pattern that made `partners.analytics` useless, one level down.
 *
 * So the multi-channel submission writes N rows sharing one {@link batchId}, inside a
 * single transaction. The batching lives in the form and the service, never here.
 *
 * ## Why standard audit columns, unlike `social_publish_logs`
 *
 * `social_publish_logs` is append-only with no soft delete because it records an
 * automated dispatch pipeline: nothing types into it, so nothing mistypes. These rows
 * are entered by a human at the moment they perform the action, who will eventually
 * paste the wrong link or pick the wrong date. This table therefore follows
 * `partners`'s own convention — soft delete plus author columns — and its rows are
 * editable. The column SHAPE is borrowed from `social_publish_logs`; the immutability
 * is not.
 */
export const partnerMentions = pgTable(
    'partner_mentions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The partner this mention promoted. Cascades: a deleted partner's log goes with it. */
        partnerId: uuid('partner_id')
            .notNull()
            .references(() => partners.id, { onDelete: 'cascade' }),
        /**
         * Where the mention happened, from a closed list.
         *
         * Closed rather than free text because the whole point is to group and count
         * by channel and give each one an icon — with free text "Instagram", "IG" and
         * "instagram" are three channels and nothing aggregates. Adding one is a value
         * on `PartnerMentionChannelEnum` plus a matching pg enum value.
         */
        channel: PartnerMentionChannelPgEnum('channel').notNull(),
        /**
         * Groups the rows written by ONE admin submission — a single campaign run
         * across several networks. NULL when the mention was logged on its own.
         *
         * Intentionally NOT a foreign key: there is no batch entity to point at, only
         * a shared identifier. It is generated server-side inside the creating
         * transaction and never accepted from the client — a caller-supplied value
         * could file one partner's mention into another partner's batch, and the
         * partner-facing view groups by exactly this column.
         *
         * Load-bearing for two things beyond display: the partner-facing log renders a
         * batch as one entry rather than N entries sharing a date, and the
         * notification fires once per batch instead of once per row (four emails for
         * one campaign is how a sender gets marked as spam).
         *
         * It must exist from the first migration or never: which rows were logged
         * together is not derivable after the fact, so no backfill can reconstruct it.
         */
        batchId: uuid('batch_id'),
        /**
         * When the promotion actually happened — distinct from {@link createdAt}, which
         * is when an admin got around to logging it. They differ whenever a mention is
         * entered after the fact, and the partner-facing log is ordered by THIS one.
         */
        mentionedAt: timestamp('mentioned_at', { withTimezone: true }).notNull(),
        /**
         * Link to the publication, so the partner can go verify it.
         *
         * Nullable at the DB level, but NOT optional in general: the Zod entry schema
         * requires it for every channel that produces a public permalink and allows it
         * absent only for `WHATSAPP` (a broadcast to a list has no public URL) and
         * `OTHER`. The rule lives there rather than in a CHECK constraint because a
         * CHECK encoding the per-channel logic would have to be rewritten every time a
         * channel is added — see `requiresMentionUrl` in `@repo/schemas`.
         */
        url: text('url'),
        /**
         * Admin-only context ("agreed with the owner", "part of the spring campaign").
         *
         * Never rendered to the partner and never present in a partner-facing response
         * payload — stripped at the endpoint, not merely hidden in the UI.
         */
        internalNote: text('internal_note'),
        // Audit fields — matching `partners`, deliberately not `social_publish_logs`.
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        // The primary access pattern, for both the admin section and the partner's own
        // log: "this partner's mentions, newest first".
        partnerMentions_partnerId_mentionedAt_idx: index(
            'partnerMentions_partnerId_mentionedAt_idx'
        ).on(table.partnerId, table.mentionedAt.desc()),
        // Drives batch grouping on the read path and the once-per-batch notification.
        partnerMentions_batchId_idx: index('partnerMentions_batchId_idx').on(table.batchId),
        // Soft-delete filtering scoped to one partner, which is how every list query runs.
        partnerMentions_partnerId_deletedAt_idx: index(
            'partnerMentions_partnerId_deletedAt_idx'
        ).on(table.partnerId, table.deletedAt)
    })
);

export const partnerMentionsRelations = relations(partnerMentions, ({ one }) => ({
    partner: one(partners, {
        fields: [partnerMentions.partnerId],
        references: [partners.id]
    }),
    createdBy: one(users, { fields: [partnerMentions.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [partnerMentions.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [partnerMentions.deletedById], references: [users.id] })
}));

/** Type-inferred insert type for partner_mentions rows. */
export type InsertPartnerMention = typeof partnerMentions.$inferInsert;
/** Type-inferred select type for partner_mentions rows. */
export type SelectPartnerMention = typeof partnerMentions.$inferSelect;
