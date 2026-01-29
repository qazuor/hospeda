import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import {
    PriceCurrencyPgEnum,
    SponsorshipTargetTypePgEnum,
    SponsorshipTierPgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

export const sponsorshipLevels: ReturnType<typeof pgTable> = pgTable(
    'sponsorship_levels',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        description: text('description'),
        targetType: SponsorshipTargetTypePgEnum('target_type').notNull(),
        tier: SponsorshipTierPgEnum('tier').notNull(),
        priceAmount: integer('price_amount').notNull(),
        priceCurrency: PriceCurrencyPgEnum('price_currency').notNull().default('ARS'),
        benefits: jsonb('benefits').$type<string[]>().notNull().default([]),
        sortOrder: integer('sort_order').notNull().default(0),
        isActive: boolean('is_active').notNull().default(true),
        // Audit fields
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        sponsorshipLevels_targetType_idx: index('sponsorshipLevels_targetType_idx').on(
            table.targetType
        ),
        sponsorshipLevels_tier_idx: index('sponsorshipLevels_tier_idx').on(table.tier),
        sponsorshipLevels_isActive_idx: index('sponsorshipLevels_isActive_idx').on(table.isActive),
        sponsorshipLevels_deletedAt_idx: index('sponsorshipLevels_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

export const sponsorshipLevelsRelations = relations(sponsorshipLevels, ({ one }) => ({
    createdBy: one(users, { fields: [sponsorshipLevels.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [sponsorshipLevels.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [sponsorshipLevels.deletedById], references: [users.id] })
}));
