import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { CampaignChannelPgEnum, CampaignStatusPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { adMediaAssets } from './adMediaAsset.dbschema';
import { adSlotReservations } from './adSlotReservation.dbschema';

/**
 * CAMPAIGN Schema - Fase 2.6: Grupo Campañas y Publicidad
 * Marketing campaigns created by clients for web and social channels
 */
export const campaignsFase26 = pgTable('campaigns', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Client relationship
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Campaign details
    name: text('name').notNull(),
    channel: CampaignChannelPgEnum('channel').notNull(), // WEB, SOCIAL

    // Campaign dates
    fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
    toDate: timestamp('to_date', { withTimezone: true }).notNull(),

    // Campaign status
    status: CampaignStatusPgEnum('status').notNull().default('DRAFT'), // DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED

    // Administrative metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id')
        .notNull()
        .references(() => users.id),
    updatedById: uuid('updated_by_id')
        .notNull()
        .references(() => users.id),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id)
});

export const campaignFase26Relations = relations(campaignsFase26, ({ one, many }) => ({
    // Client relationship
    client: one(clients, {
        fields: [campaignsFase26.clientId],
        references: [clients.id],
        relationName: 'client_campaigns_fase26'
    }),

    // Media assets relationship
    mediaAssets: many(adMediaAssets, {
        relationName: 'campaign_media_assets_fase26'
    }),

    // Slot reservations relationship
    slotReservations: many(adSlotReservations, {
        relationName: 'campaign_slot_reservations_fase26'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [campaignsFase26.createdById],
        references: [users.id],
        relationName: 'campaign_fase26_created_by'
    }),
    updatedBy: one(users, {
        fields: [campaignsFase26.updatedById],
        references: [users.id],
        relationName: 'campaign_fase26_updated_by'
    }),
    deletedBy: one(users, {
        fields: [campaignsFase26.deletedById],
        references: [users.id],
        relationName: 'campaign_fase26_deleted_by'
    })
}));

export type CampaignFase26 = typeof campaignsFase26.$inferSelect;
export type NewCampaignFase26 = typeof campaignsFase26.$inferInsert;
