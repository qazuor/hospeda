import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rAccommodationFeature } from './r_accommodation_feature.dbschema.ts';

export const features: ReturnType<typeof pgTable> = pgTable('features', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    is_featured: boolean('is_featured').notNull().default(false),
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const featuresRelations = relations(features, ({ many }) => ({
    /**
     * All accommodation-feature relations for this feature (for catalog queries).
     */
    accommodationFeatures: many(rAccommodationFeature)
}));
