import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

export const accommodationIaData: ReturnType<typeof pgTable> = pgTable('accommodation_ia_data', {
    id: uuid('id').primaryKey().defaultRandom(),
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: text('category'),
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const accommodationIaDataRelations = relations(accommodationIaData, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationIaData.accommodationId],
        references: [accommodations.id]
    })
}));
