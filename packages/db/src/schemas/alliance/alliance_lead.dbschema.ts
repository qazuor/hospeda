import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Alliance lead table (HOS-277).
 *
 * Captures inbound interest from prospective partners, sponsors, editors, and
 * service providers who submit one of the four "aliados" public forms. Admins
 * review and approve/reject by hand — approving never auto-provisions any
 * role/entity (NG-1). Unlike `commerce_leads`, this table follows the full
 * BaseModel audit convention (soft-delete + createdById/updatedById/deletedById)
 * per HOS-277 §7.2, since alliance leads are not the append-only administrative
 * exception that motivated `commerce_leads`' leaner shape.
 *
 * kind: closed discriminator ('partner' | 'sponsor' | 'editor' | 'service_provider').
 * Stored as varchar (not a Postgres enum), mirroring `commerce_leads.status`'s
 * choice of varchar over enum for the same lead-workflow family.
 */
export const allianceLeads = pgTable(
    'alliance_leads',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Alliance program discriminator. Closed set validated by
         * `AllianceLeadKindEnum` in `@repo/schemas`: partner | sponsor | editor
         * | service_provider.
         */
        kind: varchar('kind', { length: 30 }).notNull(),
        /** Full name of the contact person. */
        contactName: text('contact_name').notNull(),
        /** Contact email address (used for follow-up). */
        email: text('email').notNull(),
        /** Optional phone number. */
        phone: varchar('phone', { length: 50 }),
        /**
         * Free-text message from the applicant. The submitting form serializes
         * any kind-specific fields (business name, website, portfolio links,
         * etc.) into this field with labels — see HOS-277 §7.3. No dedicated
         * typed columns per kind in V1 (NG-3).
         */
        message: text('message').notNull(),
        /**
         * Lead handling status. Values: 'pending' | 'reviewing' | 'approved' | 'rejected'
         * (canonical workflow vocabulary defined by `AllianceLeadStatusEnum` in
         * `@repo/schemas`; mirrors `commerce_leads.status`). Stored as varchar
         * (not enum) for flexibility.
         */
        status: varchar('status', { length: 50 }).notNull().default('pending'),
        /** Internal admin note about the lead disposition, set via mark-handled. */
        adminNote: text('admin_note'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        alliance_leads_kind_idx: index('alliance_leads_kind_idx').on(table.kind),
        alliance_leads_status_idx: index('alliance_leads_status_idx').on(table.status),
        alliance_leads_email_idx: index('alliance_leads_email_idx').on(table.email),
        alliance_leads_deletedAt_idx: index('alliance_leads_deletedAt_idx').on(table.deletedAt)
    })
);

export const allianceLeadsRelations = relations(allianceLeads, ({ one }) => ({
    createdBy: one(users, {
        fields: [allianceLeads.createdById],
        references: [users.id],
        relationName: 'allianceLeadCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [allianceLeads.updatedById],
        references: [users.id],
        relationName: 'allianceLeadUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [allianceLeads.deletedById],
        references: [users.id],
        relationName: 'allianceLeadDeletedBy'
    })
}));

/** Type-inferred insert type for alliance_leads rows. */
export type InsertAllianceLead = typeof allianceLeads.$inferInsert;
/** Type-inferred select type for alliance_leads rows. */
export type SelectAllianceLead = typeof allianceLeads.$inferSelect;
