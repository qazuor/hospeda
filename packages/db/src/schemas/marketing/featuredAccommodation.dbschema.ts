import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema';
import { clients } from '../client/client.dbschema';
import { FeaturedStatusPgEnum, FeaturedTypePgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';

export const featuredAccommodations = pgTable('featured_accommodations', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),

    // Featured info
    featuredType: FeaturedTypePgEnum('featured_type').notNull(),
    fromDate: timestamp('from_date', { withTimezone: true }),
    toDate: timestamp('to_date', { withTimezone: true }),
    status: FeaturedStatusPgEnum('status').notNull(),

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

export const featuredAccommodationRelations = relations(featuredAccommodations, ({ one }) => ({
    // Parent relations
    client: one(clients, {
        fields: [featuredAccommodations.clientId],
        references: [clients.id]
    }),
    accommodation: one(accommodations, {
        fields: [featuredAccommodations.accommodationId],
        references: [accommodations.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [featuredAccommodations.createdById],
        references: [users.id],
        relationName: 'featured_accommodation_created_by'
    }),
    updatedBy: one(users, {
        fields: [featuredAccommodations.updatedById],
        references: [users.id],
        relationName: 'featured_accommodation_updated_by'
    }),
    deletedBy: one(users, {
        fields: [featuredAccommodations.deletedById],
        references: [users.id],
        relationName: 'featured_accommodation_deleted_by'
    })
}));
