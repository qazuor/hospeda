import type { AdminInfoType, CoordinatesType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { destinations } from '../destination/destination.dbschema.ts';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { events } from './event.dbschema.ts';

export const eventLocations = pgTable(
    'event_locations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        // Destination FK (SPEC-095): geographic context lives on the destination relation,
        // referenced as cityDestination at query time. Must point to a destination of type CITY
        // (enforced at the service layer).
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'restrict' }),
        // Postal address fields (no city/state/country/neighborhood/department — those derive
        // from the destination relation).
        street: text('street'),
        number: text('number'),
        floor: text('floor'),
        apartment: text('apartment'),
        placeName: text('place_name'),
        coordinates: jsonb('coordinates').$type<CoordinatesType>(),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        eventLocations_slug_idx: index('eventLocations_slug_idx').on(table.slug),
        eventLocations_lifecycleState_idx: index('eventLocations_lifecycleState_idx').on(
            table.lifecycleState
        ),
        eventLocations_destinationId_idx: index('eventLocations_destinationId_idx').on(
            table.destinationId
        ),
        eventLocations_createdById_idx: index('eventLocations_createdById_idx').on(
            table.createdById
        )
    })
);

export const eventLocationsRelations = relations(eventLocations, ({ many, one }) => ({
    events: many(events),
    destination: one(destinations, {
        fields: [eventLocations.destinationId],
        references: [destinations.id]
    })
}));
