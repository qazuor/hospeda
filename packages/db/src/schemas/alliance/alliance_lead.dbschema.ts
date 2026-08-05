import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { destinations } from '../destination/destination.dbschema.ts';
import { hostTrades } from '../host-trade/host_trade.dbschema.ts';
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
        /**
         * Trading name of the applicant's business — becomes `host_trades.name`.
         *
         * Distinct from {@link contactName}, which is the PERSON to talk to.
         * Provisioning needs the business, and using the contact's name would
         * publish "Juan Pérez" into a directory of plumbers and locksmiths.
         *
         * See {@link category} for why these columns are typed and nullable.
         */
        businessName: varchar('business_name', { length: 255 }),
        /**
         * Service category the applicant operates in (HOS-278 §6.4).
         *
         * This column and its neighbours REVERSE HOS-277's NG-3 ("no dedicated
         * typed columns per kind") for `service_provider` alone, and the reason
         * is concrete: approving a provider must materialize a `host_trades`
         * row, and that table requires `name`, `category`, `destination_id` and
         * a benefit — none of which survive as data under NG-3, which
         * serializes every kind-specific answer into {@link message} as
         * labelled prose. The data was always collected; it just was not
         * addressable.
         *
         * Nullable because the other three kinds do not use them, and because
         * leads submitted before this change have none. Required-ness is
         * enforced per-kind by Zod at write time, not by the column.
         *
         * Stored as varchar rather than a pg enum to match this table's own
         * documented convention (see {@link kind} and {@link status}).
         * Validated against `HostTradeCategoryEnum` in `@repo/schemas`.
         */
        category: varchar('category', { length: 50 }),
        /** Destination the applicant covers. Becomes `host_trades.destination_id`. */
        destinationId: uuid('destination_id').references(() => destinations.id, {
            onDelete: 'set null'
        }),
        /**
         * What the applicant offers hosts, as a closed type validated against
         * `HostTradeBenefitTypeEnum`. See {@link category} for why it is varchar.
         */
        benefitType: varchar('benefit_type', { length: 30 }),
        /** Magnitude of the benefit, interpreted by {@link benefitType}. */
        benefitValue: integer('benefit_value'),
        /** Fine print accompanying the benefit. */
        benefitText: text('benefit_text'),
        /**
         * The directory listing this lead's approval produced (HOS-278 §6.4).
         *
         * Serves two purposes at once. It makes approval IDEMPOTENT: a second
         * approve on an already-approved lead finds this set and provisions
         * nothing, instead of minting a second listing under a deduplicated
         * slug (`acme`, `acme-2`) that nobody would notice until the directory
         * showed the provider twice. And it is the link `/mi-cuenta/aliados`
         * follows to offer an approved applicant their own ficha.
         *
         * Null for every lead that is not an approved `service_provider`.
         */
        provisionedHostTradeId: uuid('provisioned_host_trade_id').references(() => hostTrades.id, {
            onDelete: 'set null'
        }),
        /**
         * The account this application belongs to (HOS-278 §6.2).
         *
         * Nullable because the anonymous applicant is the PRIMARY case, not an
         * edge case: the four "aliados" forms are public and most submissions
         * arrive with no session. It is set in three ways:
         *  - immediately, when the submitter is authenticated;
         *  - at approval, when the email had no account and one is created;
         *  - via {@link claimToken}, when the email already belonged to someone.
         *
         * This column is the ONLY way a lead is resolved to a user. Never match
         * by `email` (HOS-278 R-1): the lead's email is unverified, so an email
         * match would let anyone attach an application — and whatever benefits
         * it carries — to someone else's account.
         */
        applicantUserId: uuid('applicant_user_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /**
         * Single-use secret proving the person clicking owns {@link email}.
         *
         * Only issued when an anonymous submission arrives with an email that
         * ALREADY has an account. Until it is redeemed, `applicantUserId` stays
         * null — an unconfirmed application is simply unlinked, never wrong
         * (HOS-278 OQ-5): the admin still sees it, it just hangs off nobody.
         */
        claimToken: text('claim_token'),
        /** When {@link claimToken} stops being redeemable. 7 days (HOS-278 OQ-5). */
        claimExpiresAt: timestamp('claim_expires_at', { withTimezone: true }),
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
        alliance_leads_deletedAt_idx: index('alliance_leads_deletedAt_idx').on(table.deletedAt),
        // Backs `GET /protected/alliance/leads/mine`, which every signed-in
        // applicant hits on `/mi-cuenta/aliados`.
        alliance_leads_applicantUserId_idx: index('alliance_leads_applicant_user_id_idx').on(
            table.applicantUserId
        )
    })
);

export const allianceLeadsRelations = relations(allianceLeads, ({ one }) => ({
    destination: one(destinations, {
        fields: [allianceLeads.destinationId],
        references: [destinations.id]
    }),
    provisionedHostTrade: one(hostTrades, {
        fields: [allianceLeads.provisionedHostTradeId],
        references: [hostTrades.id]
    }),
    applicant: one(users, {
        fields: [allianceLeads.applicantUserId],
        references: [users.id],
        relationName: 'allianceLeadApplicant'
    }),
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
