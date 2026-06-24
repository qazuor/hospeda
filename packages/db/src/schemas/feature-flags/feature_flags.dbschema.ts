import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const featureFlags = pgTable('feature_flags', {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    description: varchar('description', { length: 2000 }).notNull().default(''),
    enabled: boolean('enabled').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    forceOnUserIds: uuid('force_on_user_ids').array().notNull().default([]),
    forceOffUserIds: uuid('force_off_user_ids').array().notNull().default([]),
    enabledForRoles: text('enabled_for_roles').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdById: uuid('created_by_id'),
    updatedById: uuid('updated_by_id')
});

export type InsertFeatureFlag = typeof featureFlags.$inferInsert;
export type SelectFeatureFlag = typeof featureFlags.$inferSelect;

export const featureFlagAuditLog = pgTable('feature_flag_audit_log', {
    id: uuid('id').defaultRandom().primaryKey(),
    flagId: uuid('flag_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    previousValue: jsonb('previous_value').$type<Record<string, unknown> | null>(),
    newValue: jsonb('new_value').$type<Record<string, unknown> | null>(),
    reason: varchar('reason', { length: 500 }),
    performedById: uuid('performed_by_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type InsertFeatureFlagAuditLog = typeof featureFlagAuditLog.$inferInsert;
export type SelectFeatureFlagAuditLog = typeof featureFlagAuditLog.$inferSelect;
