import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { destinations } from './destination.dbschema.ts';

export const destinationFaqs = pgTable(
    'destination_faqs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),
        question: text('question').notNull(),
        answer: text('answer').notNull(),
        category: text('category'),
        /** Display order for FAQ items within a destination; backfilled from created_at on migration. */
        displayOrder: integer('display_order'),
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
        destinationFaqs_destinationId_idx: index('destinationFaqs_destinationId_idx').on(
            table.destinationId
        ),
        destinationFaqs_category_idx: index('destinationFaqs_category_idx').on(table.category)
    })
);

export const destinationFaqsRelations = relations(destinationFaqs, ({ one }) => ({
    destination: one(destinations, {
        fields: [destinationFaqs.destinationId],
        references: [destinations.id]
    })
}));
