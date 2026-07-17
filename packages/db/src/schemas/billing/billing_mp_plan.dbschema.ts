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
 * Because trial-eligibility is per-customer (one trial per customer for life), a
 * commercial plan needs up to **two** MP plan variants per interval:
 * - `trial`   — carries `auto_recurring.free_trial`, for trial-eligible customers.
 * - `notrial` — no free_trial, for trial-ineligible customers and `hasTrial: false`
 *   plans (first charge is immediate).
 *
 * The provisioning step (uses qzpay's existing `prices` adapter =
 * `POST /preapproval_plan`) creates/updates the MP plan and records its id here;
 * checkout resolves `mp_preapproval_plan_id` from `(commercial_plan_id,
 * billing_interval, trial_variant)` and passes it as the qzpay `providerPriceId`.
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
        /** `trial` (carries free_trial) or `notrial` (immediate first charge). */
        trialVariant: varchar('trial_variant', { length: 10 }).notNull(),
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
         * Free-trial days baked into the MP plan. `0` for `notrial` variants and
         * `hasTrial: false` plans.
         */
        trialDays: integer('trial_days').notNull().default(0),
        /** Registry lifecycle: `active` | `inactive`. */
        status: varchar('status', { length: 20 }).notNull().default('active'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // Exactly one MP plan per (commercial plan × interval × trial variant).
        billingMpPlans_variant_uniq: uniqueIndex('billingMpPlans_variant_uniq').on(
            table.commercialPlanId,
            table.billingInterval,
            table.trialVariant
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
