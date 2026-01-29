import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PriceCurrencyPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { sponsorshipLevels } from './sponsorship_level.dbschema.ts';

export const sponsorshipPackages: ReturnType<typeof pgTable> = pgTable(
    'sponsorship_packages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        description: text('description'),
        priceAmount: integer('price_amount').notNull(),
        priceCurrency: PriceCurrencyPgEnum('price_currency').notNull().default('ARS'),
        includedPosts: integer('included_posts').notNull(),
        includedEvents: integer('included_events').notNull(),
        eventLevelId: uuid('event_level_id').references(() => sponsorshipLevels.id, {
            onDelete: 'set null'
        }),
        isActive: boolean('is_active').notNull().default(true),
        sortOrder: integer('sort_order').notNull().default(0),
        // Audit fields
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        sponsorshipPackages_isActive_idx: index('sponsorshipPackages_isActive_idx').on(
            table.isActive
        ),
        sponsorshipPackages_deletedAt_idx: index('sponsorshipPackages_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

export const sponsorshipPackagesRelations = relations(sponsorshipPackages, ({ one }) => ({
    eventLevel: one(sponsorshipLevels, {
        fields: [sponsorshipPackages.eventLevelId],
        references: [sponsorshipLevels.id]
    }),
    createdBy: one(users, { fields: [sponsorshipPackages.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [sponsorshipPackages.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [sponsorshipPackages.deletedById], references: [users.id] })
}));
