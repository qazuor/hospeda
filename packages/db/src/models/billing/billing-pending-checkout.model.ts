import { and, desc, eq, gt, gte, inArray, isNull, or } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { billingPendingCheckouts } from '../../schemas/billing/billing_pending_checkout.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Row type inferred from the billing_pending_checkouts table */
type BillingPendingCheckout = typeof billingPendingCheckouts.$inferSelect;

/**
 * Statuses a correlation row can still be resolved from (HOS-276 follow-up).
 *
 * `reconcile_ambiguous` belongs here and `reconcile_assisted` does NOT, and the
 * distinction is the whole point of that status existing:
 *
 * - `reconcile_assisted` is TERMINAL SUCCESS — the heuristic (Tier 3) path
 *   linked this row to a live preapproval. Re-resolving it would re-link an
 *   already-linked payment (FIX E).
 * - `reconcile_ambiguous` is a REFUSAL, not a resolution — Tier 3 saw several
 *   indistinguishable candidates and declined to guess. Nothing was linked, so
 *   the row must stay reachable: a later webhook redelivery (once its rivals
 *   fall out of the reconcile window) or an ownership-verified manual link can
 *   still resolve it.
 *
 * Before this split both cases wrote `reconcile_assisted`, which excluded the
 * refused rows from every candidate query and from
 * {@link BillingPendingCheckoutModel.findByLocalSubscriptionId} — so a real
 * charge could never be recovered, not even by hand (the manual link endpoint
 * answered 422 `not_found`). That is the launch-blocking half of HOS-276 that
 * survived its own fix.
 */
const RESOLVABLE_STATUSES = ['pending', 'reconcile_ambiguous'] as const;

/**
 * Statuses meaning "a real MercadoPago charge landed for this checkout attempt
 * but no local link was written" — the reaper must never bury a subscription
 * whose correlation row reads one of these.
 *
 * `reconcile_assisted` stays in this set for BACKWARD COMPATIBILITY only: rows
 * written before the `reconcile_ambiguous` split conflate "linked heuristically"
 * with "refused", and the safe reading of that ambiguity is the one that does
 * not bury money. New refusals write `reconcile_ambiguous`.
 */
const UNLINKED_CHARGE_STATUSES = ['reconcile_assisted', 'reconcile_ambiguous'] as const;

/**
 * Model for the `billing_pending_checkouts` table (HOS-191 Path C).
 *
 * Extends `BaseModelImpl` for the generic CRUD surface — including the
 * inherited `create(data, tx)`, used to record "the customer clicked the
 * share link" before MercadoPago knows about the preapproval — plus four
 * domain-specific methods used by the share-link checkout linking flow:
 *
 * - {@link findByNonce} — the `back_url` handler's primary lookup.
 * - {@link findByLocalSubscriptionId} — resolves the correlation row for a
 *   given pending local subscription.
 * - {@link findReconcileCandidates} — the webhook fallback path's lookup,
 *   used when the `back_url` handler never fired.
 * - {@link markLinked} / {@link markReconcileAssisted} — the two successful
 *   terminal states (`back_url`-driven vs. webhook-driven reconciliation).
 * - {@link markReconcileAmbiguous} — the REFUSAL state (HOS-276 follow-up):
 *   Tier 3 saw several indistinguishable candidates and declined to guess.
 *   Nothing was linked, so unlike the two above the row stays resolvable.
 * - {@link supersedePendingForCustomerPlan} — retires a customer's earlier
 *   in-flight checkouts for the same MercadoPago plan, so the webhook fallback
 *   never has to choose between two rows it cannot tell apart.
 * - {@link findUnlinkedChargeByLocalSubscriptionId} — used by the
 *   `abandoned-pending-subs` reaper (HOS-276) to recognize a `pending_provider`
 *   row whose correlation checkout holds a REAL payment that could not be
 *   auto-linked, never an abandoned checkout.
 */
export class BillingPendingCheckoutModel extends BaseModelImpl<BillingPendingCheckout> {
    protected table = billingPendingCheckouts;
    public entityName = 'billing_pending_checkouts';

    protected getTableName(): string {
        return 'billingPendingCheckouts';
    }

