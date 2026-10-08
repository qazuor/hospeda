import { TrialStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    integer,
    pgTable,
    timestamp,
    unique,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { plans, planVersions } from '../vertical/plan-catalog.dbschema.ts';
import { quotedList } from '../vertical/quoted-list.ts';
import { verticals } from '../vertical/vertical.dbschema.ts';

/**
 * `trial` — the trial row of one person in one vertical (HOS-1443, V4.1,
 * AC:V4:1 to AC:V4:3; `V/02` §2.2, INV:1, INV:2, DEC-DATA-005 pin 8).
 *
 * The trial is single for life, so the row outlives everything and its mere
 * existence denies a new trial:
 *
 * - `UNIQUE(user_id, vertical)` and `UNIQUE(email_pseudonym, vertical)`, both
 *   WITHOUT a state condition. The second one closes the door a re-registration
 *   would open (a new `user_id` with the same mailbox).
 * - `user_id` references `users` `ON DELETE RESTRICT`: with CASCADE the account
 *   deletion would take the row and its pseudonym with it. An account is
 *   pseudonymised, never deleted, so the row keeps pointing at it.
 * - NO `deleted_at`: a row cannot be hidden by a soft delete. The `DELETE` itself
 *   is rejected by a trigger (extras `042-trial-no-delete.trigger.sql`), because
 *   Drizzle cannot declare triggers.
 * - No phone, tax id or device column, here or in {@link trialRedemptions}
 *   (AC:V4:3): only the normalised mailbox, as a pseudonym, can deny a trial.
 *
 * Nullability follows who writes the row. `T1` writes everything and the state
 * `TRIAL_ACTIVE` requires it (CHECK). `T6` and `T8` write a row born already
 * consumed, "without a clock": its dates, plan, floor and deadlines version stay
 * `NULL`.
 */
export const trials = pgTable(
    'trial',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The person. A pseudonymised account keeps its row, so `RESTRICT`. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        vertical: varchar('vertical', { length: 32 })
            .notNull()
            .references(() => verticals.id),
        /** State of the trial machine (`V/03` §2). `PRE_TRIAL` has no row. */
        status: varchar('status', { length: 32 }).notNull(),
        /**
         * The vertical's trial plan (a non-sellable `plan` of that vertical). The
         * composite FK states that the plan belongs to `vertical`.
         */
        trialPlanId: uuid('trial_plan_id'),
        /**
         * The floor of the ratchet (DEC-TRIAL-002), as REFERENCES to the plan
         * versions in force when the trial started, never as a copy of values
         * (V4.md:839). Three references (Coord-15): the entitlements derive from
         * the highest-rank sellable current version and the limits from the
         * lowest-rank one (`V/10` section 2), and the overrides live in the trial
         * plan inside the catalog (V2.md:78), so the VERSION of the trial plan in
         * force at start lets a later reader rebuild an override that was in force
         * and changed afterwards. DEC-TRIAL-002 implication 4 defines the floor as
         * the effective set at start: derive, then apply the overrides.
         */
        floorEntitlementsVersionId: uuid('floor_entitlements_version_id'),
        floorLimitsVersionId: uuid('floor_limits_version_id'),
        floorTrialPlanVersionId: uuid('floor_trial_plan_version_id'),
        /** When the trial clock started. `NULL` on a row born consumed. */
        startedAt: timestamp('started_at', { withTimezone: true }),
        /** When the trial clock ends. `NULL` on a row born consumed. */
        endsAt: timestamp('ends_at', { withTimezone: true }),
        /**
         * Deterministic pseudonym of the normalised mailbox: unkeyed SHA-256 as 64
         * lowercase hex characters (AC:V4:2). The mailbox itself is never stored.
         */
        emailPseudonym: varchar('email_pseudonym', { length: 64 }).notNull(),
        /**
         * Version of the vertical deadlines stored when the clock started
         * (`NUCLEO/02` §1.5). Plain integer: the versioned deadlines table does not
         * exist yet (V6.10), as with `deadlines_version` on the listings.
         */
        deadlinesVersion: integer('deadlines_version'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        userVerticalUnique: unique('uq_trial_user_vertical').on(t.userId, t.vertical),
        pseudonymVerticalUnique: unique('uq_trial_email_pseudonym_vertical').on(
            t.emailPseudonym,
            t.vertical
        ),
        trialPlanFk: foreignKey({
            name: 'fk_trial_trial_plan_vertical',
            columns: [t.trialPlanId, t.vertical],
            foreignColumns: [plans.id, plans.vertical]
        }),
        floorEntitlementsFk: foreignKey({
            name: 'fk_trial_floor_entitlements_version_vertical',
            columns: [t.floorEntitlementsVersionId, t.vertical],
            foreignColumns: [planVersions.id, planVersions.vertical]
        }),
        floorLimitsFk: foreignKey({
            name: 'fk_trial_floor_limits_version_vertical',
            columns: [t.floorLimitsVersionId, t.vertical],
            foreignColumns: [planVersions.id, planVersions.vertical]
        }),
        floorTrialPlanVersionFk: foreignKey({
            name: 'fk_trial_floor_trial_plan_version_vertical',
            columns: [t.floorTrialPlanVersionId, t.vertical],
            foreignColumns: [planVersions.id, planVersions.vertical]
        }),
        // The version must belong to THE trial plan of the row, not just to some
        // plan of the vertical (targets `uq_plan_version_id_plan`).
        floorTrialPlanVersionPlanFk: foreignKey({
            name: 'fk_trial_floor_trial_plan_version_plan',
            columns: [t.floorTrialPlanVersionId, t.trialPlanId],
            foreignColumns: [planVersions.id, planVersions.planId]
        }),
        statusCheck: check(
            'ck_trial_status',
            sql`${t.status} IN (${quotedList(Object.values(TrialStatusEnum))})`
        ),
        pseudonymFormatCheck: check(
            'ck_trial_email_pseudonym_format',
            sql`${t.emailPseudonym} ~ '^[0-9a-f]{64}$'`
        ),
        clockTogetherCheck: check(
            'ck_trial_clock_together',
            sql`(${t.startedAt} IS NULL) = (${t.endsAt} IS NULL)`
        ),
        clockOrderCheck: check(
            'ck_trial_clock_order',
            sql`${t.startedAt} IS NULL OR ${t.endsAt} >= ${t.startedAt}`
        ),
        deadlinesVersionCheck: check(
            'ck_trial_deadlines_version',
            sql`${t.deadlinesVersion} IS NULL OR ${t.deadlinesVersion} >= 1`
        ),
        activeCompleteCheck: check(
            'ck_trial_active_complete',
            sql`${t.status} <> '${sql.raw(TrialStatusEnum.TRIAL_ACTIVE)}' OR (
                ${t.trialPlanId} IS NOT NULL
                AND ${t.floorEntitlementsVersionId} IS NOT NULL
                AND ${t.floorLimitsVersionId} IS NOT NULL
                AND ${t.floorTrialPlanVersionId} IS NOT NULL
                AND ${t.startedAt} IS NOT NULL
                AND ${t.endsAt} IS NOT NULL
                AND ${t.deadlinesVersion} IS NOT NULL
            )`
        )
    })
);

