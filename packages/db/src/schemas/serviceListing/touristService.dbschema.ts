import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { users } from '../user/user.dbschema';
import { serviceListings } from './serviceListing.dbschema';

/**
 * TOURIST_SERVICE Schema - Etapa 2.11: Grupo Listados de Servicios
 * Tourist services offered by clients (tours, activities, experiences, etc.)
 */
export const touristServices = pgTable('tourist_services', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Client relationship (owner)
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Service information
    name: text('name').notNull(),
    category: text('category').notNull(), // e.g., 'tour', 'activity', 'experience', 'transport', 'guide'
    description: text('description'),

    // Service details (JSONB for flexibility)
    serviceDetails: jsonb('service_details').$type<{
        duration?: string; // e.g., '2 hours', '1 day', 'custom'
        maxParticipants?: number;
        minAge?: number;
        maxAge?: number;
        difficulty?: 'easy' | 'moderate' | 'hard';
        languages?: string[];
        included?: string[];
        excluded?: string[];
        requirements?: string[];
        meetingPoint?: string;
        pickupAvailable?: boolean;
        cancelationPolicy?: string;
        operatingDays?: string[]; // e.g., ['monday', 'tuesday']
        operatingHours?: string; // e.g., '09:00-18:00'
        seasonality?: {
            startMonth?: number;
            endMonth?: number;
        };
    }>(),

    // Contact and location
    contactInfo: text('contact_info'),
    location: text('location'),

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

export const touristServiceRelations = relations(touristServices, ({ one, many }) => ({
    // Client relationship
    client: one(clients, {
        fields: [touristServices.clientId],
        references: [clients.id],
        relationName: 'client_tourist_services'
    }),

    // Service listings for this service
    serviceListings: many(serviceListings, {
        relationName: 'tourist_service_listings'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [touristServices.createdById],
        references: [users.id],
        relationName: 'tourist_service_created_by'
    }),
    updatedBy: one(users, {
        fields: [touristServices.updatedById],
        references: [users.id],
        relationName: 'tourist_service_updated_by'
    }),
    deletedBy: one(users, {
        fields: [touristServices.deletedById],
        references: [users.id],
        relationName: 'tourist_service_deleted_by'
    })
}));

export type TouristService = typeof touristServices.$inferSelect;
export type NewTouristService = typeof touristServices.$inferInsert;
