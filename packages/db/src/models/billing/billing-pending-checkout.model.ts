import { and, desc, eq, gt, gte, isNull, or } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { billingPendingCheckouts } from '../../schemas/billing/billing_pending_checkout.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Row type inferred from the billing_pending_checkouts table */
type BillingPendingCheckout = typeof billingPendingCheckouts.$inferSelect;

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
 * - {@link findReconcileAssistedByLocalSubscriptionId} — used by the
 *   `abandoned-pending-subs` reaper (HOS-276) to recognize a `pending_provider`
 *   row whose correlation checkout already resolved to `reconcile_assisted` —
 *   a REAL payment that could not be auto-linked, never an abandoned checkout.
 */
export class BillingPendingCheckoutModel extends BaseModelImpl<BillingPendingCheckout> {
    protected table = billingPendingCheckouts;
    public entityName = 'billing_pending_checkouts';

    protected getTableName(): string {
        return 'billing_pending_checkouts';
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
     * Only `status = 'pending'` rows are returned: once a correlation row has
     * been resolved (`linked` / `reconcile_assisted`) it must not be re-resolved
     * by a replayed back_url or webhook (FIX E).
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
                        eq(billingPendingCheckouts.status, 'pending')
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
     * Only `status = 'pending'` rows are returned: an already-resolved row
     * (`linked` / `reconcile_assisted`) must not be re-resolved, and the
     * abandoned-pending-subs reaper relies on this to detect an in-progress
     * Path C checkout (FIX E). Expired rows (`expiresAt <= now`) are also
     * excluded (FIX 4) so a stale correlation can neither resurrect an old
     * subscription nor read as an "in-progress" checkout to the reaper.
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
                        eq(billingPendingCheckouts.status, 'pending'),
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
     * Finds `pending` correlation rows that plausibly match an incoming
     * webhook, for the fallback reconciliation path (used when the
     * `back_url` handler never fired).
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
     * @returns All `pending` rows matching the criteria, most recent first.
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
                        eq(billingPendingCheckouts.status, 'pending'),
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
     * Finds the most recent `reconcile_assisted` correlation row for a given
     * local subscription (HOS-276).
     *
     * Unlike {@link findByLocalSubscriptionId} (which only returns `pending`
     * rows), this deliberately looks for an already-TERMINAL
     * `reconcile_assisted` row — the heuristic (Tier 3) linking path's outcome
     * when it could not positively resolve a single, unambiguous match (see
     * `link-preapproval.service.ts`). That status means a REAL MercadoPago
     * charge landed for this subscription attempt but could not be
     * auto-linked; it is NOT an abandoned checkout, and the
     * `abandoned-pending-subs` reaper must never mark it `abandoned` — it
     * needs manual reconciliation instead. Ordered most-recent-first and
     * limited to one row since a single local subscription can only ever
     * accumulate one live correlation attempt per checkout flow.
     *
     * @param params.localSubscriptionId - The `billing_subscriptions` row id
     *   created in `pending_provider` status for this checkout attempt.
     * @param tx - Optional transaction client.
     * @returns The most recent matching `reconcile_assisted` row, or `null`
     *   if none exists.
     */
    async findReconcileAssistedByLocalSubscriptionId(
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
                        eq(billingPendingCheckouts.status, 'reconcile_assisted')
                    )
                )
                .orderBy(desc(billingPendingCheckouts.createdAt))
                .limit(1);

            const row = rows[0] ?? null;
            try {
                logQuery(
                    this.entityName,
                    'findReconcileAssistedByLocalSubscriptionId',
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
                    'findReconcileAssistedByLocalSubscriptionId',
                    logContext,
                    err
                );
            } catch {}
            throw new DbError(
                this.entityName,
                'findReconcileAssistedByLocalSubscriptionId',
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
}

/** Singleton instance of BillingPendingCheckoutModel for use across the application. */
export const billingPendingCheckoutModel = new BillingPendingCheckoutModel();
