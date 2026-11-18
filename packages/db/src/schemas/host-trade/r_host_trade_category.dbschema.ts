import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { hostTrades } from './host_trade.dbschema.ts';
import { hostTradeCategories } from './host-trade-category.dbschema.ts';

/**
 * Host trade <-> category join table (M2M, HOS-919). A provider can hold
 * several categories; there is no "primary" one.
 *
 * Delete rules are asymmetric on purpose:
 * - `host_trade_id` is `CASCADE`: deleting a provider drops its links.
 * - `category_id` is `RESTRICT`: a category that is still linked cannot be
 *   hard-deleted. This is the DB-level backstop for the service rule that
 *   forbids deleting or deactivating a category in use.
 *
 * The composite PK already serves `host_trade_id` lookups, so only the reverse
 * `category_id` index (filter by category, "is this category in use") is
 * declared.
 */
export const rHostTradeCategory = pgTable(
    'r_host_trade_category',
    {
        hostTradeId: uuid('host_trade_id')
            .notNull()
            .references(() => hostTrades.id, { onDelete: 'cascade' }),
        categoryId: uuid('category_id')
            .notNull()
            .references(() => hostTradeCategories.id, { onDelete: 'restrict' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.hostTradeId, table.categoryId] }),
        categoryId_idx: index('r_host_trade_category_categoryId_idx').on(table.categoryId)
    })
);

export const rHostTradeCategoryRelations = relations(rHostTradeCategory, ({ one }) => ({
    hostTrade: one(hostTrades, {
        fields: [rHostTradeCategory.hostTradeId],
        references: [hostTrades.id]
    }),
    category: one(hostTradeCategories, {
        fields: [rHostTradeCategory.categoryId],
        references: [hostTradeCategories.id]
    })
}));

/** Drizzle-inferred INSERT type for r_host_trade_category rows. */
export type InsertRHostTradeCategory = typeof rHostTradeCategory.$inferInsert;

/** Drizzle-inferred SELECT type for r_host_trade_category rows. */
export type SelectRHostTradeCategory = typeof rHostTradeCategory.$inferSelect;
