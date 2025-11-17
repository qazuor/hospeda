import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, ProductTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { pricingPlans } from './pricingPlan.dbschema.ts';

export const products = pgTable('products', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: ProductTypePgEnum('type').notNull(),
    description: text('description'),
    metadata: jsonb('metadata'),

    // Lifecycle state
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),

    // Status fields
    isActive: boolean('is_active').notNull().default(true),
    isDeleted: boolean('is_deleted').notNull().default(false),

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

export const productRelations = relations(products, ({ one, many }) => ({
    // Pricing plans relation
    pricingPlans: many(pricingPlans),

    // Audit relations
    createdBy: one(users, {
        fields: [products.createdById],
        references: [users.id],
        relationName: 'product_created_by'
    }),

    updatedBy: one(users, {
        fields: [products.updatedById],
        references: [users.id],
        relationName: 'product_updated_by'
    }),

    deletedBy: one(users, {
        fields: [products.deletedById],
        references: [users.id],
        relationName: 'product_deleted_by'
    })
}));
