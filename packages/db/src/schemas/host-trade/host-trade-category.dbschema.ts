import type {
    AdminInfoType,
    HostTradeCategoryKeywords,
    I18nText,
    TranslationMeta
} from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { hostTradeCategoryGroups } from './host-trade-category-group.dbschema.ts';
import { rHostTradeCategory } from './r_host_trade_category.dbschema.ts';

/**
 * Host-trade categories (HOS-919): the editable, admin-owned second level of
 * the provider-trade catalog. Each category belongs to exactly one group and a
 * provider can hold several categories through `r_host_trade_category`.
 *
 * Like the POI categories (HOS-139), rows carry their own `nameI18n` plus
 * `keywordsI18n` (extra words the selector search matches by). `slug` is a
 * machine identifier, immutable after creation, and unique table-wide
 * INCLUDING soft-deleted rows.
 *
 * `group_id` is `ON DELETE RESTRICT`: a group that still has categories
 * cannot be hard-deleted.
 */
export const hostTradeCategories = pgTable(
    'host_trade_categories',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        groupId: uuid('group_id')
            .notNull()
            .references(() => hostTradeCategoryGroups.id, { onDelete: 'restrict' }),
        nameI18n: jsonb('name_i18n').$type<I18nText>().notNull(),
        /** Related search words per locale (all lowercase, bounded list). */
        keywordsI18n: jsonb('keywords_i18n').$type<HostTradeCategoryKeywords>().default({}),
        translationMeta: jsonb('translation_meta').$type<TranslationMeta>().default({}),
        /** Lower renders first inside its group; ties are broken by name. */
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
        hostTradeCategories_groupId_idx: index('hostTradeCategories_groupId_idx').on(table.groupId),
        hostTradeCategories_lifecycleState_idx: index('hostTradeCategories_lifecycleState_idx').on(
            table.lifecycleState
        )
    })
);

export const hostTradeCategoriesRelations = relations(hostTradeCategories, ({ one, many }) => ({
    group: one(hostTradeCategoryGroups, {
        fields: [hostTradeCategories.groupId],
        references: [hostTradeCategoryGroups.id]
    }),
    hostTrades: many(rHostTradeCategory)
}));

/** Drizzle-inferred INSERT type for host_trade_categories rows. */
export type InsertHostTradeCategory = typeof hostTradeCategories.$inferInsert;

/** Drizzle-inferred SELECT type for host_trade_categories rows. */
export type SelectHostTradeCategory = typeof hostTradeCategories.$inferSelect;
