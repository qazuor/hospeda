import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { MediaAssetTypePgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { campaignsFase26 } from './campaignFase26.dbschema';

/**
 * AD_MEDIA_ASSET Schema - Fase 2.6: Grupo Campañas y Publicidad
 * Media assets (images, HTML, videos) used in advertising campaigns
 */
export const adMediaAssets = pgTable('ad_media_assets', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Campaign relationship
    campaignId: uuid('campaign_id')
        .notNull()
        .references(() => campaignsFase26.id, { onDelete: 'cascade' }),

    // Asset details
    type: MediaAssetTypePgEnum('type').notNull(), // IMAGE, HTML, VIDEO
    url: text('url').notNull(),

    // Asset specifications (JSONB for flexibility)
    specs: jsonb('specs').$type<{
        width?: number;
        height?: number;
        fileSize?: number;
        duration?: number; // for videos
        format?: string;
        alt?: string; // for images
        title?: string;
        description?: string;
    }>(),

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

export const adMediaAssetRelations = relations(adMediaAssets, ({ one }) => ({
    // Campaign relationship
    campaign: one(campaignsFase26, {
        fields: [adMediaAssets.campaignId],
        references: [campaignsFase26.id],
        relationName: 'campaign_media_assets_fase26'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [adMediaAssets.createdById],
        references: [users.id],
        relationName: 'ad_media_asset_created_by'
    }),
    updatedBy: one(users, {
        fields: [adMediaAssets.updatedById],
        references: [users.id],
        relationName: 'ad_media_asset_updated_by'
    }),
    deletedBy: one(users, {
        fields: [adMediaAssets.deletedById],
        references: [users.id],
        relationName: 'ad_media_asset_deleted_by'
    })
}));

export type AdMediaAsset = typeof adMediaAssets.$inferSelect;
export type NewAdMediaAsset = typeof adMediaAssets.$inferInsert;
