import { PLAN_ROLES } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    foreignKey,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { catalogKeys } from './catalog-key.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { verticals } from './vertical.dbschema.ts';

/**
 * `plan` — identity and cosmetics of a plan (HOS-1434, V2, AC:V2:1; DEC-ARCH-001).
 *
 * Mutates freely: vertical, slug, name, description and the order on the
 * pricing page. Nothing here has an effect on what a person gets; whatever has
 * an effect lives in {@link planVersions}, which is immutable.
 *
 * - `UNIQUE(vertical, slug)`: a slug names one plan inside its vertical.
 * - `UNIQUE(id, vertical)`: the target of the composite foreign keys that
 *   state "this plan belongs to that vertical" (the version's own FK here, and
 *   billing's grant anchor later). Postgres needs a unique constraint over
 *   exactly the referenced columns, even when `id` is already the key.
 *
 * `role` (HOS-1436, AC:V2:6/7) marks the three non-sellable plans every
 * vertical declares — `trial`, `pre_trial`, `floor`; `NULL` is an ordinary
 * sellable plan. `CHECK` holds it to the closed list and a partial `UNIQUE`
 * allows at most one plan per role in a vertical. It is IMMUTABLE: a row
 * trigger (extras `044`) rejects any UPDATE that changes it. It is accepted
 * only when the plan is created (action 18), never updated.
 */
export const plans = pgTable(
    'plan',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The vertical the plan sells in. */
        vertical: varchar('vertical', { length: 32 })
            .notNull()
            .references(() => verticals.id),
        /** Stable identifier inside the vertical, e.g. `premium`. */
        slug: varchar('slug', { length: 64 }).notNull(),
        /** Display name. Cosmetic. */
        name: varchar('name', { length: 120 }).notNull(),
        /** Display description. Cosmetic. */
        description: text('description'),
        /** Position on the vertical's pricing page. Cosmetic. */
        pricingOrder: integer('pricing_order').notNull().default(0),
        /** `trial`, `pre_trial` or `floor`; `NULL` for a sellable plan. Immutable. */
        role: varchar('role', { length: 16 }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        verticalSlugUnique: unique('uq_plan_vertical_slug').on(t.vertical, t.slug),
        idVerticalUnique: unique('uq_plan_id_vertical').on(t.id, t.vertical),
        roleCheck: check(
            'ck_plan_role',
            sql`${t.role} IS NULL OR ${t.role} IN (${quotedList(PLAN_ROLES)})`
        ),
        verticalRoleUnique: uniqueIndex('uq_plan_vertical_role')
            .on(t.vertical, t.role)
            .where(sql`${t.role} IS NOT NULL`)
    })
);

/**
 * `plan_version` — what a plan grants that has an effect, frozen (HOS-1434, V2,
 * AC:V2:1 and AC:V2:2; DEC-ARCH-001, DEC-ARCH-002, DEC-SUB-002, DEC-TRIAL-003).
 *
 * IMMUTABLE except `current`, its only mutable column: changing anything with
 * an effect is publishing a new version, never editing the one a subscription
 * anchored to. The database enforces it with a row trigger (extras
 * `041-plan-catalog-immutability.trigger.sql`), not this file: Drizzle cannot
 * declare triggers.
 *
 * - `vertical` is copied from its plan at creation and is immutable; the
 *   composite FK `(plan_id, vertical) → plan(id, vertical)` makes a copy that
 *   disagrees with the plan impossible.
 * - `UNIQUE(id, plan_id)` and `UNIQUE(id, vertical)`: targets of billing's
 *   composite FKs (the grant anchor, and the subscription's `(version, vertical)`).
 * - `UNIQUE(plan_id) WHERE current`: at most one current version per plan. "At
 *   least one" is not expressible as a constraint; the publish action checks it.
 * - `UNIQUE(vertical, rank) WHERE sellable AND current` (INV:D2): two sellable,
 *   current versions of one vertical never share a rank. That is an invalid
 *   state, not a tie to break; an old version that is not current, or not
 *   sellable, does not hold its rank.
 */
