import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    numeric,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { OwnerPromotionDiscountTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

export const ownerPromotions: ReturnType<typeof pgTable> = pgTable(
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
        discountValue: numeric('discount_value').notNull(),
        minNights: integer('min_nights'),
        validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
        validUntil: timestamp('valid_until', { withTimezone: true }),
        maxRedemptions: integer('max_redemptions'),
        currentRedemptions: integer('current_redemptions').notNull().default(0),
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
        ownerPromotions_ownerId_idx: index('ownerPromotions_ownerId_idx').on(table.ownerId),
        ownerPromotions_accommodationId_idx: index('ownerPromotions_accommodationId_idx').on(
            table.accommodationId
        ),
        ownerPromotions_isActive_idx: index('ownerPromotions_isActive_idx').on(table.isActive),
        ownerPromotions_validFrom_idx: index('ownerPromotions_validFrom_idx').on(table.validFrom),
        ownerPromotions_deletedAt_idx: index('ownerPromotions_deletedAt_idx').on(table.deletedAt),
        ownerPromotions_ownerId_isActive_idx: index('ownerPromotions_ownerId_isActive_idx').on(
            table.ownerId,
            table.isActive
        )
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
