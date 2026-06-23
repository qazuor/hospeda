import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social campaigns table.
 * Groups social posts under a named content campaign (e.g. "Institucional Hospeda").
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialCampaigns = pgTable(
    'social_campaigns',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        description: text('description'),
        active: boolean('active').notNull().default(true),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialCampaigns_slug_idx: index('socialCampaigns_slug_idx').on(table.slug),
        socialCampaigns_active_idx: index('socialCampaigns_active_idx').on(table.active),
        socialCampaigns_deletedAt_idx: index('socialCampaigns_deletedAt_idx').on(table.deletedAt)
    })
);

export const socialCampaignsRelations = relations(socialCampaigns, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialCampaigns.createdById],
        references: [users.id],
        relationName: 'socialCampaignCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialCampaigns.updatedById],
        references: [users.id],
        relationName: 'socialCampaignUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialCampaigns.deletedById],
        references: [users.id],
        relationName: 'socialCampaignDeletedBy'
    }),
    posts: many(socialPosts)
}));

export type InsertSocialCampaign = typeof socialCampaigns.$inferInsert;
export type SelectSocialCampaign = typeof socialCampaigns.$inferSelect;
