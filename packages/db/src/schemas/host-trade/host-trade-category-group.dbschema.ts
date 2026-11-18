import type { AdminInfoType, I18nText, TranslationMeta } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { hostTradeCategories } from './host-trade-category.dbschema.ts';

/**
 * Host-trade category groups (HOS-919): the editable, admin-owned top level of
 * the two-level provider-trade catalog (group -> category).
 *
 * Mirrors the POI category precedent (HOS-139): rows carry their own
 * `nameI18n` content instead of resolving through `@repo/i18n`, so a content
 * operator can create or rename a group without a redeploy. `slug` is a
 * machine identifier only and is immutable after creation (enforced at the
 * schema/service layer).
 *
 * `slug` uniqueness is table-wide and INCLUDES soft-deleted rows, so a deleted
 * group keeps its slug reserved until restored.
 */
export const hostTradeCategoryGroups = pgTable(
    'host_trade_category_groups',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        nameI18n: jsonb('name_i18n').$type<I18nText>().notNull(),
        translationMeta: jsonb('translation_meta').$type<TranslationMeta>().default({}),
        /** Lower renders first; ties are broken by name. */
        displayWeight: integer('display_weight').notNull().default(50),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        hostTradeCategoryGroups_lifecycleState_idx: index(
            'hostTradeCategoryGroups_lifecycleState_idx'
        ).on(table.lifecycleState)
    })
);

export const hostTradeCategoryGroupsRelations = relations(hostTradeCategoryGroups, ({ many }) => ({
    categories: many(hostTradeCategories)
}));

/** Drizzle-inferred INSERT type for host_trade_category_groups rows. */
export type InsertHostTradeCategoryGroup = typeof hostTradeCategoryGroups.$inferInsert;

/** Drizzle-inferred SELECT type for host_trade_category_groups rows. */
export type SelectHostTradeCategoryGroup = typeof hostTradeCategoryGroups.$inferSelect;
