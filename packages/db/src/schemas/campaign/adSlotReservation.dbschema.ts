import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { AdSlotReservationStatusPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';
import { adSlots } from './adSlot.dbschema';
import { campaignsFase26 } from './campaignFase26.dbschema';

/**
 * AD_SLOT_RESERVATION Schema - Fase 2.6: Grupo Campañas y Publicidad
 * Reservations of advertising slots by specific campaigns for defined periods
 */
export const adSlotReservations = pgTable('ad_slot_reservations', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Relationships
    adSlotId: uuid('ad_slot_id')
        .notNull()
        .references(() => adSlots.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
        .notNull()
        .references(() => campaignsFase26.id, { onDelete: 'cascade' }),

    // Reservation period
    fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
    toDate: timestamp('to_date', { withTimezone: true }).notNull(),

    // Reservation status
    status: AdSlotReservationStatusPgEnum('status').notNull().default('RESERVED'), // RESERVED, ACTIVE, PAUSED, ENDED, CANCELLED

    // Administrative metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id')
        .notNull()
        .references(() => users.id),
    updatedById: uuid('updated_by_id')
        .notNull()
        .references(() => users.id),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id)
});

export const adSlotReservationRelations = relations(adSlotReservations, ({ one }) => ({
    // Ad slot relationship
    adSlot: one(adSlots, {
        fields: [adSlotReservations.adSlotId],
        references: [adSlots.id],
        relationName: 'ad_slot_reservations'
    }),

    // Campaign relationship
    campaign: one(campaignsFase26, {
        fields: [adSlotReservations.campaignId],
        references: [campaignsFase26.id],
        relationName: 'campaign_slot_reservations_fase26'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [adSlotReservations.createdById],
        references: [users.id],
        relationName: 'ad_slot_reservation_created_by'
    }),
    updatedBy: one(users, {
        fields: [adSlotReservations.updatedById],
        references: [users.id],
        relationName: 'ad_slot_reservation_updated_by'
    }),
    deletedBy: one(users, {
        fields: [adSlotReservations.deletedById],
        references: [users.id],
        relationName: 'ad_slot_reservation_deleted_by'
    })
}));

export type AdSlotReservation = typeof adSlotReservations.$inferSelect;
export type NewAdSlotReservation = typeof adSlotReservations.$inferInsert;
