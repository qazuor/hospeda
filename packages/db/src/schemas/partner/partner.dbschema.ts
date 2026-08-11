import type { ContactInfo, SocialNetwork } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingPlans, billingSubscriptions } from '../../billing/index.ts';
import {
    LifecycleStatusPgEnum,
    PartnerContentReviewStatePgEnum,
    PartnerSubscriptionStatusPgEnum,
    PartnerTierPgEnum,
    PartnerTypePgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Analytics data stored as JSONB
 */
export interface PartnerAnalytics {
    impressions?: number;
    clicks?: number;
}

export const partners = pgTable(
    'partners',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: varchar('slug', { length: 255 }).notNull().unique(),
        name: varchar('name', { length: 255 }).notNull(),
        type: PartnerTypePgEnum('type').notNull(),
        tier: PartnerTierPgEnum('tier').notNull(),
        logoUrl: text('logo_url'),
        websiteUrl: text('website_url'),
        description: text('description'),
        /**
         * How to reach the partner, and where they are (HOS-278 D3).
         *
         * OPERATIONAL, unlike the reviewed content trio further down: a phone
         * number or an address is the kind of fact that goes stale and that
         * only the partner can keep current, so routing it through an admin
         * queue would make the directory less accurate rather than more. Same
         * split `host_trades` draws between its contact/schedule fields and its
         * benefit.
         *
         * Shallow-MERGED on update (see `PartnerModel.mergeableJsonbColumns`),
         * so a form that models only the phone cannot delete the emails it
         * never sent.
         */
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        /**
         * Operational counterpart of {@link contactInfo}, but REPLACED
         * wholesale rather than merged — see `PartnerModel` for why merging
         * would make a cleared social link impossible to express.
         */
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        subscriptionStatus: PartnerSubscriptionStatusPgEnum('subscription_status')
            .notNull()
            .default('pending'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        analytics: jsonb('analytics').$type<PartnerAnalytics>().default({}),
        planId: uuid('plan_id').references(() => billingPlans.id, {
            onDelete: 'set null'
        }),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, {
            onDelete: 'set null'
        }),
        /**
         * The account that owns this partner listing (HOS-278 §6.5).
         *
         * Set when an approved `partner` alliance lead is provisioned, and
         * backfilled by the claim flow when an anonymous applicant later
         * redeems their token. Mirrors `host_trades.owner_user_id`, including
         * the reason it is nullable: a null owner is what makes the ownership
         * filter fail CLOSED, since a query scoped to the actor can never
         * match it. Curated partners created by hand in the admin have no
         * owner at all and are meant to stay that way.
         */
        ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
        /**
         * When the alliance actually began — NULL until it does (HOS-278 D1).
         *
         * Nullable because provisioning creates the row BEFORE any payment:
         * a DRAFT partner has been approved but has not started, and this
         * column previously had no way to say so. It was NOT NULL with no
         * default, so every writer had to invent a date — the admin form
         * still defaults to today — and that invented date was indexed by
         * `partners_startsAt_idx` alongside the real ones, indistinguishable
         * from them. NULL is now the honest answer, written for real only
         * when the partner subscription activates.
         */
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        /**
         * Logo the partner submitted, awaiting an admin's verdict (HOS-278 AC-11).
         *
         * This trio is deliberately SEPARATE from the live
         * {@link logoUrl}/{@link description}/{@link websiteUrl} rather than a
         * review flag on the row, for the reason `host_trades` split its
         * benefit the same way: a partner who is already paying and published
         * must not have their listing pulled off the carousel because they
         * uploaded a new logo and nobody has looked at it yet. The public read
         * path never touches these columns.
         *
         * `null` here does NOT mean "no logo", it means "nothing pending".
         */
        pendingLogoUrl: text('pending_logo_url'),
        /** Pending counterpart of {@link description}. */
        pendingDescription: text('pending_description'),
        /** Pending counterpart of {@link websiteUrl}. */
        pendingWebsiteUrl: text('pending_website_url'),
        /**
         * State of the CURRENT submission, or null when there has never been one.
         *
         * An explicit marker rather than something inferred from the pending
         * columns: a partner who edits only their description leaves
         * {@link pendingLogoUrl} null, and inferring would read that as
         * "nothing to review".
         */
        contentReviewState: PartnerContentReviewStatePgEnum('content_review_state'),
        /**
         * Why an admin turned the submission down.
         *
         * Kept because discarding a rejected submission without recording the
         * refusal — which is what the `host_trades` reject path does, harmlessly,
         * since that provider keeps their published benefit — would leave a
         * partner looking at an empty form with no way to learn that the logo
         * is the reason they are still not visible.
         */
        contentReviewNote: text('content_review_note'),
        /**
         * When this partner's content FIRST cleared review — the payment gate
         * itself (HOS-278 AC-11).
         *
         * NULL means no admin has ever accepted this partner's content, and no
         * payment may be initiated for it. Separate from
         * {@link contentReviewState} on purpose, and never cleared once set: a
         * later edit sends the state back to `pending`, but the LIVE content is
         * still the approved one, so the partner keeps both their listing and
         * the right to be charged for it. Reading the state instead would make
         * every edit a self-inflicted suspension of billing.
         */
        contentApprovedAt: timestamp('content_approved_at', { withTimezone: true }),
        /** Admin who accepted the content. */
        contentApprovedById: uuid('content_approved_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /**
         * When the "you have not paid, we will archive this" notice was sent
         * (HOS-278 R-3), or null if it never was.
         *
         * Load-bearing for the reaper's FIRST stage and nothing else: without
         * it the 30-day nudge has no memory, so the cron would re-send it every
         * single day from day 31 until the partner either pays or is archived.
         * Sixty emails is not a reminder, it is a reason to mark the sender as
         * spam.
         */
        unpaidNoticeSentAt: timestamp('unpaid_notice_sent_at', { withTimezone: true }),
        /**
         * When this partner was revoked (HOS-278 R-4), or null if it was not.
         *
         * Revoking flips {@link lifecycleState} to INACTIVE and fills this
         * trio. It never deletes the row: the partner must stay auditable, and
         * the fact that they were once approved is itself worth keeping.
         *
         * Deliberately NOT {@link deletedAt} — a soft-deleted row disappears
         * from admin queries too, and a revoked partner must stay in front of
         * the admins who revoked it. `lifecycleState` is the visibility switch
         * this table already had; the trio is what turns flipping it into a
         * decision with an author. `subscriptionStatus` is deliberately left
         * alone: using it would conflate "we took them down" with "they
         * stopped paying".
         */
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        /** Admin who revoked the partner. */
        revokedById: uuid('revoked_by_id').references(() => users.id, { onDelete: 'set null' }),
        /** Why it was revoked. Required at the endpoint, so never empty when set. */
        revokeReason: text('revoke_reason'),
        // Audit fields
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        partners_slug_idx: index('partners_slug_idx').on(table.slug),
        partners_type_idx: index('partners_type_idx').on(table.type),
        partners_tier_idx: index('partners_tier_idx').on(table.tier),
        partners_subscriptionStatus_idx: index('partners_subscriptionStatus_idx').on(
            table.subscriptionStatus
        ),
        partners_lifecycleState_idx: index('partners_lifecycleState_idx').on(table.lifecycleState),
        partners_startsAt_idx: index('partners_startsAt_idx').on(table.startsAt),
        partners_ownerUserId_idx: index('partners_ownerUserId_idx').on(table.ownerUserId),
        // Drives the admin review queue ("what is waiting on me"), which reads
        // exactly one value out of a column that is null for most rows.
        partners_contentReviewState_idx: index('partners_contentReviewState_idx').on(
            table.contentReviewState
        ),
        partners_deletedAt_idx: index('partners_deletedAt_idx').on(table.deletedAt),
        // Composite index for findActivePartners (filters by both subscriptionStatus and lifecycleState)
        partners_subscriptionStatus_lifecycleState_idx: index(
            'partners_subscriptionStatus_lifecycleState_idx'
        ).on(table.subscriptionStatus, table.lifecycleState),
        // Anticipatory composite for partner-expiry cron
        partners_lifecycleState_endsAt_idx: index('partners_lifecycleState_endsAt_idx').on(
            table.lifecycleState,
            table.endsAt
        )
    })
);

export const partnersRelations = relations(partners, ({ one }) => ({
    owner: one(users, {
        fields: [partners.ownerUserId],
        references: [users.id],
        relationName: 'partnerOwner'
    }),
    createdBy: one(users, { fields: [partners.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [partners.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [partners.deletedById], references: [users.id] }),
    plan: one(billingPlans, {
        fields: [partners.planId],
        references: [billingPlans.id]
    }),
    subscription: one(billingSubscriptions, {
        fields: [partners.subscriptionId],
        references: [billingSubscriptions.id]
    })
}));

/** Type-inferred insert type for partners rows. */
export type InsertPartner = typeof partners.$inferInsert;
/** Type-inferred select type for partners rows. */
export type SelectPartner = typeof partners.$inferSelect;