export const planVersions = pgTable(
    'plan_version',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        planId: uuid('plan_id').notNull(),
        /** Copied from the plan at creation; immutable. */
        vertical: varchar('vertical', { length: 32 }).notNull(),
        /** Explicit order among the vertical's sellable plans (DEC-ARCH-002). */
        rank: integer('rank').notNull(),
        /** Whether it can be bought. A retired plan publishes a non-sellable version. */
        sellable: boolean('sellable').notNull(),
        /** The plan's current version. The only mutable column. */
        current: boolean('current').notNull(),
        /** Grace days after a failed charge (DEC-SUB-002), 10 by default. */
        graceDays: integer('grace_days').notNull().default(10),
        /** Trial days of the plan (DEC-TRIAL-003); Partner's plans hold 0. */
        trialDays: integer('trial_days').notNull(),
        /** Whether a subscription to this version may be paused (INV:23). */
        allowsPause: boolean('allows_pause').notNull(),
        /** Whether it inherits the Tourist VIP benefits (DEC-ENT-003). */
        inheritsTouristVip: boolean('inherits_tourist_vip').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        planVerticalFk: foreignKey({
            name: 'fk_plan_version_plan_vertical',
            columns: [t.planId, t.vertical],
            foreignColumns: [plans.id, plans.vertical]
        }),
        idPlanUnique: unique('uq_plan_version_id_plan').on(t.id, t.planId),
        idVerticalUnique: unique('uq_plan_version_id_vertical').on(t.id, t.vertical),
        oneCurrentPerPlan: uniqueIndex('uq_plan_version_one_current_per_plan')
            .on(t.planId)
            .where(sql`${t.current}`),
        sellableCurrentRankUnique: uniqueIndex('uq_plan_version_sellable_current_rank')
            .on(t.vertical, t.rank)
            .where(sql`${t.sellable} AND ${t.current}`),
        graceDaysCheck: check('ck_plan_version_grace_days', sql`${t.graceDays} >= 0`),
        trialDaysCheck: check('ck_plan_version_trial_days', sql`${t.trialDays} >= 0`)
    })
);

/**
 * `plan_version_entitlement` — which entitlement key a plan version grants
 * (HOS-1434, V2, AC:V2:1; DEC-ENT-001).
 *
 * A metered entitlement carries two quotas, the plan's and the trial's; a
 * plain (boolean) one carries none. Both quotas are set together or not at all.
 * Immutable with its version (extras 041).
 */
export const planVersionEntitlements = pgTable(
    'plan_version_entitlement',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        planVersionId: uuid('plan_version_id')
            .notNull()
            .references(() => planVersions.id),
        /** A key of the catalog (`catalog_key`). */
        key: varchar('key', { length: 64 })
            .notNull()
            .references(() => catalogKeys.key),
        /** The plan's quota, for a metered entitlement; `NULL` otherwise. */
        planQuota: integer('plan_quota'),
        /** The trial's own quota, for a metered entitlement; `NULL` otherwise. */
        trialQuota: integer('trial_quota'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionKeyUnique: unique('uq_plan_version_entitlement_version_key').on(
            t.planVersionId,
            t.key
        ),
        quotasTogetherCheck: check(
            'ck_plan_version_entitlement_quotas_together',
            sql`(${t.planQuota} IS NULL) = (${t.trialQuota} IS NULL)`
        ),
        quotasNonNegativeCheck: check(
            'ck_plan_version_entitlement_quotas_non_negative',
            sql`${t.planQuota} IS NULL OR (${t.planQuota} >= 0 AND ${t.trialQuota} >= 0)`
        )
    })
);

/**
 * `plan_version_limit` — which limit key a plan version sets, and to what
 * value (HOS-1434, V2, AC:V2:1). Immutable with its version (extras 041).
 */
export const planVersionLimits = pgTable(
    'plan_version_limit',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        planVersionId: uuid('plan_version_id')
            .notNull()
            .references(() => planVersions.id),
        /** A key of the catalog (`catalog_key`). */
        key: varchar('key', { length: 64 })
            .notNull()
            .references(() => catalogKeys.key),
        /** The limit's value. */
        value: integer('value').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionKeyUnique: unique('uq_plan_version_limit_version_key').on(t.planVersionId, t.key),
        valueCheck: check('ck_plan_version_limit_value', sql`${t.value} >= 0`)
    })
);

/** Insert shape for `plan`. */
export type InsertPlan = typeof plans.$inferInsert;
/** Select shape for `plan`. */
export type SelectPlan = typeof plans.$inferSelect;
/** Insert shape for `plan_version`. */
export type InsertPlanVersion = typeof planVersions.$inferInsert;
/** Select shape for `plan_version`. */
export type SelectPlanVersion = typeof planVersions.$inferSelect;
/** Insert shape for `plan_version_entitlement`. */
export type InsertPlanVersionEntitlement = typeof planVersionEntitlements.$inferInsert;
/** Select shape for `plan_version_entitlement`. */
export type SelectPlanVersionEntitlement = typeof planVersionEntitlements.$inferSelect;
/** Insert shape for `plan_version_limit`. */
export type InsertPlanVersionLimit = typeof planVersionLimits.$inferInsert;
/** Select shape for `plan_version_limit`. */
export type SelectPlanVersionLimit = typeof planVersionLimits.$inferSelect;
