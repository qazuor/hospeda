import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { destinations } from '../destination/destination.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Commerce lead table (SPEC-239 T-023).
 *
 * Captures inbound interest from prospective commerce listing owners who
 * submit a "I want to list my business" form. Admins review, convert, and
 * provision accounts. Soft-delete via deletedAt is NOT included: leads are
 * administrative records and are never surfaced publicly; they are retained
 * for audit. Full audit columns (createdAt/updatedAt) are present.
 *
 * domain: top-level discriminator ('gastronomy', 'experience', etc.) so a
 * single leads table serves all commerce verticals.
 */
export const commerceLeads = pgTable(
    'commerce_leads',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Commerce domain discriminator ('gastronomy', 'experience', etc.).
         * Stored as varchar (not an enum) so new verticals need no migration.
         */
        domain: varchar('domain', { length: 50 }).notNull(),
        /** Name of the business / venue. */
        businessName: text('business_name').notNull(),
        /** Full name of the contact person. */
        contactName: text('contact_name').notNull(),
        /** Contact email address (used for follow-up). */
        email: text('email').notNull(),
        /** Optional phone number. */
        phone: varchar('phone', { length: 50 }),
        /** Optional FK to the destination where the business is located. */
        destinationId: uuid('destination_id').references(() => destinations.id, {
            onDelete: 'set null'
        }),
        /** Optional free-form message from the prospective owner. */
        message: text('message'),
        /**
         * Lead handling status. Values: 'pending' | 'reviewing' | 'approved' | 'rejected'
         * (canonical workflow vocabulary defined by `CommerceLeadStatusEnum` in
         * `@repo/schemas`; mirrored by the admin inbox filter, status badge, and i18n keys).
         * Stored as varchar (not enum) for flexibility.
         */
        status: varchar('status', { length: 50 }).notNull().default('pending'),
        /** Timestamp when an admin first acted on this lead. */
        handledAt: timestamp('handled_at', { withTimezone: true }),
        /** Admin who acted on the lead. SET NULL if the admin account is deleted. */
        handledById: uuid('handled_by_id').references(() => users.id, { onDelete: 'set null' }),
        /** Internal admin note about the lead disposition. */
        adminNote: text('admin_note'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        commerce_leads_status_idx: index('commerce_leads_status_idx').on(table.status),
        commerce_leads_email_idx: index('commerce_leads_email_idx').on(table.email),
        commerce_leads_destinationId_idx: index('commerce_leads_destinationId_idx').on(
            table.destinationId
        )
    })
);

export const commerceLeadsRelations = relations(commerceLeads, ({ one }) => ({
    destination: one(destinations, {
        fields: [commerceLeads.destinationId],
        references: [destinations.id]
    }),
    handledBy: one(users, {
        fields: [commerceLeads.handledById],
        references: [users.id]
    })
}));

/** Type-inferred insert type for commerce_leads rows. */
export type InsertCommerceLead = typeof commerceLeads.$inferInsert;
/** Type-inferred select type for commerce_leads rows. */
export type SelectCommerceLead = typeof commerceLeads.$inferSelect;
