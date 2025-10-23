import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { adSlotReservations } from './adSlotReservation.dbschema';

/**
 * AD_SLOT Schema - Fase 2.6: Grupo Campañas y Publicidad
 * Advertising slots available for reservation by campaigns
 */
export const adSlots = pgTable('ad_slots', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Slot identification
    locationKey: text('location_key').notNull().unique(), // e.g., 'HOME_BANNER', 'SIDEBAR', 'SEARCH_RESULTS'

    // Slot specifications (JSONB for flexibility)
    specs: jsonb('specs').$type<{
        width?: number;
        height?: number;
        maxFileSize?: number;
        allowedFormats?: string[];
        position?: string;
        description?: string;
        displayRules?: {
            maxConcurrent?: number;
            rotationInterval?: number;
            targetDevice?: string[];
        };
    }>(),

    // Slot status
    isActive: boolean('is_active').notNull().default(true),

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

export const adSlotRelations = relations(adSlots, ({ one, many }) => ({
    // Slot reservations relationship
    slotReservations: many(adSlotReservations, {
        relationName: 'ad_slot_reservations'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [adSlots.createdById],
        references: [users.id],
        relationName: 'ad_slot_created_by'
    }),
    updatedBy: one(users, {
        fields: [adSlots.updatedById],
        references: [users.id],
        relationName: 'ad_slot_updated_by'
    }),
    deletedBy: one(users, {
        fields: [adSlots.deletedById],
        references: [users.id],
        relationName: 'ad_slot_deleted_by'
    })
}));

export type AdSlot = typeof adSlots.$inferSelect;
export type NewAdSlot = typeof adSlots.$inferInsert;
