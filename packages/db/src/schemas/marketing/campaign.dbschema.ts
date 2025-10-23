import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { CampaignChannelPgEnum, CampaignStatusPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';

export const campaigns = pgTable('campaigns', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Campaign info
    name: text('name').notNull(),
    channel: CampaignChannelPgEnum('channel').notNull(),
    fromDate: timestamp('from_date', { withTimezone: true }),
    toDate: timestamp('to_date', { withTimezone: true }),
    status: CampaignStatusPgEnum('status').notNull(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Admin metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>()
});

export const campaignRelations = relations(campaigns, ({ one }) => ({
    // Parent relations
    client: one(clients, {
        fields: [campaigns.clientId],
        references: [clients.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [campaigns.createdById],
        references: [users.id],
        relationName: 'campaign_created_by'
    }),
    updatedBy: one(users, {
        fields: [campaigns.updatedById],
        references: [users.id],
        relationName: 'campaign_updated_by'
    }),
    deletedBy: one(users, {
        fields: [campaigns.deletedById],
        references: [users.id],
        relationName: 'campaign_deleted_by'
    })
}));
