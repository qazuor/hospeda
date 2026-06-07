import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { LifecycleStatusPgEnum, OwnerPromotionDiscountTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

export const ownerPromotions = pgTable(
    'owner_promotions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        accommodationId: uuid('accommodation_id').references(() => accommodations.id, {
            onDelete: 'set null'
        }),
        title: text('title').notNull(),
        description: text('description'),
        discountType: OwnerPromotionDiscountTypePgEnum('discount_type').notNull(),
        discountValue: integer('discount_value').notNull(),
        minNights: integer('min_nights'),
        validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
        validUntil: timestamp('valid_until', { withTimezone: true }),
        maxRedemptions: integer('max_redemptions'),
        currentRedemptions: integer('current_redemptions').notNull().default(0),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        // SPEC-167: true when this promotion was restricted by the downgrade
        // remediation flow (host exceeded their new plan's MAX_ACTIVE_PROMOTIONS cap).
        // Separate from lifecycleState deactivation — a lifecycle flip loses the
        // 'restricted-by-plan' context needed for selective restore on re-upgrade.
        // Reversible: flipped back to false on re-upgrade or manual restore.
        planRestricted: boolean('plan_restricted').notNull().default(false),
        // Audit fields
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        ownerPromotions_ownerId_idx: index('ownerPromotions_ownerId_idx').on(table.ownerId),
        ownerPromotions_accommodationId_idx: index('ownerPromotions_accommodationId_idx').on(
            table.accommodationId
        ),
        ownerPromotions_lifecycleState_idx: index('ownerPromotions_lifecycleState_idx').on(
            table.lifecycleState
        ),
        ownerPromotions_validFrom_idx: index('ownerPromotions_validFrom_idx').on(table.validFrom),
        ownerPromotions_deletedAt_idx: index('ownerPromotions_deletedAt_idx').on(table.deletedAt),
        ownerPromotions_ownerId_lifecycleState_idx: index(
            'ownerPromotions_ownerId_lifecycleState_idx'
        ).on(table.ownerId, table.lifecycleState),
        ownerPromotions_planRestricted_idx: index('ownerPromotions_planRestricted_idx').on(
            table.planRestricted
        ),
        // SPEC-063-gaps T-015 (GAP-033): composite for the dominant query of the
        // hourly archive cron (archive-expired-promotions.job.ts filters on both
        // columns). Latent HIGH at 100k+ promotions.
        ownerPromotions_lifecycleState_validUntil_idx: index(
            'ownerPromotions_lifecycleState_validUntil_idx'
        ).on(table.lifecycleState, table.validUntil)
    })
);

export const ownerPromotionsRelations = relations(ownerPromotions, ({ one }) => ({
    owner: one(users, {
        fields: [ownerPromotions.ownerId],
        references: [users.id]
    }),
    accommodation: one(accommodations, {
        fields: [ownerPromotions.accommodationId],
        references: [accommodations.id]
    }),
    createdBy: one(users, { fields: [ownerPromotions.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [ownerPromotions.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [ownerPromotions.deletedById], references: [users.id] })
}));
