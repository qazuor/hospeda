import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.js';
import { StatePgEnum } from './enums.dbschema.js';
import { accommodationFaqRelations } from './r_accommodation_faq.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * accommodation_faqs table schema
 */
export const accommodationFaqs: ReturnType<typeof pgTable> = pgTable('accommodation_faqs', {
    /** Primary key */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Internal name (slug/code) */
    name: text('name').notNull(),

    /** Display name for UI */
    displayName: text('display_name').notNull(),

    /** FK to accommodations.id */
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),

    /** Question text */
    question: text('question').notNull(),

    /** Answer text */
    answer: text('answer').notNull(),

    /** Optional category */
    category: text('category'),

    /** General state */
    state: StatePgEnum('state').default('ACTIVE').notNull(),

    /** Admin metadata */
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    /** Audit & soft-delete */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

/**
 * Relations for accommodation_faqs table
 */
export const accommodationFaqsRelations = relations(accommodationFaqs, ({ one, many }) => ({
    /** Creator */
    createdBy: one(users, {
        fields: [accommodationFaqs.createdById],
        references: [users.id]
    }),
    /** Updater */
    updatedBy: one(users, {
        fields: [accommodationFaqs.updatedById],
        references: [users.id]
    }),
    /** Soft-deleter */
    deletedBy: one(users, {
        fields: [accommodationFaqs.deletedById],
        references: [users.id]
    }),
    /** Parent accommodation */
    accommodation: one(accommodations, {
        fields: [accommodationFaqs.accommodationId],
        references: [accommodations.id]
    }),
    /** Join entries */
    faqRelations: many(accommodationFaqRelations),
    /** Shortcut to accommodations */
    accommodations: many(accommodations, { relationName: 'r_accommodation_faq' }),
    /** Tags */
    tags: many(entityTagRelations)
}));
