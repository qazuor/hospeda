import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * Gastronomy FAQ table (SPEC-239).
 *
 * Mirrors accommodation_faqs exactly:
 * - FK gastronomyId CASCADE (FAQs deleted with the listing)
 * - question/answer notNull, category nullable
 * - displayOrder for UI-controlled ordering (NULLS LAST in queries)
 * - lifecycleState defaults ACTIVE
 * - Full audit columns
 */
export const gastronomyFaqs = pgTable(
    'gastronomy_faqs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        question: text('question').notNull(),
        answer: text('answer').notNull(),
        category: text('category'),
        /** Display order for FAQ items within a gastronomy listing. NULLS LAST in queries. */
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
        gastronomyFaqs_gastronomyId_idx: index('gastronomyFaqs_gastronomyId_idx').on(
            table.gastronomyId
        ),
        gastronomyFaqs_category_idx: index('gastronomyFaqs_category_idx').on(table.category)
    })
);

export const gastronomyFaqsRelations = relations(gastronomyFaqs, ({ one }) => ({
    gastronomy: one(gastronomies, {
        fields: [gastronomyFaqs.gastronomyId],
        references: [gastronomies.id]
    })
}));

/** Type-inferred insert type for gastronomy_faqs rows. */
export type InsertGastronomyFaq = typeof gastronomyFaqs.$inferInsert;
/** Type-inferred select type for gastronomy_faqs rows. */
export type SelectGastronomyFaq = typeof gastronomyFaqs.$inferSelect;
