import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { SocialPlatformPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialPlatformFormats } from './social_platform_formats.dbschema.ts';

/**
 * Social platforms table.
 * One config row per platform (INSTAGRAM, FACEBOOK, X).
 * platform column is UNIQUE but NOT the PK — id UUID is the PK per spec.
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialPlatforms = pgTable(
    'social_platforms',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        platform: SocialPlatformPgEnum('platform').notNull(),
        label: text('label').notNull(),
        enabled: boolean('enabled').notNull().default(true),
        notes: text('notes'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialPlatforms_platform_idx: uniqueIndex('socialPlatforms_platform_idx').on(
            table.platform
        ),
        socialPlatforms_enabled_idx: index('socialPlatforms_enabled_idx').on(table.enabled),
        socialPlatforms_deletedAt_idx: index('socialPlatforms_deletedAt_idx').on(table.deletedAt)
    })
);

export const socialPlatformsRelations = relations(socialPlatforms, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialPlatforms.createdById],
        references: [users.id],
        relationName: 'socialPlatformCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialPlatforms.updatedById],
        references: [users.id],
        relationName: 'socialPlatformUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialPlatforms.deletedById],
        references: [users.id],
        relationName: 'socialPlatformDeletedBy'
    }),
    formats: many(socialPlatformFormats)
}));

export type InsertSocialPlatform = typeof socialPlatforms.$inferInsert;
export type SelectSocialPlatform = typeof socialPlatforms.$inferSelect;
