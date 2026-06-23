import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SocialAssetSourcePgEnum, SocialMediaTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialPostMedia } from './social_post_media.dbschema.ts';

/**
 * Social assets table.
 * Cloudinary-hosted media assets referenced by social posts.
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialAssets = pgTable(
    'social_assets',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        source: SocialAssetSourcePgEnum('source').notNull(),
        /** Cloudinary delivery URL. Nullable when upload failed or is pending. */
        cloudinaryUrl: text('cloudinary_url'),
        /** Cloudinary public_id for transforms and deletion. Nullable when upload failed. */
        cloudinaryPublicId: text('cloudinary_public_id'),
        /** Original source URL before upload (OpenAI file URL, external URL, etc.) */
        originalUrl: text('original_url'),
        /** OpenAI file reference string (e.g. "file-abc123") when source is CHATGPT_FILE */
        openaiFileRef: text('openai_file_ref'),
        mimeType: text('mime_type'),
        mediaType: SocialMediaTypePgEnum('media_type').notNull(),
        /** Width in pixels. Null when not yet available (pending upload). */
        width: integer('width'),
        /** Height in pixels. Null when not yet available (pending upload). */
        height: integer('height'),
        /** Duration in seconds for video assets. Null for images. */
        durationSeconds: integer('duration_seconds'),
        altText: text('alt_text'),
        caption: text('caption'),
        metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialAssets_source_idx: index('socialAssets_source_idx').on(table.source),
        socialAssets_mediaType_idx: index('socialAssets_mediaType_idx').on(table.mediaType),
        socialAssets_cloudinaryPublicId_idx: index('socialAssets_cloudinaryPublicId_idx').on(
            table.cloudinaryPublicId
        ),
        socialAssets_deletedAt_idx: index('socialAssets_deletedAt_idx').on(table.deletedAt)
    })
);

export const socialAssetsRelations = relations(socialAssets, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialAssets.createdById],
        references: [users.id],
        relationName: 'socialAssetCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialAssets.updatedById],
        references: [users.id],
        relationName: 'socialAssetUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialAssets.deletedById],
        references: [users.id],
        relationName: 'socialAssetDeletedBy'
    }),
    postMedia: many(socialPostMedia)
}));

export type InsertSocialAsset = typeof socialAssets.$inferInsert;
export type SelectSocialAsset = typeof socialAssets.$inferSelect;
