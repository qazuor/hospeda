import type { AdminInfoType } from '@repo/schemas';
import { DiscountTypeEnum } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    bigint,
    decimal,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.js';
import { discountCodeUsages } from './discountCodeUsage.dbschema.js';
import { promotions } from './promotion.dbschema.js';

// Enum for discount type in database
export const discountTypeEnum = pgEnum('discount_type', [
    DiscountTypeEnum.PERCENTAGE,
    DiscountTypeEnum.FIXED_AMOUNT
]);

/**
 * DISCOUNT_CODE Schema - Etapa 2.5: Grupo Promociones y Descuentos
 * Códigos de descuento con tipos percentage vs fixed amount, límites de uso
 */
export const discountCodes = pgTable('discount_codes', {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Optional promotion relationship
    promotionId: uuid('promotion_id').references(() => promotions.id, { onDelete: 'set null' }),

    // Discount code identification
    code: text('code').notNull().unique(),

    // Discount type and amounts
    discountType: discountTypeEnum('discount_type').notNull(),
    percentOff: decimal('percent_off', { precision: 5, scale: 2 }), // null if fixed amount
    amountOffMinor: bigint('amount_off_minor', { mode: 'number' }), // null if percentage, in minor currency units (cents)

    // Validity period
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),

    // Usage limits
    maxRedemptionsGlobal: integer('max_redemptions_global'), // total limit across all users
    maxRedemptionsPerUser: integer('max_redemptions_per_user'), // limit per individual user
    usedCountGlobal: integer('used_count_global').notNull().default(0), // global usage counter

    // Currency for fixed amount discounts
    currency: text('currency').default('USD'),

    // Minimum purchase requirements
    minimumPurchaseAmount: decimal('minimum_purchase_amount', { precision: 10, scale: 2 }),
    minimumPurchaseCurrency: text('minimum_purchase_currency').default('USD'),

    // Discount constraints
    isActive: text('is_active').notNull().default('true'),
    description: text('description'),

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

export const discountCodeRelations = relations(discountCodes, ({ one, many }) => ({
    // Promotion relationship (optional)
    promotion: one(promotions, {
        fields: [discountCodes.promotionId],
        references: [promotions.id]
    }),

    // User relationships for audit
    createdBy: one(users, {
        fields: [discountCodes.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [discountCodes.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [discountCodes.deletedById],
        references: [users.id]
    }),

    // Related usage records
    usageRecords: many(discountCodeUsages)
}));

/**
 * Type inference from table schema
 */
export type DiscountCode = typeof discountCodes.$inferSelect;
export type InsertDiscountCode = typeof discountCodes.$inferInsert;