    /**
     * Finds the correlation row by its anti-IDOR nonce.
     *
     * Primary lookup for both the `back_url` redirect handler and the
     * webhook's Tier 2 exact-nonce match: the nonce is only reachable here
     * once it is already stamped on the live MercadoPago preapproval's
     * `external_reference` — which itself only happens after a Tier 1
     * ownership-verified linking attempt (`findByLocalSubscriptionId`)
     * already positively verified payer identity. In other words, a resolved
     * nonce IS proof of a previously successful identity check.
     *
     * Only rows in {@link RESOLVABLE_STATUSES} are returned: once a correlation
     * row has actually been resolved (`linked` / `reconcile_assisted`) it must
     * not be re-resolved by a replayed back_url or webhook (FIX E). A
     * `reconcile_ambiguous` row was REFUSED, never resolved, so an exact-nonce
     * match — the strongest identity proof of all three tiers — must still be
     * able to rescue it.
     *
     * Deliberately does NOT bound by `expiresAt` (unlike
     * {@link findByLocalSubscriptionId}) — the nonce match is trusted identity
     * proof, not a client-supplied hint, so a late-arriving webhook redelivery
     * (MP retries can land hours after the checkout row's own TTL) must still
     * resolve instead of stranding an already-verified payment as
     * `not_found`. See the module JSDoc's "Idempotency" section and
     * `link-preapproval.service.ts`'s `RECONCILE_WINDOW_MS` doc for the
     * intentional asymmetry across all three resolution tiers.
     *
     * @param params.nonce - The correlation nonce embedded in the `back_url`.
     * @param tx - Optional transaction client.
     * @returns The matching `pending` row, or `null` if none exists.
     */
    async findByNonce(
        params: { nonce: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout | null> {
        const { nonce } = params;
        const db = this.getClient(tx);
        const logContext = { nonce };

        try {
            const rows = await db
                .select()
                .from(billingPendingCheckouts)
                .where(
                    and(
                        eq(billingPendingCheckouts.nonce, nonce),
                        inArray(billingPendingCheckouts.status, RESOLVABLE_STATUSES)
                    )
                )
                .limit(1);

            const row = rows[0] ?? null;
            try {
                logQuery(this.entityName, 'findByNonce', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByNonce', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByNonce', logContext, err.message);
        }
    }

    /**
     * Finds the correlation row for a given local pending subscription.
     *
     * Only rows in {@link RESOLVABLE_STATUSES} are returned: an already-resolved
     * row (`linked` / `reconcile_assisted`) must not be re-resolved, and the
     * abandoned-pending-subs reaper relies on this to detect an in-progress
     * Path C checkout (FIX E). A `reconcile_ambiguous` row IS returned — it was
     * refused, not resolved, and this lookup is the ownership-verified (Tier 1)
     * path that can still rescue it, including the manual link endpoint.
     * Expired rows (`expiresAt <= now`) are still excluded (FIX 4) so a stale
     * correlation can neither resurrect an old subscription nor read as an
     * "in-progress" checkout to the reaper.
     *
     * @param params.localSubscriptionId - The `billing_subscriptions` row id
     *   created in `pending_provider` status for this checkout attempt.
     * @param tx - Optional transaction client.
     * @returns The matching unexpired `pending` row, or `null` if none exists.
     */
    async findByLocalSubscriptionId(
        params: { localSubscriptionId: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout | null> {
        const { localSubscriptionId } = params;
        const db = this.getClient(tx);
        const logContext = { localSubscriptionId };

        try {
            const rows = await db
                .select()
                .from(billingPendingCheckouts)
                .where(
                    and(
                        eq(billingPendingCheckouts.localSubscriptionId, localSubscriptionId),
                        inArray(billingPendingCheckouts.status, RESOLVABLE_STATUSES),
                        gt(billingPendingCheckouts.expiresAt, new Date())
                    )
                )
                .limit(1);

            const row = rows[0] ?? null;
            try {
                logQuery(this.entityName, 'findByLocalSubscriptionId', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByLocalSubscriptionId', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'findByLocalSubscriptionId',
                logContext,
                err.message
            );
        }
    }

    /**
     * Finds unresolved correlation rows ({@link RESOLVABLE_STATUSES}) that
     * plausibly match an incoming webhook, for the fallback reconciliation path
     * (used when the `back_url` handler never fired).
     *
     * Matches by MercadoPago `preapproval_plan` id and, when a `payerEmail`
     * is provided, further narrows by the snapshotted payer email. Only
     * considers rows created at or after `since` to avoid matching stale
     * checkout attempts — this is a deliberately WIDE safety net (unbounded
     * by `expiresAt`, unlike {@link findByLocalSubscriptionId}'s Tier 1):
     * this path has no unforgeable nonce or client-asserted id to trust, so
     * the `since` window plus a positive email match are the only signals
     * available, intentionally looser than the other two resolution tiers.
     *
     * @param params.mpPreapprovalPlanId - The MercadoPago `preapproval_plan`
     *   id reported by the webhook.
     * @param params.payerEmail - The payer email reported by the webhook, if
     *   available. When provided, candidates are narrowed to rows whose
     *   snapshotted `payerEmail` matches (or is unset).
     * @param params.since - Only consider rows created at or after this
     *   timestamp.
     * @param tx - Optional transaction client.
     * @returns All unresolved rows matching the criteria, most recent first.
     */
    async findReconcileCandidates(
        params: { mpPreapprovalPlanId: string; payerEmail?: string; since: Date },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout[]> {
        const { mpPreapprovalPlanId, payerEmail, since } = params;
        const db = this.getClient(tx);
        const logContext = { mpPreapprovalPlanId, payerEmail, since };

        try {
            const rows = await db
                .select()
                .from(billingPendingCheckouts)
                .where(
                    and(
                        eq(billingPendingCheckouts.mpPreapprovalPlanId, mpPreapprovalPlanId),
                        inArray(billingPendingCheckouts.status, RESOLVABLE_STATUSES),
                        gte(billingPendingCheckouts.createdAt, since),
                        payerEmail
                            ? or(
                                  eq(billingPendingCheckouts.payerEmail, payerEmail),
                                  isNull(billingPendingCheckouts.payerEmail)
                              )
                            : undefined
                    )
                )
                .orderBy(desc(billingPendingCheckouts.createdAt));

            try {
                logQuery(this.entityName, 'findReconcileCandidates', logContext, rows);
            } catch {}
            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findReconcileCandidates', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findReconcileCandidates', logContext, err.message);
        }
    }

    /**
     * Finds the most recent correlation row for a local subscription whose
     * status means "a real charge landed here and nothing was linked"
     * ({@link UNLINKED_CHARGE_STATUSES}, HOS-276).
     *
     * Unlike {@link findByLocalSubscriptionId}, this deliberately looks past
     * the resolvable statuses: the `abandoned-pending-subs` reaper must never
     * mark such a subscription `abandoned` — that is money already charged with
     * nowhere to land, needing manual reconciliation, not a dead checkout.
     * Ordered most-recent-first and limited to one row since a single local
     * subscription only ever accumulates one live correlation attempt per
     * checkout flow.
     *
     * Named for the CONDITION rather than for one status value on purpose: it
     * matches two statuses, and the older `reconcile_assisted` name asserted
     * more than the predicate checks.
     *
     * @param params.localSubscriptionId - The `billing_subscriptions` row id
     *   created in `pending_provider` status for this checkout attempt.
     * @param tx - Optional transaction client.
     * @returns The most recent matching row, or `null` if none exists.
     */
    async findUnlinkedChargeByLocalSubscriptionId(
        params: { localSubscriptionId: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout | null> {
        const { localSubscriptionId } = params;
        const db = this.getClient(tx);
        const logContext = { localSubscriptionId };

        try {
            const rows = await db
                .select()
                .from(billingPendingCheckouts)
                .where(
                    and(
                        eq(billingPendingCheckouts.localSubscriptionId, localSubscriptionId),
                        inArray(billingPendingCheckouts.status, UNLINKED_CHARGE_STATUSES)
                    )
                )
                .orderBy(desc(billingPendingCheckouts.createdAt))
                .limit(1);

            const row = rows[0] ?? null;
            try {
                logQuery(
                    this.entityName,
                    'findUnlinkedChargeByLocalSubscriptionId',
                    logContext,
                    row
                );
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(
                    this.entityName,
                    'findUnlinkedChargeByLocalSubscriptionId',
                    logContext,
                    err
                );
            } catch {}
            throw new DbError(
                this.entityName,
                'findUnlinkedChargeByLocalSubscriptionId',
                logContext,
                err.message
            );
        }
    }

    /**
     * Marks a correlation row as successfully linked via the `back_url`
     * redirect handler.
     *
     * @param params.id - The correlation row id.
     * @param tx - Optional transaction client.
     * @returns The updated row, or `null` if no matching row exists.
     */
    async markLinked(
        params: { id: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout | null> {
        const { id } = params;
        const db = this.getClient(tx);
        const logContext = { id };

        try {
            const rows = await db
                .update(billingPendingCheckouts)
                .set({ status: 'linked', updatedAt: new Date() })
                .where(eq(billingPendingCheckouts.id, id))
                .returning();

            const row = rows[0] ?? null;
            try {
                logQuery(this.entityName, 'markLinked', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'markLinked', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'markLinked', logContext, err.message);
        }
    }

    /**
     * Marks a correlation row as linked via the webhook fallback
     * reconciliation path (the `back_url` handler never fired).
     *
     * @param params.id - The correlation row id.
     * @param tx - Optional transaction client.
     * @returns The updated row, or `null` if no matching row exists.
     */
    async markReconcileAssisted(
        params: { id: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout | null> {
        const { id } = params;
        const db = this.getClient(tx);
        const logContext = { id };

        try {
            const rows = await db
                .update(billingPendingCheckouts)
                .set({ status: 'reconcile_assisted', updatedAt: new Date() })
                .where(eq(billingPendingCheckouts.id, id))
                .returning();

            const row = rows[0] ?? null;
            try {
                logQuery(this.entityName, 'markReconcileAssisted', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'markReconcileAssisted', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'markReconcileAssisted', logContext, err.message);
        }
    }

    /**
     * Marks a correlation row as REFUSED by the heuristic (Tier 3) path
     * because it could not be told apart from a rival candidate.
     *
     * Deliberately NOT {@link markReconcileAssisted}: nothing was linked here.
     * Writing the success status on a refusal is what made HOS-276 unrecoverable
     * — it dropped the row out of every candidate query and out of
     * {@link findByLocalSubscriptionId}, so neither a webhook redelivery nor the
     * manual link endpoint could ever reach the charge again. This status keeps
     * the row resolvable ({@link RESOLVABLE_STATUSES}) while still telling the
     * `abandoned-pending-subs` reaper that real money may be involved
     * ({@link UNLINKED_CHARGE_STATUSES}).
     *
     * @param params.id - The correlation row id.
     * @param tx - Optional transaction client.
     * @returns The updated row, or `null` if no matching row exists.
     */
    async markReconcileAmbiguous(
        params: { id: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout | null> {
        const { id } = params;
        const db = this.getClient(tx);
        const logContext = { id };

        try {
            const rows = await db
                .update(billingPendingCheckouts)
                .set({ status: 'reconcile_ambiguous', updatedAt: new Date() })
                .where(eq(billingPendingCheckouts.id, id))
                .returning();

            const row = rows[0] ?? null;
            try {
                logQuery(this.entityName, 'markReconcileAmbiguous', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'markReconcileAmbiguous', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'markReconcileAmbiguous', logContext, err.message);
        }
    }

    /**
     * Retires a customer's still-unresolved checkouts for one MercadoPago plan,
     * so a new attempt for the same pair leaves exactly one live correlation row
     * (HOS-276 follow-up).
     *
     * This is the DETERMINISTIC half of the ambiguity fix. The webhook fallback
     * (Tier 3) can only tell candidates apart by `mp_preapproval_plan_id` +
     * payer email + a 24h window — and a customer who retries after a declined
     * card produces two rows identical on all three. Tier 3 then refuses, and a
     * real approved payment has nowhere to land. Rather than teach the heuristic
     * to guess better, this removes the ambiguity at the source: only the newest
     * attempt stays resolvable.
     *
     * Scoped to `(customerId, mpPreapprovalPlanId)` because that is the exact
     * pair {@link findReconcileCandidates} groups by — a customer's checkouts
     * for a DIFFERENT plan never collide there and must not be retired.
     *
     * Must run in the SAME transaction as the new row's insert, so the two rows
     * can never both be live.
     *
     * @param params.customerId - The `billing_customers` row id.
     * @param params.mpPreapprovalPlanId - The MercadoPago `preapproval_plan` id.
     * @param tx - Optional transaction client.
     * @returns The rows that were superseded (empty on the common first-attempt
     *   path).
     */
    async supersedePendingForCustomerPlan(
        params: { customerId: string; mpPreapprovalPlanId: string },
        tx?: DrizzleClient
    ): Promise<BillingPendingCheckout[]> {
        const { customerId, mpPreapprovalPlanId } = params;
        const db = this.getClient(tx);
        const logContext = { customerId, mpPreapprovalPlanId };

        try {
            const rows = await db
                .update(billingPendingCheckouts)
                .set({ status: 'superseded', updatedAt: new Date() })
                .where(
                    and(
                        eq(billingPendingCheckouts.customerId, customerId),
                        eq(billingPendingCheckouts.mpPreapprovalPlanId, mpPreapprovalPlanId),
                        inArray(billingPendingCheckouts.status, RESOLVABLE_STATUSES)
                    )
                )
                .returning();

            try {
                logQuery(this.entityName, 'supersedePendingForCustomerPlan', logContext, rows);
            } catch {}
            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'supersedePendingForCustomerPlan', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'supersedePendingForCustomerPlan',
                logContext,
                err.message
            );
        }
    }
}

/** Singleton instance of BillingPendingCheckoutModel for use across the application. */
export const billingPendingCheckoutModel = new BillingPendingCheckoutModel();
