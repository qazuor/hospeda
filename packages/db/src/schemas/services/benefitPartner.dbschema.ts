import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { users } from '../user/user.dbschema';
import { benefitListings } from './benefitListing.dbschema';

/**
 * BENEFIT_PARTNER Schema - Etapa 2.10: Grupo Listados de Beneficios
 * Partner organizations that provide benefits to accommodation clients
 */
export const benefitPartners = pgTable('benefit_partners', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Partner information
    name: text('name').notNull(),
    category: text('category').notNull(), // e.g., 'restaurant', 'spa', 'tour', 'transport'
    description: text('description'),
    contactInfo: text('contact_info'),

    // Owner relationship - which client manages this partner
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

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

export const benefitPartnerRelations = relations(benefitPartners, ({ one, many }) => ({
    // Owner client
    client: one(clients, {
        fields: [benefitPartners.clientId],
        references: [clients.id],
        relationName: 'client_benefit_partners'
    }),

    // Benefit listings for this partner
    benefitListings: many(benefitListings, {
        relationName: 'partner_benefit_listings'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [benefitPartners.createdById],
        references: [users.id],
        relationName: 'benefit_partner_created_by'
    }),
    updatedBy: one(users, {
        fields: [benefitPartners.updatedById],
        references: [users.id],
        relationName: 'benefit_partner_updated_by'
    }),
    deletedBy: one(users, {
        fields: [benefitPartners.deletedById],
        references: [users.id],
        relationName: 'benefit_partner_deleted_by'
    })
}));

export type BenefitPartner = typeof benefitPartners.$inferSelect;
export type NewBenefitPartner = typeof benefitPartners.$inferInsert;
