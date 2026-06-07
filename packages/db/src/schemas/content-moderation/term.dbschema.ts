import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    check,
    index,
    numeric,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Content moderation terms table (SPEC-195).
 *
 * Stores blocked words and domains used by the local moderation provider.
 * Each row represents a single term (word or domain) with its category,
 * severity weight, and enabled flag. The engine hot-path queries only
 * enabled, non-deleted rows.
 */
export const contentModerationTerms = pgTable(
    'content_moderation_terms',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        term: varchar('term', { length: 255 }).notNull(),
        kind: varchar('kind', { length: 16 }).notNull(),
        category: varchar('category', { length: 32 }).notNull(),
        severity: numeric('severity', { precision: 4, scale: 3, mode: 'number' })
            .notNull()
            .default(1.0),
        enabled: boolean('enabled').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (t) => ({
        kindTermUnique: uniqueIndex('uq_content_moderation_terms_kind_term')
            .on(t.kind, t.term)
            .where(sql`${t.deletedAt} IS NULL`),
        enabledIdx: index('idx_content_moderation_terms_enabled')
            .on(t.enabled)
            .where(sql`${t.deletedAt} IS NULL`),
        createdByIdx: index('idx_content_moderation_terms_created_by').on(t.createdById),
        kindCheck: check('ck_content_moderation_terms_kind', sql`${t.kind} IN ('word', 'domain')`),
        severityRangeCheck: check(
            'ck_content_moderation_terms_severity_range',
            sql`${t.severity} >= 0 AND ${t.severity} <= 1`
        )
    })
);

export const contentModerationTermsRelations = relations(contentModerationTerms, ({ one }) => ({
    createdBy: one(users, {
        fields: [contentModerationTerms.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [contentModerationTerms.updatedById],
        references: [users.id]
    })
}));

export type ContentModerationTerm = typeof contentModerationTerms.$inferSelect;
export type NewContentModerationTerm = typeof contentModerationTerms.$inferInsert;
