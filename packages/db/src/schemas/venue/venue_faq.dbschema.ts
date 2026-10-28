import type { AdminInfoType, I18nText } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { venues } from './venue.dbschema.ts';

/**
 * Venue FAQ table (SPEC-239).
 *
 * Mirrors accommodation_faqs exactly:
 * - FK venueId CASCADE (FAQs deleted with the listing)
 * - question/answer notNull, category nullable
 * - displayOrder for UI-controlled ordering (NULLS LAST in queries)
 * - lifecycleState defaults ACTIVE
 * - Full audit columns
 */
export const venueFaqs = pgTable(
    'venue_faqs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        venueId: uuid('venue_id')
            .notNull()
            .references(() => venues.id, { onDelete: 'cascade' }),
        question: text('question').notNull(),
        answer: text('answer').notNull(),
        // HOS-117: additive nullable I18nText columns for multi-language FAQ content.
        // Legacy question/answer stay as the es fallback source (search_index matview depends on them).
        questionI18n: jsonb('question_i18n').$type<I18nText>(),
        answerI18n: jsonb('answer_i18n').$type<I18nText>(),
        category: text('category'),
        /** Display order for FAQ items within a venue listing. NULLS LAST in queries. */
        displayOrder: integer('display_order'),
        /**
         * HOS-400: channel visibility, adopting the fragment HOS-393 introduced on
         * `accommodation_faqs`. The two flags are independent — a FAQ can be
         * public-only, AI-only, both, or neither (effectively a draft).
         *
         * Both are `NOT NULL DEFAULT true`, so pre-existing rows keep today's
         * behaviour (published on the listing AND fed to the chat) with no backfill.
         */
        isVisibleOnListing: boolean('is_visible_on_listing').notNull().default(true),
        isUsableByAi: boolean('is_usable_by_ai').notNull().default(true),
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
        venueFaqs_venueId_idx: index('venueFaqs_venueId_idx').on(table.venueId),
        venueFaqs_category_idx: index('venueFaqs_category_idx').on(table.category)
    })
);

export const venueFaqsRelations = relations(venueFaqs, ({ one }) => ({
    venue: one(venues, {
        fields: [venueFaqs.venueId],
        references: [venues.id]
    })
}));

/** Type-inferred insert type for venue_faqs rows. */
export type InsertVenueFaq = typeof venueFaqs.$inferInsert;
/** Type-inferred select type for venue_faqs rows. */
export type SelectVenueFaq = typeof venueFaqs.$inferSelect;
