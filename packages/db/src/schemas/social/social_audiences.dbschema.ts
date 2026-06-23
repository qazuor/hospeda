import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { socialHashtags } from './social_hashtags.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social audiences table.
 * Named target audience descriptors (e.g. "Turistas", "Familias con niños").
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialAudiences = pgTable(
    'social_audiences',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        description: text('description'),
        active: boolean('active').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialAudiences_slug_idx: index('socialAudiences_slug_idx').on(table.slug),
        socialAudiences_active_idx: index('socialAudiences_active_idx').on(table.active),
        socialAudiences_deletedAt_idx: index('socialAudiences_deletedAt_idx').on(table.deletedAt)
    })
);

export const socialAudiencesRelations = relations(socialAudiences, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialAudiences.createdById],
        references: [users.id],
        relationName: 'socialAudienceCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialAudiences.updatedById],
        references: [users.id],
        relationName: 'socialAudienceUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialAudiences.deletedById],
        references: [users.id],
        relationName: 'socialAudienceDeletedBy'
    }),
    hashtags: many(socialHashtags),
    posts: many(socialPosts)
}));

export type InsertSocialAudience = typeof socialAudiences.$inferInsert;
export type SelectSocialAudience = typeof socialAudiences.$inferSelect;
