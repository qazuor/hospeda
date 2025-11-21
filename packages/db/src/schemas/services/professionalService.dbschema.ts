import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { ProfessionalServiceCategoryPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';
import { professionalServiceOrders } from './professionalServiceOrder.dbschema';

/**
 * Default Pricing Type
 * Represents the pricing structure for a professional service
 */
export type DefaultPricingType = {
    basePrice: number;
    currency: string;
    billingUnit: 'hour' | 'day' | 'project' | 'month';
    minOrderValue?: number;
    maxOrderValue?: number;
};

/**
 * PROFESSIONAL_SERVICE Schema - P-001 Business Model
 * Professional services offered to accommodation hosts and clients
 */
export const professionalServices = pgTable('professional_services', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Basic service information
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull(),

    // Service categorization
    category: ProfessionalServiceCategoryPgEnum('category').notNull(),

    // Pricing information
    defaultPricing: jsonb('default_pricing').$type<DefaultPricingType>().notNull(),

    // Service availability and status
    isActive: boolean('is_active').default(true).notNull(),

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

export const professionalServiceRelations = relations(professionalServices, ({ many }) => ({
    // Child relations
    orders: many(professionalServiceOrders)
}));

export type ProfessionalServiceDbSchema = typeof professionalServices.$inferSelect;
export type ProfessionalServiceDbInsert = typeof professionalServices.$inferInsert;
