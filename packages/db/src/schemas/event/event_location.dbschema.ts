import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { events } from './event.dbschema.ts';

export const eventLocations: ReturnType<typeof pgTable> = pgTable('event_locations', {
    id: uuid('id').primaryKey().defaultRandom(),
    street: text('street'),
    number: text('number'),
    floor: text('floor'),
    apartment: text('apartment'),
    neighborhood: text('neighborhood'),
    city: text('city').notNull(),
    department: text('department'),
    placeName: text('place_name'),
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const eventLocationsRelations = relations(eventLocations, ({ many }) => ({
    events: many(events)
}));
