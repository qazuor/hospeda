import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { AmenitiesTypePgEnum, LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rAccommodationAmenity } from './r_accommodation_amenity.dbschema.ts';

export const amenities: ReturnType<typeof pgTable> = pgTable(
    'amenities',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        description: text('description'),
        icon: text('icon'),
        isBuiltin: boolean('is_builtin').notNull().default(false),
        isFeatured: boolean('is_featured').notNull().default(false),
        type: AmenitiesTypePgEnum('type').notNull(),
        lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        type_idx: index('type_idx').on(table.type),
        slug_idx: index('slug_idx').on(table.slug)
    })
);

export const amenitiesRelations = relations(amenities, ({ many }) => ({
    /**
     * All accommodation-amenity relations for this amenity (for catalog queries).
     */
    accommodationAmenities: many(rAccommodationAmenity)
}));
