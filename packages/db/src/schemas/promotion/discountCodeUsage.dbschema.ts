import { relations, sql } from 'drizzle-orm';
import { integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { users } from '../user/user.dbschema';
import { discountCodes } from './discountCode.dbschema';

/**
 * DISCOUNT_CODE_USAGE
 *
 * Tabla de seguimiento de uso de códigos de descuento por cliente.
 * Permite limitar usos globales y por usuario según las reglas de negocio.
 *
 * Relaciones:
 * - FK a DISCOUNT_CODE: código utilizado
 * - FK a CLIENT: cliente que utilizó el código
 */
export const discountCodeUsages = pgTable('discount_code_usage', {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign keys
    discountCodeId: uuid('discount_code_id')
        .notNull()
        .references(() => discountCodes.id, { onDelete: 'cascade' }),

    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Usage tracking fields
    usageCount: integer('usage_count').notNull().default(1), // Número de veces usado por este cliente

    // Timestamps
    firstUsedAt: timestamp('first_used_at', { withTimezone: true })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),

    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),

    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Admin metadata
    createdById: uuid('created_by_id').references(() => users.id),
    updatedById: uuid('updated_by_id').references(() => users.id),
    deletedById: uuid('deleted_by_id').references(() => users.id)
});

export const discountCodeUsageRelations = relations(discountCodeUsages, ({ one }) => ({
    // Discount code relationship
    discountCode: one(discountCodes, {
        fields: [discountCodeUsages.discountCodeId],
        references: [discountCodes.id]
    }),

    // Client relationship
    client: one(clients, {
        fields: [discountCodeUsages.clientId],
        references: [clients.id]
    }),

    // User relationships for audit
    createdBy: one(users, {
        fields: [discountCodeUsages.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [discountCodeUsages.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [discountCodeUsages.deletedById],
        references: [users.id]
    })
}));

/**
 * Type inference from table schema
 */
export type DiscountCodeUsage = typeof discountCodeUsages.$inferSelect;
export type InsertDiscountCodeUsage = typeof discountCodeUsages.$inferInsert;