/**
 * `canje_de_trial` — the redemptions `extenderTrial` applied (HOS-1443, V4.1;
 * `V/02` §2.2, F-8V3C1-003).
 *
 * Billing sends a redemption key with every `extenderTrial`; the row written in
 * the same transaction as the `T4` that applies the extension is what makes the
 * call idempotent: a retry with a key that already has a row does not run `T4`
 * again and answers `ACEPTADA`. A rejection writes nothing. Written by V4.3.
 *
 * `UNIQUE(redemption_key)`: a key redeems once. No phone, tax id or device
 * column (AC:V4:3).
 */
export const trialRedemptions = pgTable(
    'canje_de_trial',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        vertical: varchar('vertical', { length: 32 })
            .notNull()
            .references(() => verticals.id),
        /** The key billing sends in `extenderTrial` (`clave_de_canje`). */
        redemptionKey: varchar('redemption_key', { length: 255 }).notNull(),
        /** The days the extension applied. */
        appliedDays: integer('applied_days').notNull(),
        /** When the extension was applied. */
        appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        redemptionKeyUnique: unique('uq_canje_de_trial_redemption_key').on(t.redemptionKey),
        appliedDaysCheck: check('ck_canje_de_trial_applied_days', sql`${t.appliedDays} > 0`)
    })
);

/** Insert shape for `trial`. */
export type InsertTrial = typeof trials.$inferInsert;
/** Select shape for `trial`. */
export type SelectTrial = typeof trials.$inferSelect;
/** Insert shape for `canje_de_trial`. */
export type InsertTrialRedemption = typeof trialRedemptions.$inferInsert;
/** Select shape for `canje_de_trial`. */
export type SelectTrialRedemption = typeof trialRedemptions.$inferSelect;
