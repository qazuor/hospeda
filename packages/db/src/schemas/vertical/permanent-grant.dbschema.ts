import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    foreignKey,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { plans, planVersions } from './plan-catalog.dbschema.ts';

/**
 * Permanent grants and their vertical anchors (B9a.md:1128-1136; B/02 §2.4).
 * The partial unique index permits one unrevoked grant per beneficiary; revocation
 * audit fields are written together and anchors retain the plan and floor they cite.
 */
export const permanentGrants = pgTable(
    'permanent_grant',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Beneficiary account. */
        beneficiaryUserId: uuid('beneficiary_user_id')
            .notNull()
            .references(() => users.id),
        /** Whether addon coverage is included. */
        includesAddons: boolean('includes_addons').notNull(),
        /** User who granted the benefit. */
        grantedBy: uuid('granted_by')
            .notNull()
            .references(() => users.id),
        /** Grant reason. */
        reason: text('reason').notNull(),
        /** Subscription rows affected by S13. */
        affectedSubscriptionIds: uuid('affected_subscription_ids')
            .array()
            .notNull()
            .default(sql`'{}'`),
        /** Revocation instant; null while live. */
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        /** User who revoked the grant. */
        revokedBy: uuid('revoked_by').references(() => users.id),
        /** Required reason for revocation. */
        revocationReason: text('revocation_reason'),
        /** Creation instant. */
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        /** Last update instant. */
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        revocationTogether: check(
            'ck_permanent_grant_revocation_together',
            sql`(${t.revokedAt} IS NULL AND ${t.revokedBy} IS NULL AND ${t.revocationReason} IS NULL) OR (${t.revokedAt} IS NOT NULL AND ${t.revokedBy} IS NOT NULL AND ${t.revocationReason} IS NOT NULL AND btrim(${t.revocationReason}) <> '')`
        ),
        liveBeneficiary: uniqueIndex('uq_permanent_grant_live_beneficiary')
            .on(t.beneficiaryUserId)
            .where(sql`revoked_at IS NULL`)
    })
);

/** A grant's plan and floor anchor for one vertical (B9a.md:1128-1136; B/02 §2.4). */
export const permanentGrantVerticals = pgTable(
    'permanent_grant_vertical',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Parent grant. */
        permanentGrantId: uuid('permanent_grant_id')
            .notNull()
            .references(() => permanentGrants.id),
        /** Covered vertical. */
        vertical: varchar('vertical', { length: 32 }).notNull(),
        /** Plan defining this anchor. */
        planId: uuid('plan_id').notNull(),
        /** Floor version belonging to this plan. */
        floorPlanVersionId: uuid('floor_plan_version_id').notNull(),
        /** Creation instant. */
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        grantVertical: unique('uq_permanent_grant_vertical_grant_vertical').on(
            t.permanentGrantId,
            t.vertical
        ),
        planFk: foreignKey({
            name: 'fk_permanent_grant_vertical_plan',
            columns: [t.planId, t.vertical],
            foreignColumns: [plans.id, plans.vertical]
        }),
        floorFk: foreignKey({
            name: 'fk_permanent_grant_vertical_floor',
            columns: [t.floorPlanVersionId, t.planId],
            foreignColumns: [planVersions.id, planVersions.planId]
        })
    })
);

/** Insert shape for a permanent grant. */
export type InsertPermanentGrant = typeof permanentGrants.$inferInsert;
/** Select shape for a permanent grant. */
export type SelectPermanentGrant = typeof permanentGrants.$inferSelect;
/** Insert shape for a permanent grant vertical. */
export type InsertPermanentGrantVertical = typeof permanentGrantVerticals.$inferInsert;
/** Select shape for a permanent grant vertical. */
export type SelectPermanentGrantVertical = typeof permanentGrantVerticals.$inferSelect;
