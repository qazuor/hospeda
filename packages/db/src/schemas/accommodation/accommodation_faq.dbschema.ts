import type { AdminInfoType, I18nText } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

export const accommodationFaqs = pgTable(
    'accommodation_faqs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        question: text('question').notNull(),
        answer: text('answer').notNull(),
        // HOS-117: additive nullable I18nText columns for multi-language FAQ content.
        // Legacy question/answer stay as the es fallback source (search_index matview depends on them).
        questionI18n: jsonb('question_i18n').$type<I18nText>(),
        answerI18n: jsonb('answer_i18n').$type<I18nText>(),
        category: text('category'),
        /** Display order for FAQ items within an accommodation; backfilled from created_at on migration. */
        displayOrder: integer('display_order'),
        /**
         * HOS-393: channel visibility. The two flags are independent — a FAQ can be
         * public-only, AI-only, both, or neither (effectively a draft).
         *
         * Both are `NOT NULL DEFAULT true`, so pre-existing rows keep today's
         * behaviour (published on the listing AND fed to the chat) with no backfill.
         *
         * Named `is*` per the repo convention (`is_featured`, `is_verified`).
         * `is_public` was rejected: too easily confused with the `visibility` enum
         * other entities carry.
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
        accommodationFaqs_accommodationId_idx: index('accommodationFaqs_accommodationId_idx').on(
            table.accommodationId
        ),
        accommodationFaqs_category_idx: index('accommodationFaqs_category_idx').on(table.category)
    })
);

export const accommodationFaqsRelations = relations(accommodationFaqs, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationFaqs.accommodationId],
        references: [accommodations.id]
    })
}));
