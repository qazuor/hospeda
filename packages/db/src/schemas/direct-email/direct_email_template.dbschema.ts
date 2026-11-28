import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Direct email templates table (HOS-2685).
 *
 * A reusable subject and TipTap body the admin starts a direct email from.
 * Templates are plain data behind an API so the CRM (HOS-2686) can read the
 * same rows instead of copying them. Soft delete only.
 */
export const directEmailTemplates = pgTable(
    'direct_email_template',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Internal label shown in the template picker. */
        name: varchar('name', { length: 120 }).notNull(),

        subject: varchar('subject', { length: 200 }).notNull(),

        /** TipTap document JSON. */
        bodyJson: jsonb('body_json').notNull(),

        /** FK → users.id. Admin who created the template. */
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        /** FK → users.id. Admin who last edited the template. */
        updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** Template list: live rows by name. */
        direct_email_template_deleted_at_idx: index('direct_email_template_deleted_at_idx').on(
            table.deletedAt
        )
    })
);

/** Drizzle relations for `direct_email_template`. */
export const directEmailTemplatesRelations = relations(directEmailTemplates, ({ one }) => ({
    creator: one(users, {
        fields: [directEmailTemplates.createdBy],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertDirectEmailTemplate = typeof directEmailTemplates.$inferInsert;
export type SelectDirectEmailTemplate = typeof directEmailTemplates.$inferSelect;
