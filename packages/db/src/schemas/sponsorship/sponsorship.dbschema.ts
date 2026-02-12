import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SponsorshipStatusPgEnum, SponsorshipTargetTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { sponsorshipLevels } from './sponsorship_level.dbschema.ts';
import { sponsorshipPackages } from './sponsorship_package.dbschema.ts';

/**
 * Analytics data stored as JSONB
 */
export interface SponsorshipAnalytics {
    impressions?: number;
    clicks?: number;
    couponsUsed?: number;
}

export const sponsorships = pgTable(
    'sponsorships',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        sponsorUserId: uuid('sponsor_user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        targetType: SponsorshipTargetTypePgEnum('target_type').notNull(),
        targetId: uuid('target_id').notNull(),
        levelId: uuid('level_id')
            .notNull()
            .references(() => sponsorshipLevels.id, { onDelete: 'restrict' }),
        packageId: uuid('package_id').references(() => sponsorshipPackages.id, {
            onDelete: 'set null'
        }),
        status: SponsorshipStatusPgEnum('status').notNull().default('pending'),
        startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        paymentId: text('payment_id'),
        logoUrl: text('logo_url'),
        linkUrl: text('link_url'),
        couponCode: text('coupon_code'),
        couponDiscountPercent: integer('coupon_discount_percent'),
        analytics: jsonb('analytics').$type<SponsorshipAnalytics>().default({}),
        // Audit fields
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        sponsorships_sponsorUserId_idx: index('sponsorships_sponsorUserId_idx').on(
            table.sponsorUserId
        ),
        sponsorships_targetType_idx: index('sponsorships_targetType_idx').on(table.targetType),
        sponsorships_targetId_idx: index('sponsorships_targetId_idx').on(table.targetId),
        sponsorships_status_idx: index('sponsorships_status_idx').on(table.status),
        sponsorships_startsAt_idx: index('sponsorships_startsAt_idx').on(table.startsAt),
        sponsorships_deletedAt_idx: index('sponsorships_deletedAt_idx').on(table.deletedAt),
        sponsorships_targetType_targetId_idx: index('sponsorships_targetType_targetId_idx').on(
            table.targetType,
            table.targetId
        )
    })
);

export const sponsorshipsRelations = relations(sponsorships, ({ one }) => ({
    sponsorUser: one(users, {
        fields: [sponsorships.sponsorUserId],
        references: [users.id]
    }),
    level: one(sponsorshipLevels, {
        fields: [sponsorships.levelId],
        references: [sponsorshipLevels.id]
    }),
    package: one(sponsorshipPackages, {
        fields: [sponsorships.packageId],
        references: [sponsorshipPackages.id]
    }),
    createdBy: one(users, { fields: [sponsorships.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [sponsorships.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [sponsorships.deletedById], references: [users.id] })
}));
