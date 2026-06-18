import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { experiences } from './experiences.dbschema.ts';

/**
 * Experience FAQ table (SPEC-240).
 *
 * Mirrors gastronomy_faqs exactly:
 * - FK experienceId CASCADE (FAQs deleted with the listing)
 * - question/answer notNull, category nullable
 * - displayOrder for UI-controlled ordering (NULLS LAST in queries)
 * - lifecycleState defaults ACTIVE
 * - Full audit columns
 */
export const experienceFaqs = pgTable(
    'experience_faqs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        experienceId: uuid('experience_id')
            .notNull()
            .references(() => experiences.id, { onDelete: 'cascade' }),
        question: text('question').notNull(),
        answer: text('answer').notNull(),
        category: text('category'),
        /** Display order for FAQ items within an experience listing. NULLS LAST in queries. */
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
        experienceFaqs_experienceId_idx: index('experienceFaqs_experienceId_idx').on(
            table.experienceId
        ),
        experienceFaqs_category_idx: index('experienceFaqs_category_idx').on(table.category)
    })
);

export const experienceFaqsRelations = relations(experienceFaqs, ({ one }) => ({
    experience: one(experiences, {
        fields: [experienceFaqs.experienceId],
        references: [experiences.id]
    })
}));

/** Type-inferred insert type for experience_faqs rows. */
export type InsertExperienceFaq = typeof experienceFaqs.$inferInsert;
/** Type-inferred select type for experience_faqs rows. */
export type SelectExperienceFaq = typeof experienceFaqs.$inferSelect;
