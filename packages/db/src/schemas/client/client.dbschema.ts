import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodationListings } from '../accommodationListing/accommodationListing.dbschema';
import { benefitListings } from '../services/benefitListing.dbschema';
import { benefitPartners } from '../services/benefitPartner.dbschema';
import { users } from '../user/user.dbschema.ts';

export const clients = pgTable('clients', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    billingEmail: text('billing_email').notNull(),

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

export const clientRelations = relations(clients, ({ one, many }) => ({
    // User relation (nullable for organization support)
    user: one(users, {
        fields: [clients.userId],
        references: [users.id]
    }),

    // Benefit partners owned by this client
    benefitPartners: many(benefitPartners, {
        relationName: 'client_benefit_partners'
    }),

    // Benefit listings owned by this client
    benefitListings: many(benefitListings, {
        relationName: 'client_benefit_listings'
    }),

    // Accommodation listings owned by this client
    accommodationListings: many(accommodationListings, {
        relationName: 'client_accommodation_listings'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [clients.createdById],
        references: [users.id],
        relationName: 'client_created_by'
    }),

    updatedBy: one(users, {
        fields: [clients.updatedById],
        references: [users.id],
        relationName: 'client_updated_by'
    }),

    deletedBy: one(users, {
        fields: [clients.deletedById],
        references: [users.id],
        relationName: 'client_deleted_by'
    })
}));
