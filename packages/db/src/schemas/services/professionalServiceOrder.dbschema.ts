import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pricingPlans } from '../catalog/pricingPlan.dbschema';
import { clients } from '../client/client.dbschema';
import { ServiceOrderStatusPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { professionalServiceTypes } from './professionalServiceType.dbschema';

/**
 * PROFESSIONAL_SERVICE_ORDER Schema - Etapa 2.8: Grupo Servicios Profesionales
 * Orders for professional services placed by clients
 */
export const professionalServiceOrders = pgTable('professional_service_orders', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),
    serviceTypeId: uuid('service_type_id')
        .notNull()
        .references(() => professionalServiceTypes.id, { onDelete: 'restrict' }),
    pricingPlanId: uuid('pricing_plan_id')
        .notNull()
        .references(() => pricingPlans.id, { onDelete: 'restrict' }),

    // Order info
    status: ServiceOrderStatusPgEnum('status').notNull(),
    orderedAt: timestamp('ordered_at', { withTimezone: true }).defaultNow().notNull(),
    deliveryDate: timestamp('delivery_date', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'), // Internal notes
    clientRequirements: text('client_requirements'), // Client specifications
    deliverables: jsonb('deliverables'), // Delivered items/results

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

export const professionalServiceOrderRelations = relations(
    professionalServiceOrders,
    ({ one }) => ({
        // Parent relations
        client: one(clients, {
            fields: [professionalServiceOrders.clientId],
            references: [clients.id]
        }),
        serviceType: one(professionalServiceTypes, {
            fields: [professionalServiceOrders.serviceTypeId],
            references: [professionalServiceTypes.id],
            relationName: 'service_orders_for_type'
        }),
        pricingPlan: one(pricingPlans, {
            fields: [professionalServiceOrders.pricingPlanId],
            references: [pricingPlans.id]
        }),

        // Audit relations
        createdBy: one(users, {
            fields: [professionalServiceOrders.createdById],
            references: [users.id],
            relationName: 'professional_service_order_created_by'
        }),
        updatedBy: one(users, {
            fields: [professionalServiceOrders.updatedById],
            references: [users.id],
            relationName: 'professional_service_order_updated_by'
        }),
        deletedBy: one(users, {
            fields: [professionalServiceOrders.deletedById],
            references: [users.id],
            relationName: 'professional_service_order_deleted_by'
        })
    })
);
