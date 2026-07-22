import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingCustomers, billingSubscriptions } from '../../billing/index.ts';

/**
 * Pending checkout correlation table for the "Path C" MercadoPago share-link
 * checkout (HOS-191).
 *
 * Path C redirects checkout to MercadoPago's hosted share link (`init_point`)
 * for a `preapproval_plan`, instead of creating the preapproval via the API.
 * Because the preapproval is created entirely on MercadoPago's side, Hospeda
 * does not learn its `preapproval_id` synchronously — it only learns it later,
 * via the `back_url` redirect handler (best case) or the
 * `preapproval.created`/`subscription_authorized_payment.created` webhook
 * (fallback, when the customer closes the tab before returning).
 *
 * This table records "the customer clicked the share link for this local
 * pending subscription" BEFORE MercadoPago has any concept of it, so both the
 * `back_url` handler and the webhook can reconcile the eventual
 * `preapproval_id` back to the correct local `billing_subscriptions` row
 * (which was created in `pending_provider` status) and `billing_customers`
 * row.
 *
 * Rows are correlated by:
 * - `nonce` — an anti-IDOR token embedded in the redirect URL / `back_url`
 *   query string, so an attacker cannot replay another customer's checkout
 *   click.
 * - `mpPreapprovalPlanId` + `payerEmail` — the webhook fallback path, used by
 *   {@link findReconcileCandidates} when the `back_url` handler never fires
 *   (e.g. the customer authorizes on MercadoPago but does not get redirected
 *   back, or returns via a stale/cleared session).
 *
 * `pendingDiscount` snapshots a promo code resolved at checkout time, since
 * Path C's redirect flow cannot apply a discount before MercadoPago creates
 * the preapproval — the discount must be applied as a follow-up mutation
 * once the preapproval is known and linked.
 */
export const billingPendingCheckouts = pgTable(
    'billing_pending_checkouts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The `billing_subscriptions` row created in `pending_provider` status for this checkout attempt. */
        localSubscriptionId: uuid('local_subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        /** The `billing_customers` row this checkout belongs to. */
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'cascade' }),
        /** The Hospeda commercial plan id (UUID, stored as varchar — mirrors `billing_subscriptions.plan_id`). */
        planId: varchar('plan_id', { length: 255 }).notNull(),
        /** The MercadoPago `preapproval_plan` id the customer was redirected to. Matched against incoming webhooks. */
        mpPreapprovalPlanId: varchar('mp_preapproval_plan_id', { length: 255 }).notNull(),
        /** Anti-IDOR correlation token embedded in the `back_url` query string. */
        nonce: varchar('nonce', { length: 64 }).notNull(),
        /** Snapshot of the customer's email at checkout time, used as a webhook-fallback reconciliation signal. */
        payerEmail: varchar('payer_email', { length: 255 }),
        /**
         * Snapshot of a promo code resolved at checkout time, applied as a
         * follow-up mutation once the MercadoPago preapproval is linked
         * (Path C cannot apply a discount before the preapproval exists).
         *
         * Shape: `{ promoCodeId: string, finalAmountCentavos: number }`.
         */
        pendingDiscount: jsonb('pending_discount').$type<{
            promoCodeId: string;
            finalAmountCentavos: number;
        }>(),
        /**
         * Snapshot of a `trial_extension` promo code resolved (and granted) at
         * checkout time, whose redemption is DEFERRED to link time (HOS-240).
         * Path C's redirect flow must not record the redemption before the
         * customer authorizes on MercadoPago — otherwise an abandoned checkout
         * permanently burns a capped code (`max_uses`/`max_per_customer`) for a
         * subscription that never activated. Mirrors {@link pendingDiscount}:
         * only when the real preapproval is linked (F2/F3) does
         * `link-preapproval.service.ts` record the redemption (`used_count++`,
         * usage row) and stamp `promo_code_id` on the now-linked subscription.
         *
         * Shape: `{ promoCodeId: string, code: string }`.
         */
        pendingTrialExtension: jsonb('pending_trial_extension').$type<{
            promoCodeId: string;
            code: string;
        }>(),
        /**
         * Correlation lifecycle: `pending` | `linked` | `reconcile_assisted`.
         * There is no `'expired'` status value written anywhere — expiry is
         * enforced by comparing `expiresAt` against "now" at read time (see
         * `findByLocalSubscriptionId`), not by a status transition. A row
         * past its `expiresAt` simply stops resolving while still reading
         * `status = 'pending'`.
         */
        status: varchar('status', { length: 30 }).notNull().default('pending'),
        /** When this correlation row expires and should no longer be matched. */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // The back_url handler resolves the correlation row by its nonce.
        billingPendingCheckouts_nonce_uniq: uniqueIndex('billingPendingCheckouts_nonce_uniq').on(
            table.nonce
        ),
        // Lookups scoped to a customer's in-flight checkouts.
        billingPendingCheckouts_customerId_status_idx: index(
            'billingPendingCheckouts_customerId_status_idx'
        ).on(table.customerId, table.status),
        // The webhook fallback path resolves candidates by MP plan + status.
        billingPendingCheckouts_mpPreapprovalPlanId_status_idx: index(
            'billingPendingCheckouts_mpPreapprovalPlanId_status_idx'
        ).on(table.mpPreapprovalPlanId, table.status)
    })
);

/** Relations for billing_pending_checkouts. */
export const billingPendingCheckoutsRelations = relations(billingPendingCheckouts, ({ one }) => ({
    customer: one(billingCustomers, {
        fields: [billingPendingCheckouts.customerId],
        references: [billingCustomers.id]
    }),
    localSubscription: one(billingSubscriptions, {
        fields: [billingPendingCheckouts.localSubscriptionId],
        references: [billingSubscriptions.id]
    })
}));

/** Type-inferred insert type for billing_pending_checkouts rows. */
export type InsertBillingPendingCheckout = typeof billingPendingCheckouts.$inferInsert;
/** Type-inferred select type for billing_pending_checkouts rows. */
export type SelectBillingPendingCheckout = typeof billingPendingCheckouts.$inferSelect;
