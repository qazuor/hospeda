import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.js';

/**
 * PROMOTION Schema - Etapa 2.5: Grupo Promociones y Descuentos
 * Promociones generales con fecha de vigencia
 */
export const promotions = pgTable('promotions', {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Promotion identification
    name: text('name').notNull(),

    // Promotion rules and conditions
    rules: text('rules'),

    // Validity period
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

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

export const promotionRelations = relations(promotions, ({ one }) => ({
    // User relationships for audit
    createdBy: one(users, {
        fields: [promotions.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [promotions.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [promotions.deletedById],
        references: [users.id]
    })

    // Related discount codes (forward declaration)
    // discountCodes: many(discountCodes)
}));

/**
 * Type inference from table schema
 */
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = typeof promotions.$inferInsert;
