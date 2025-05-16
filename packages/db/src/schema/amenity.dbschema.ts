import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodationAmenities } from './accommodation_amenity.dbschema';
import { AmenitiesTypePgEnum, StatePgEnum } from './enums.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * amenities table schema
 */
export const amenities = pgTable('amenities', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // Internal unique name
    displayName: text('display_name').notNull(), // Name for display
    description: text('description'),
    icon: text('icon'), // Icon identifier or URL
    isBuiltin: boolean('is_builtin').notNull(), // Is this a system-defined amenity?
    type: AmenitiesTypePgEnum('type').notNull(), // e.g., CLIMATE_CONTROL, CONNECTIVITY
    state: StatePgEnum('state').default('ACTIVE').notNull(), // ACTIVE, INACTIVE, etc.
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(), // JSON for admin notes, etc.

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

/**
 * Relations for amenities table
 */
export const amenitiesRelations = relations(amenities, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [amenities.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [amenities.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [amenities.deletedById],
        references: [users.id]
    }),
    accommodationAmenities: many(accommodationAmenities),
    tags: many(entityTagRelations)
}));
