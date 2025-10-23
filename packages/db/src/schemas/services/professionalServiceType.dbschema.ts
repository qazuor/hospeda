import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ProfessionalServiceCategoryPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';
import { professionalServiceOrders } from './professionalServiceOrder.dbschema';

/**
 * PROFESSIONAL_SERVICE_TYPE Schema - Etapa 2.8: Grupo Servicios Profesionales
 * Types of professional services that can be offered to clients
 */
export const professionalServiceTypes = pgTable('professional_service_types', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Service type info
    name: text('name').notNull(),
    category: ProfessionalServiceCategoryPgEnum('category').notNull(),
    description: text('description'),
    defaultPricing: jsonb('default_pricing'), // Default pricing structure
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

export const professionalServiceTypeRelations = relations(
    professionalServiceTypes,
    ({ one, many }) => ({
        // Service orders for this service type
        serviceOrders: many(professionalServiceOrders, {
            relationName: 'service_orders_for_type'
        }),

        // Audit relations
        createdBy: one(users, {
            fields: [professionalServiceTypes.createdById],
            references: [users.id],
            relationName: 'professional_service_type_created_by'
        }),
        updatedBy: one(users, {
            fields: [professionalServiceTypes.updatedById],
            references: [users.id],
            relationName: 'professional_service_type_updated_by'
        }),
        deletedBy: one(users, {
            fields: [professionalServiceTypes.deletedById],
            references: [users.id],
            relationName: 'professional_service_type_deleted_by'
        })
    })
);
