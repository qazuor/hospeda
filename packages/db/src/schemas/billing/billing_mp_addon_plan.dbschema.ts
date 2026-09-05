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
import { billingAddons } from '../../billing/index.ts';

/**
 * MercadoPago add-on plan registry (HOS-847 PR 1).
 *
 * Sibling of `billing_mp_plans` (HOS-191) for RECURRING add-ons, not commercial
 * plans. Maps each `(addon, billing_interval)` pair to the MercadoPago
 * `preapproval_plan` its checkout subscribes against. A MercadoPago preapproval
 * carries exactly one `auto_recurring.transaction_amount` and no line items
 * (verified against the adapter's `PreApprovalUpdateBody` type — see
 * `.specs/HOS-847-addons-recurrentes/plan.md` §1.2), so each recurring add-on
 * needs its own preapproval and, transitively, its own `preapproval_plan`.
 *
 * Deliberately NOT a row in `billing_mp_plans`: that table's `commercial_plan_id`
 * is `NOT NULL` with a FK to `billing_plans`, and an add-on is not a commercial
 * plan. Widening that column to nullable would weaken a currently-correct
 * invariant for every existing row just to shoehorn in a different concept.
 *
 * Unlike `billing_mp_plans`, this registry has no `trial_days` dimension: HOS-847
 * add-on provisioning always bakes `trialDays: 0` into the plan (a module-level
 * constant, not a parameter — see PR 3 of the plan) because add-on checkout never
 * offers a free trial. So the uniqueness key is just `(addon, billing_interval)`.
 *
 * This table ships empty and unread in PR 1 — nothing provisions add-on
 * `preapproval_plan`s yet (that's PR 3) and nothing checks out against one yet
 * (that's PR 4, behind `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED`, which stays
 * OFF until PR 8).
 */
export const billingMpAddonPlans = pgTable(
    'billing_mp_addon_plans',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The Hospeda add-on this MP plan projects. */
        addonId: uuid('addon_id')
            .notNull()
            .references(() => billingAddons.id, { onDelete: 'cascade' }),
        /** Billing cadence of this variant: `monthly` | `annual`. */
        billingInterval: varchar('billing_interval', { length: 20 }).notNull(),
        /** The MercadoPago `preapproval_plan` id this variant maps to. */
        mpPreapprovalPlanId: varchar('mp_preapproval_plan_id', { length: 255 }).notNull(),
        /**
         * Snapshot of the add-on price this MP plan was provisioned with, in
         * **ARS** (whole pesos, mirroring `billing_mp_plans.amount_ars`). Used to
         * detect drift between the add-on catalog and the MP plan so provisioning
         * can re-provision when they diverge. Not authoritative — the add-on
         * catalog is.
         */
        amountArs: integer('amount_ars').notNull(),
        /** Registry lifecycle: `active` | `inactive`. */
        status: varchar('status', { length: 20 }).notNull().default('active'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // Exactly one MP plan per (add-on × interval).
        billingMpAddonPlans_variant_uniq: uniqueIndex('billingMpAddonPlans_variant_uniq').on(
            table.addonId,
            table.billingInterval
        ),
        // An MP preapproval_plan id is registered at most once.
        billingMpAddonPlans_mpPreapprovalPlanId_uniq: uniqueIndex(
            'billingMpAddonPlans_mpPreapprovalPlanId_uniq'
        ).on(table.mpPreapprovalPlanId),
        // Provisioning resolves the MP plan id by add-on.
        billingMpAddonPlans_addonId_idx: index('billingMpAddonPlans_addonId_idx').on(table.addonId)
    })
);

export const billingMpAddonPlansRelations = relations(billingMpAddonPlans, ({ one }) => ({
    addon: one(billingAddons, {
        fields: [billingMpAddonPlans.addonId],
        references: [billingAddons.id]
    })
}));

/** Type-inferred insert type for billing_mp_addon_plans rows. */
export type InsertBillingMpAddonPlan = typeof billingMpAddonPlans.$inferInsert;
/** Type-inferred select type for billing_mp_addon_plans rows. */
export type SelectBillingMpAddonPlan = typeof billingMpAddonPlans.$inferSelect;
