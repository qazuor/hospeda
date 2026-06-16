import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { destinations } from '../destination/destination.dbschema.ts';
import { HostTradeCategoryPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Host Trades table (SPEC-241)
 *
 * Admin-curated directory of local tradespeople / service providers that hosts
 * can consult when they need urgent help (plumber, electrician, locksmith, etc.).
 * One entry per provider per destination.
 */
export const hostTrades = pgTable(
    'host_trades',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        /** Service category (e.g. PLOMERIA, ELECTRICIDAD). Drives directory filtering. */
        category: HostTradeCategoryPgEnum('category').notNull(),
        /** Contact information (phone, WhatsApp, email, etc.) — free text. */
        contact: text('contact').notNull(),
        /** Benefit or discount for hosts listed in the directory. */
        benefit: text('benefit').notNull(),
        /** Geographic destination this trade entry belongs to. */
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'restrict' }),
        /** Whether the provider is available 24 hours a day. */
        is24h: boolean('is_24h').notNull().default(false),
        /** Human-readable schedule description (nullable — use is24h for 24h providers). */
        scheduleText: text('schedule_text'),
        /** Whether this entry is publicly visible in the host directory. */
        isActive: boolean('is_active').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        hostTrades_destinationId_idx: index('hostTrades_destinationId_idx').on(table.destinationId),
        hostTrades_category_idx: index('hostTrades_category_idx').on(table.category),
        hostTrades_isActive_idx: index('hostTrades_isActive_idx').on(table.isActive),
        hostTrades_destinationId_category_idx: index('hostTrades_destinationId_category_idx').on(
            table.destinationId,
            table.category
        )
    })
);

export const hostTradesRelations = relations(hostTrades, ({ one }) => ({
    destination: one(destinations, {
        fields: [hostTrades.destinationId],
        references: [destinations.id]
    }),
    createdBy: one(users, {
        fields: [hostTrades.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [hostTrades.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [hostTrades.deletedById],
        references: [users.id]
    })
}));

/** Drizzle-inferred SELECT type for host_trades rows. */
export type SelectHostTrade = typeof hostTrades.$inferSelect;

/** Drizzle-inferred INSERT type for host_trades rows. */
export type InsertHostTrade = typeof hostTrades.$inferInsert;
