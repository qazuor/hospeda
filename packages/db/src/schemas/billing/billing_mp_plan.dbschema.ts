import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { billingPlans } from '../../billing/index.ts';

/**
 * MercadoPago plan registry (HOS-191).
 *
 * Maps each Hospeda commercial plan variant to the MercadoPago `preapproval_plan`
 * that checkout subscribes against. The commercial layer (`billing_plans` /
 * `billing_prices`, DB-wins per HOS-39) stays the source of truth for
 * price/limits/entitlements/trialDays; the MP plan is a **projection** of it, and
 * this table is the link between the two.
 *
 * A plan-based subscription's trial length is baked into the MercadoPago plan and
 * is **immutable** once the subscription is authorized (verified in prod, HOS-191
 * SP-3: `transaction_amount` mutates but `free_trial`/`start_date`/
 * `next_payment_date` do not). So each distinct trial length a commercial plan may
 * need becomes its own MP plan variant, keyed by `trial_days`:
 * - `0`  — no `free_trial`; first charge is immediate (trial-ineligible customers,
 *   `hasTrial: false` plans).
 * - `14` — the plan's base trial.
 * - `21`, `28`, … — base trial extended by a `trial_extension` promo (SPEC-262).
 *
 * Variants are **lazily provisioned**: checkout resolves the exact `trial_days`
 * for a customer (0 / base / base + promo extra), looks up
 * `(commercial_plan_id, billing_interval, trial_days)`, and if no MP plan exists
 * yet, creates one via qzpay's `prices` adapter (`POST /preapproval_plan`) and
 * records it here. The resolved `mp_preapproval_plan_id` is then passed to qzpay
 * as the `providerPriceId`.
 */
export const billingMpPlans = pgTable(
    'billing_mp_plans',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The Hospeda commercial plan this MP plan projects. */
        commercialPlanId: uuid('commercial_plan_id')
            .notNull()
            .references(() => billingPlans.id, { onDelete: 'cascade' }),
        /** Billing cadence of this variant: `monthly` | `annual` | `daily`. */
        billingInterval: varchar('billing_interval', { length: 20 }).notNull(),
        /** The MercadoPago `preapproval_plan` id this variant maps to. */
        mpPreapprovalPlanId: varchar('mp_preapproval_plan_id', { length: 255 }).notNull(),
        /**
         * Snapshot of the commercial price this MP plan was provisioned with, in
         * **centavos** (mirrors `billing_prices.unit_amount`). Used to detect drift
         * between the commercial layer and the MP plan so provisioning can `PUT`
         * the new amount when they diverge. Not authoritative — `billing_prices`
         * is.
         */
        amountArs: integer('amount_ars').notNull(),
        /**
         * Free-trial days baked into the MP plan — the discriminating dimension of
         * this registry. `0` = no trial (immediate first charge); the plan's base
         * (e.g. `14`); or base + a `trial_extension` promo (e.g. `21`). Part of the
         * uniqueness key: one MP plan per `(commercial_plan, interval, trial_days)`.
         */
        trialDays: integer('trial_days').notNull().default(0),
        /** Registry lifecycle: `active` | `inactive`. */
        status: varchar('status', { length: 20 }).notNull().default('active'),
        /**
         * RESERVED for the real hosted share link (`init_point`) MercadoPago
         * returns from `POST /preapproval_plan` (HOS-191 Path C).
         *
         * NOT populated today: the qzpay `prices.create` adapter only returns the
         * `preapproval_plan` id string, so nothing writes this column and it is
         * always NULL. The share link is currently built 100% from
         * `mpPreapprovalPlanId` by `buildPreapprovalPlanShareLink`
         * (apps/api/src/services/billing/mp-plan-provisioning.service.ts), which
         * hardcodes the validated MLA prod checkout host. This column exists so a
         * follow-up can capture and persist the provider's own `init_point` once
         * the adapter exposes it — it is NOT a live fallback source and no caller
         * reads it.
         */
        initPoint: varchar('init_point', { length: 500 }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // Exactly one MP plan per (commercial plan × interval × trial length).
        billingMpPlans_variant_uniq: uniqueIndex('billingMpPlans_variant_uniq').on(
            table.commercialPlanId,
            table.billingInterval,
            table.trialDays
        ),
        // An MP preapproval_plan id is registered at most once.
        billingMpPlans_mpPreapprovalPlanId_uniq: uniqueIndex(
            'billingMpPlans_mpPreapprovalPlanId_uniq'
        ).on(table.mpPreapprovalPlanId),
        // Checkout resolves the MP plan id by commercial plan.
        billingMpPlans_commercialPlanId_idx: index('billingMpPlans_commercialPlanId_idx').on(
            table.commercialPlanId
        )
    })
);

export const billingMpPlansRelations = relations(billingMpPlans, ({ one }) => ({
    commercialPlan: one(billingPlans, {
        fields: [billingMpPlans.commercialPlanId],
        references: [billingPlans.id]
    })
}));

/** Type-inferred insert type for billing_mp_plans rows. */
export type InsertBillingMpPlan = typeof billingMpPlans.$inferInsert;
/** Type-inferred select type for billing_mp_plans rows. */
export type SelectBillingMpPlan = typeof billingMpPlans.$inferSelect;
