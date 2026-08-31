/**
 * Reconciliation of a local trial window against what MercadoPago actually
 * granted, at the moment the preapproval is created (HOS-936).
 *
 * ## The window this closes
 *
 * Hospeda decides the trial at checkout, per `billing_customers.id`
 * (`resolveCheckoutFreeTrialDays`), and writes `trial_start`/`trial_end` before
 * MercadoPago has said anything. MercadoPago decides it per
 * `(payer, preapproval_plan)`. When those two disagree — a payer who already
 * consumed the trial on a shared plan — the local row promises a free month over
 * a subscription the provider is charging in that same second.
 *
 * Until now that was only discoverable AFTER the charge settled
 * ({@link ./trial-promise-verification | HOS-522}). The measurement behind
 * HOS-936 shows the creation response already carries the answer in
 * `next_payment_date`, so the row can be corrected before the customer is ever
 * shown a free trial they do not have.
 *
 * ## Why it corrects in ONE direction only
 *
 * A `not-granted` verdict revokes the local window; a `granted` one is left
 * alone, and so is `unknown`. That asymmetry is deliberate:
 *
 * - **Revoking is safe and provable.** `next_payment_date` at the creation
 *   instant means MercadoPago is charging now. There is no reading of that under
 *   which a free window exists, so removing ours cannot be wrong.
 * - **Extending or re-anchoring is neither.** MercadoPago counts a granted trial
 *   from the moment the payer AUTHORIZES, which happens after this response is
 *   written, so `next_payment_date` can still move. Re-anchoring `trial_end` to
 *   it would also shift the window
 *   {@link ./trial-promise-verification | classifySettledTrialCharge} measures
 *   its verdict against — trading a bug we measured for one we did not.
 *
 * So this narrows a promise the provider has already refused, and never widens
 * one. Never throws: a checkout MercadoPago accepted must not fail because a
 * best-effort reconciliation could not reach the API.
 *
 * @module services/billing/trial-window-reconcile
 */

import { billingSubscriptions, type DrizzleClient, eq, getDb } from '@repo/db';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { fetchPreapprovalTrialWindow } from '../../utils/mp-preapproval-trial-window.js';

/**
 * What reconciliation did to the local row.
 *
 * - `corrected` — the provider is charging immediately, so the local trial
 *   window was cleared.
 * - `confirmed` — the provider deferred the first charge; the local window
 *   stands untouched.
 * - `no-local-trial` — the row advertised no trial, so there was nothing to
 *   contradict. No provider call is even made.
 * - `indeterminate` — the provider's answer could not be read (network, auth,
 *   missing token, or a response carrying neither date). Nothing was written.
 */
export type TrialWindowReconcileOutcome =
    | 'corrected'
    | 'confirmed'
    | 'no-local-trial'
    | 'indeterminate';

/**
 * Input for {@link reconcileTrialWindowAgainstProvider}.
 */
export interface ReconcileTrialWindowInput {
    /** `billing_subscriptions.id` of the row to reconcile. */
    readonly localSubscriptionId: string;
    /** The MercadoPago preapproval id just created for it. */
    readonly mpPreapprovalId: string;
    /** Drizzle client override. Defaults to `getDb()`. */
    readonly db?: DrizzleClient;
    /** Injection seam for tests. Forwarded to the raw MercadoPago lookup. */
    readonly fetchImpl?: typeof fetch;
}

/**
 * Result of {@link reconcileTrialWindowAgainstProvider}.
 */
export interface ReconcileTrialWindowResult {
    /** What was done. */
    readonly outcome: TrialWindowReconcileOutcome;
    /**
     * `next_payment_date - date_created` in ms, when it could be read. Carried
     * so the caller can log the measurement the verdict rests on.
     */
    readonly deferralMs: number | null;
}

/**
 * Check a freshly-created preapproval's real trial window and clear the local
 * one when MercadoPago is charging immediately.
 *
 * Best-effort and total: never throws, and writes nothing unless the provider
 * positively contradicts the stored window.
 *
 * @param input - The local subscription, its preapproval id, and optional seams.
 * @returns What was done, plus the deferral the verdict was derived from.
 *
 * @example
 * ```ts
 * // Right after `billing.subscriptions.create({ mode: 'paid', ... })`:
 * await reconcileTrialWindowAgainstProvider({
 *   localSubscriptionId: subscription.id,
 *   mpPreapprovalId
 * });
 * ```
 */
export async function reconcileTrialWindowAgainstProvider(
    input: ReconcileTrialWindowInput
): Promise<ReconcileTrialWindowResult> {
    const { localSubscriptionId, mpPreapprovalId, fetchImpl } = input;
    const client = input.db ?? getDb();

    try {
        // Read the stored window FIRST. A row that promises nothing cannot be
        // contradicted, so it does not justify a call to MercadoPago on the
        // checkout hot path.
        const [row] = await client
            .select({
                trialStart: billingSubscriptions.trialStart,
                trialEnd: billingSubscriptions.trialEnd
            })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId))
            .limit(1);

        if (!row || row.trialEnd === null) {
            return { outcome: 'no-local-trial', deferralMs: null };
        }

        const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
        if (!accessToken) {
            apiLogger.warn(
                { localSubscriptionId, mpPreapprovalId },
                'HOS-936: HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN not configured — cannot verify the trial window the provider actually granted'
            );
            return { outcome: 'indeterminate', deferralMs: null };
        }

        const lookup = await fetchPreapprovalTrialWindow({
            preapprovalId: mpPreapprovalId,
            accessToken,
            ...(fetchImpl ? { fetchImpl } : {})
        });

        if (lookup.kind !== 'ok') {
            apiLogger.warn(
                { localSubscriptionId, mpPreapprovalId, lookup: lookup.kind },
                'HOS-936: could not read the preapproval trial window — leaving the local window as promised'
            );
            return { outcome: 'indeterminate', deferralMs: null };
        }

        const { outcome, deferralMs } = lookup.window;

        if (outcome !== 'not-granted') {
            return {
                outcome: outcome === 'granted' ? 'confirmed' : 'indeterminate',
                deferralMs
            };
        }

        // The provider is charging at the creation instant. Clear the window
        // rather than leave the customer looking at a free month that does not
        // exist. `status` is deliberately untouched: entitlements gate on status,
        // never on `trial_end` (the HOS-171 guard), so this narrows the promise
        // without granting or revoking access on its own.
        await client
            .update(billingSubscriptions)
            .set({ trialStart: null, trialEnd: null, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, localSubscriptionId));

        apiLogger.error(
            {
                localSubscriptionId,
                mpPreapprovalId,
                deferralMs,
                promisedTrialEnd: row.trialEnd?.toISOString() ?? null
            },
            'HOS-936: MercadoPago did not grant the free trial we promised (first charge is due at creation) — cleared the local trial window',
            { capture: true }
        );

        return { outcome: 'corrected', deferralMs };
    } catch (err) {
        // A checkout MercadoPago already accepted must not fail because this
        // best-effort reconciliation did. The HOS-522 settled-charge check
        // remains the backstop for exactly this case.
        apiLogger.warn(
            {
                localSubscriptionId,
                mpPreapprovalId,
                error: err instanceof Error ? err.message : String(err)
            },
            'HOS-936: trial-window reconciliation failed — the settled-charge check remains the backstop'
        );
        return { outcome: 'indeterminate', deferralMs: null };
    }
}
