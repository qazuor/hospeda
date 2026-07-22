import { relations, sql } from 'drizzle-orm';
import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { billingPlans, billingPrices, billingSubscriptions } from '../../billing/index.ts';

/**
 * Plan price-change propagation store (HOS-176).
 *
 * When an admin edits a plan's price (`updatePlan`), the new amount is written to
 * `billing_plans` / `billing_prices` locally but MercadoPago keeps charging every
 * existing subscriber the OLD `transaction_amount` — a silent divergence. HOS-176
 * closes that hole by PROPAGATING the new price to each active subscriber's MP
 * preapproval (owner decision: propagate-con-aviso).
 *
 * The propagation is a batch job, never a synchronous fan-out inside the admin
 * request (there can be N subscribers per plan). This header table records one row
 * per price change; {@link billingPlanPriceChangeTargets} tracks the per-subscriber
 * mutation. Modeled on the `apply-scheduled-plan-changes` idempotency pattern
 * (pre-stamp + attemptCount + failed-state) but keyed by PLAN, not by subscription.
 *
 * Direction is asymmetric (see the HOS-176 spike):
 *   - `decrease` — frictionless: no legal notice, `effectiveAt = now`, propagate
 *     immediately. A stuck target keeps the OLD (higher) amount until reconciled.
 *   - `increase` — Disposición 954/2025 requires PRIOR notice + a grace window, so
 *     `noticeSentAt` is stamped first and `effectiveAt = noticeSentAt + grace`. The
 *     mutation raises `transaction_amount` above the originally-authorized amount —
 *     the direction MP may reject / require re-auth for (spike gating unknown G-1).
 *
 * `oldAmount` / `newAmount` are in integer centavos (the internal money unit, same
 * as `billing_prices.unit_amount`); the MP call converts to major units (÷100).
 */
export const billingPlanPriceChanges = pgTable(
    'billing_plan_price_changes',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        planId: uuid('plan_id')
            .notNull()
            .references(() => billingPlans.id, { onDelete: 'cascade' }),
        priceId: uuid('price_id')
            .notNull()
            .references(() => billingPrices.id, { onDelete: 'cascade' }),
        /** Which price interval changed: `month` | `year`. */
        billingInterval: varchar('billing_interval', { length: 10 }).notNull(),
        /** Previous amount in integer centavos (what MP still charges). */
        oldAmount: integer('old_amount').notNull(),
        /** New amount in integer centavos (source of truth = billing_prices.unit_amount). */
        newAmount: integer('new_amount').notNull(),
        /** `increase` | `decrease` — derived from newAmount vs oldAmount at enqueue. */
        direction: varchar('direction', { length: 10 }).notNull(),
        /**
         * Header lifecycle: `pending` (enqueued) | `noticing` (increase notice sent, in
         * grace — increase path, gated) | `applying` (cron creating/mutating targets) |
         * `superseded` (a newer price change for the same plan+interval replaced it) |
         * `done` (all targets applied) | `failed` (≥1 target `failed`/`skipped`).
         * Plain varchar with NO CHECK constraint on purpose — the propagation cron writes
         * `superseded` and the finalize logic distinguishes `done`/`failed`; do NOT add a
         * CHECK that omits these live values.
         */
        status: varchar('status', { length: 20 }).notNull().default('pending'),
        /** When the advance-notice was sent to affected subscribers (increase only). */
        noticeSentAt: timestamp('notice_sent_at', { withTimezone: true }),
        /** Earliest time the mutation may be applied: `now` (decrease) or notice + grace (increase). */
        effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
        /** Admin actor who triggered the price change (audit; no FK to keep this decoupled). */
        actorId: uuid('actor_id'),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        planPriceChanges_planId_idx: index('planPriceChanges_planId_idx').on(table.planId),
        // "Find due" path for the propagation cron: rows ready to apply.
        // O(pending) — mirrors idx_subscriptions_pending_plan_change.
        planPriceChanges_due_idx: index('planPriceChanges_due_idx')
            .on(table.effectiveAt)
            .where(sql`status IN ('pending', 'applying')`)
    })
);

