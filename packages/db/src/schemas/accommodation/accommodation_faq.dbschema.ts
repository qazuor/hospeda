import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

export const accommodationFaqs: ReturnType<typeof pgTable> = pgTable('accommodation_faqs', {
    id: uuid('id').primaryKey().defaultRandom(),
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    category: text('category'),
    lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const accommodationFaqsRelations = relations(accommodationFaqs, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationFaqs.accommodationId],
        references: [accommodations.id]
    })
}));
