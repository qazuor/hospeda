import { relations, sql } from 'drizzle-orm';
import {
    check,
    index,
    integer,
    pgTable,
    smallint,
    text,
    time,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import {
    LifecycleStatusPgEnum,
    OwnerPromotionDiscountTypePgEnum,
    OwnerPromotionEntityTypePgEnum,
    TouristAudiencePgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Owner promotions: a benefit an owner offers on one of their listings.
 *
 * ## Where a promotion hangs (HOS-2270, release N of an expand/contract)
 *
 * The target is the pair `entity_type` + `entity_id`, with no foreign key because
 * the target is polymorphic. The semantics, which EVERY reader must apply:
 *
 * - `entity_type = 'accommodation'` with `entity_id`: promotion of that accommodation.
 * - `entity_type = 'accommodation'` with `entity_id IS NULL`: promotion of ALL the
 *   owner's accommodations (D-4 of SPEC-285).
 * - `entity_type = 'venue'`: promotion of that venue. `entity_id` is mandatory
 *   (CHECK `owner_promotions_venue_requires_entity_check`); there is no "all
 *   venues" promotion.
 *
 * A reader that scopes by `accommodation_id IS NULL` reads a venue promotion as an
 * owner-wide accommodation one: always filter by `entity_type` first.
 *
 * Without a foreign key nothing deletes a promotion when its listing goes away, so
 * the service validates `entity_id` on create and the listing purge deletes the
 * promotions by `(entity_type, entity_id)`.
 *
 * `accommodation_id` is the legacy column. It stays, with its FK and index, until
 * the release N+1 (contract) drops it; every accommodation write fills both pairs so
 * a rollback of the code to the previous release keeps working.
 */
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
        // HOS-2270: the polymorphic target. Existing rows default to 'accommodation'.
        entityType: OwnerPromotionEntityTypePgEnum('entity_type')
            .notNull()
            .default('accommodation'),
        entityId: uuid('entity_id'),
        title: text('title').notNull(),
        description: text('description'),
        discountType: OwnerPromotionDiscountTypePgEnum('discount_type').notNull(),
        discountValue: integer('discount_value').notNull(),
        minNights: integer('min_nights'),
        validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
        validUntil: timestamp('valid_until', { withTimezone: true }),
        windowWeekdays: smallint('window_weekdays').array(),
        windowStart: time('window_start', { precision: 0 }),
        windowEnd: time('window_end', { precision: 0 }),
        maxRedemptions: integer('max_redemptions'),
        currentRedemptions: integer('current_redemptions').notNull().default(0),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        // HOS-21 D1: which tourist tier can see this promotion. Additive —
        // 'vip' tourists see 'plus' + 'vip' rows, 'plus' tourists see 'plus'
        // only.
        touristAudience: TouristAudiencePgEnum('tourist_audience').notNull().default('plus'),
        // HOS-2589 §7.7: when the promotion FIRST became ACTIVE. Written once by the
        // service, never on later edits, so the weekly VIP digest can tell a new
        // promotion from an edited one. Null for a promotion that never went live.
        firstActivatedAt: timestamp('first_activated_at', { withTimezone: true }),
        // HOS-2589 D-8: set when a «Solo VIP» promotion was paused because the owner's
        // plan stopped granting `vip_only_promotions`; cleared when it is resumed.
        vipPausedAt: timestamp('vip_paused_at', { withTimezone: true }),
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
        ownerPromotions_entityType_entityId_idx: index(
            'ownerPromotions_entityType_entityId_idx'
        ).on(table.entityType, table.entityId),
        owner_promotions_venue_requires_entity_check: check(
            'owner_promotions_venue_requires_entity_check',
            sql`${table.entityType} <> 'venue' OR ${table.entityId} IS NOT NULL`
        ),
        owner_promotions_window_venue_check: check(
            'owner_promotions_window_venue_check',
            sql`${table.windowWeekdays} IS NULL OR ${table.entityType} = 'venue'`
        ),
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
        ownerPromotions_touristAudience_idx: index('ownerPromotions_touristAudience_idx').on(
            table.touristAudience
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