/**
 * Per-subscriber target of a plan price change (HOS-176).
 *
 * One row per active subscriber affected by a {@link billingPlanPriceChanges} event.
 * The propagation cron applies each target idempotently (pre-stamp `applied` before
 * the MP call, `attemptCount` + `lastError` on failure, `failed` after the retry
 * budget). `targetAmount` is the DISCOUNT-AWARE amount to set (recomputed on the new
 * plan price when the sub has an active multi-cycle discount — never clobber a live
 * discount with the full new price), in integer centavos.
 *
 * Modeled on `billing_dunning_attempts` (per-attempt audit trail keyed by subscription).
 */
export const billingPlanPriceChangeTargets = pgTable(
    'billing_plan_price_change_targets',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        priceChangeId: uuid('price_change_id')
            .notNull()
            .references(() => billingPlanPriceChanges.id, { onDelete: 'cascade' }),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        /** Snapshot of the MP preapproval id at enqueue (targets without one are skipped). */
        mpSubscriptionId: varchar('mp_subscription_id', { length: 255 }),
        /** Discount-aware amount to set on the preapproval, integer centavos. */
        targetAmount: integer('target_amount').notNull(),
        /**
         * Target lifecycle: `pending` (awaiting MP mutation) | `deferred` (amount not yet
         * determinable — discount lookup transiently failing/throwing; reprocessed each tick
         * with an attempt budget) | `applied` (MP updated) | `skipped` (defer budget
         * exhausted — kept the old amount, Sentry-alerted) | `failed` (MP mutation budget
         * exhausted). Plain varchar, NO CHECK — do NOT add one omitting `deferred`/`skipped`.
         */
        status: varchar('status', { length: 20 }).notNull().default('pending'),
        attemptCount: integer('attempt_count').notNull().default(0),
        lastError: text('last_error'),
        lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
        appliedAt: timestamp('applied_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One target per (price change, subscription).
        planPriceChangeTargets_change_sub_uniq: uniqueIndex(
            'planPriceChangeTargets_change_sub_uniq'
        ).on(table.priceChangeId, table.subscriptionId),
        planPriceChangeTargets_priceChangeId_idx: index(
            'planPriceChangeTargets_priceChangeId_idx'
        ).on(table.priceChangeId),
        planPriceChangeTargets_subscriptionId_idx: index(
            'planPriceChangeTargets_subscriptionId_idx'
        ).on(table.subscriptionId),
        // Pending targets the cron still has to apply.
        planPriceChangeTargets_pending_idx: index('planPriceChangeTargets_pending_idx')
            .on(table.priceChangeId)
            .where(sql`status = 'pending'`)
    })
);

export const billingPlanPriceChangesRelations = relations(
    billingPlanPriceChanges,
    ({ one, many }) => ({
        plan: one(billingPlans, {
            fields: [billingPlanPriceChanges.planId],
            references: [billingPlans.id]
        }),
        price: one(billingPrices, {
            fields: [billingPlanPriceChanges.priceId],
            references: [billingPrices.id]
        }),
        targets: many(billingPlanPriceChangeTargets)
    })
);

export const billingPlanPriceChangeTargetsRelations = relations(
    billingPlanPriceChangeTargets,
    ({ one }) => ({
        priceChange: one(billingPlanPriceChanges, {
            fields: [billingPlanPriceChangeTargets.priceChangeId],
            references: [billingPlanPriceChanges.id]
        }),
        subscription: one(billingSubscriptions, {
            fields: [billingPlanPriceChangeTargets.subscriptionId],
            references: [billingSubscriptions.id]
        })
    })
);

/** Type-inferred insert type for billing_plan_price_changes rows. */
export type InsertBillingPlanPriceChange = typeof billingPlanPriceChanges.$inferInsert;
/** Type-inferred select type for billing_plan_price_changes rows. */
export type SelectBillingPlanPriceChange = typeof billingPlanPriceChanges.$inferSelect;
/** Type-inferred insert type for billing_plan_price_change_targets rows. */
export type InsertBillingPlanPriceChangeTarget = typeof billingPlanPriceChangeTargets.$inferInsert;
/** Type-inferred select type for billing_plan_price_change_targets rows. */
export type SelectBillingPlanPriceChangeTarget = typeof billingPlanPriceChangeTargets.$inferSelect;
