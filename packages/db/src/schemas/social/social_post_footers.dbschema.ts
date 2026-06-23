import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SocialPlatformPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social post footers table.
 * Reusable footer templates appended to posts (e.g. "Reservá en hospeda.com.ar 🏡").
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialPostFooters = pgTable(
    'social_post_footers',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        /** Footer body text. May contain emoji and links. */
        content: text('content').notNull(),
        /** Optional platform restriction — null means applies to all platforms */
        platform: SocialPlatformPgEnum('platform'),
        active: boolean('active').notNull().default(true),
        isDefault: boolean('is_default').notNull().default(false),
        priority: integer('priority').notNull().default(0),
        notes: text('notes'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialPostFooters_slug_idx: index('socialPostFooters_slug_idx').on(table.slug),
        socialPostFooters_platform_idx: index('socialPostFooters_platform_idx').on(table.platform),
        socialPostFooters_active_idx: index('socialPostFooters_active_idx').on(table.active),
        socialPostFooters_deletedAt_idx: index('socialPostFooters_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

export const socialPostFootersRelations = relations(socialPostFooters, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialPostFooters.createdById],
        references: [users.id],
        relationName: 'socialPostFooterCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialPostFooters.updatedById],
        references: [users.id],
        relationName: 'socialPostFooterUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialPostFooters.deletedById],
        references: [users.id],
        relationName: 'socialPostFooterDeletedBy'
    }),
    posts: many(socialPosts)
}));

export type InsertSocialPostFooter = typeof socialPostFooters.$inferInsert;
export type SelectSocialPostFooter = typeof socialPostFooters.$inferSelect;
