/**
 * MercadoPago plan provisioning (HOS-191).
 *
 * Projects a Hospeda commercial plan variant onto a MercadoPago `preapproval_plan`
 * and records the mapping in `billing_mp_plans`. Because a plan-based
 * subscription's trial length is **immutable** once authorized (verified in prod,
 * HOS-191 SP-3: `transaction_amount` mutates but `free_trial`/`start_date`/
 * `next_payment_date` do not), each distinct trial length needs its own MP plan.
 * Variants are keyed by `(commercial_plan_id, billing_interval, trial_days)` and
 * provisioned **lazily** on first use at checkout.
 *
 * The registry is a projection of the commercial layer (`billing_plans` /
 * `billing_prices`, DB-wins per HOS-39) — never the source of truth. `amount_ars`
 * is a snapshot used to detect drift; when the commercial price changes, the next
 * `resolveOrProvisionMpPlan` re-provisions (creates a fresh MP plan at the new
 * amount and archives the stale one) so new checkouts always charge the current
 * price. Existing subscriptions keep the amount they were authorized at.
 *
 * @module services/billing/mp-plan-provisioning
 */

import type {
    QZPayBillingInterval,
    QZPayCreatePriceInput,
    QZPayCurrency,
    QZPayPaymentAdapter
} from '@qazuor/qzpay-core';
import { applyTestControl } from '@repo/billing';
import { billingMpPlanModel } from '@repo/db';
import { getBillingPaymentAdapter } from '../../middlewares/billing.js';
import { apiLogger } from '../../utils/logger.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Hospeda billing cadence label. `monthly` / `annual` are the real plan cadences;
 * `daily` exists only for the hidden `TEST_DAILY_PLAN` QA tool (a 1-day recurring
 * cycle so staff can validate dunning/webhook/cron timing without waiting a month).
 */
export type BillingIntervalLabel = 'monthly' | 'annual' | 'daily';

/**
 * Input for {@link resolveOrProvisionMpPlan}.
 */
export interface ResolveOrProvisionMpPlanInput {
    /**
     * The MercadoPago payment adapter (from `getBillingPaymentAdapter()`). Its
     * `prices` slot wraps `POST /preapproval_plan`.
     */
    readonly adapter: QZPayPaymentAdapter;
    /** The Hospeda commercial plan (`billing_plans.id`, a UUID) being projected. */
    readonly commercialPlanId: string;
    /** Billing cadence of this variant. */
    readonly billingInterval: BillingIntervalLabel;
    /**
     * Free-trial days baked into the MP plan — the discriminating dimension.
     * `0` = no trial (immediate first charge); the plan's base (e.g. `14`); or
     * base + a `trial_extension` promo (e.g. `21`).
     */
    readonly trialDays: number;
    /**
     * Current commercial FULL price for this variant, in **centavos** (matches
     * `billing_prices.unit_amount`). Stored as the drift snapshot (`amount_ars`)
     * and used as the MP plan amount when there is NO signup discount.
     */
    readonly amountCentavos: number;
    /**
     * Cycle-1 discounted amount to bake into the MP plan, in **centavos**
     * (HOS-244). `0` (default sentinel) = no signup discount → the plan is
     * provisioned at the full `amountCentavos` (historical behavior). A non-zero
     * value = provision the MP plan's `transaction_amount` ALREADY discounted, so
     * the customer sees and pays the discounted cycle-1 price on MercadoPago and
     * cycle 1 is charged correctly without a post-authorization mutation race. It
     * is a second dimension of the registry key: `(commercial_plan, interval,
     * trial_days, discount_cycle1_amount)`. `amountCentavos` (the full price) stays
     * the drift snapshot regardless.
     */
    readonly discountCycle1AmountCentavos: number;
    /** ISO currency code (e.g. `'ARS'`). */
    readonly currency: string;
    /** Human-readable plan name, used as the MP plan `reason` (dashboard label). */
    readonly planName: string;
    /**
     * Absolute `http(s)` return URL MercadoPago **requires** when creating a
     * `preapproval_plan` (`POST /preapproval_plan`). Passed through to
     * `QZPayCreatePriceInput.backUrl` (qzpay-mercadopago 2.5.0): the adapter needs
     * either this per-call value or an adapter-level `defaultPlanBackUrl`, and
     * rejects the call early — before hitting MercadoPago — when neither resolves
     * to a valid absolute URL, instead of surfacing MP's opaque "Back url is
     * required" 400. Hospeda does not configure `defaultPlanBackUrl`, so this
     * required field is what guarantees the plan always gets one. It is the same
     * URL the checkout later uses as the preapproval's `back_url`.
     */
    readonly backUrl: string;
}

/**
 * Result of {@link resolveOrProvisionMpPlan}.
 */
export interface ResolveOrProvisionMpPlanResult {
    /** The MercadoPago `preapproval_plan` id to subscribe against. */
    readonly mpPreapprovalPlanId: string;
    /**
     * `true` when this call created a new MP plan (first use of the variant, or a
     * re-provision after price drift); `false` on a registry hit.
     */
    readonly created: boolean;
}

/**
 * Map the Hospeda cadence label to the qzpay billing interval the MercadoPago
 * price adapter expects. `'annual'` maps to `'year'`, which the adapter turns
 * into MercadoPago's `frequency: 12, frequency_type: 'months'`.
 */
function toQZPayBillingInterval(interval: BillingIntervalLabel): QZPayBillingInterval {
    if (interval === 'annual') return 'year';
    if (interval === 'daily') return 'day';
    return 'month';
}

/**
 * Spanish labels for each billing cadence. This `reason` string is shown to the
 * buyer on the MercadoPago checkout/dashboard, and Hospeda's default locale is
 * `es` (Argentina market), so it must not leak the English cadence literals.
 */
const BILLING_INTERVAL_LABELS_ES: Record<BillingIntervalLabel, string> = {
    monthly: 'mensual',
    annual: 'anual',
    daily: 'diario'
};

/**
 * Build the MercadoPago plan `reason` (its buyer- and dashboard-visible name).
 * Kept descriptive and deterministic so operators can identify a variant at a
 * glance. Rendered in Spanish (Hospeda's default locale) — the `planName` is a
 * brand display name (e.g. `Plus`) and is left as-is.
 */
function buildPlanReason(input: {
    planName: string;
    billingInterval: BillingIntervalLabel;
    trialDays: number;
    discountCycle1AmountCentavos?: number;
}): string {
    const intervalLabel = BILLING_INTERVAL_LABELS_ES[input.billingInterval];
    const trialLabel = input.trialDays > 0 ? `${input.trialDays} días de prueba` : 'sin prueba';
    // HOS-244: mark discounted variants so operators can tell them apart from the
    // full-price plan in the MercadoPago dashboard. Only appended when discounted.
    const discountLabel =
        input.discountCycle1AmountCentavos && input.discountCycle1AmountCentavos > 0
            ? ` — desc. 1er ciclo $${(input.discountCycle1AmountCentavos / 100).toFixed(2)}`
            : '';
    return `${input.planName} — ${intervalLabel} — ${trialLabel}${discountLabel}`;
}

/**
 * Create a fresh MercadoPago `preapproval_plan` for the given variant and return
 * its id. Delegates to qzpay's `prices` adapter (`POST /preapproval_plan`), which
 * bakes the `free_trial` into the plan when `trialDays > 0` and omits
 * `billing_day` so billing follows the rolling anniversary (HOS-191).
 */
async function createMpPlan(input: ResolveOrProvisionMpPlanInput): Promise<string> {
    // HOS-244: bake the discounted cycle-1 amount when a signup discount applies
    // (sentinel 0 = no discount → full commercial price). This is what makes the
    // preapproval born at the discounted price instead of being PUT-down reactively
    // after authorization.
    const bakedAmount =
        input.discountCycle1AmountCentavos > 0
            ? input.discountCycle1AmountCentavos
            : input.amountCentavos;
    const priceInput: QZPayCreatePriceInput = {
        // The MercadoPago price adapter ignores `planId` (a preapproval_plan is
        // self-contained), but the qzpay contract requires it; pass the commercial
        // plan id for traceability.
        planId: input.commercialPlanId,
        currency: input.currency as QZPayCurrency,
        unitAmount: bakedAmount,
        billingInterval: toQZPayBillingInterval(input.billingInterval),
        intervalCount: 1,
        // `0` is falsy, so the adapter omits `free_trial` for the no-trial variant.
        trialDays: input.trialDays,
        // MercadoPago requires a `back_url` on preapproval_plan creation; qzpay
        // fails fast (before the MP call) if it is absent or not absolute.
        backUrl: input.backUrl
    };
    const reason = buildPlanReason({
        planName: input.planName,
        billingInterval: input.billingInterval,
        trialDays: input.trialDays,
        discountCycle1AmountCentavos: input.discountCycle1AmountCentavos
    });
    return input.adapter.prices.create(priceInput, reason);
}

/**
 * Resolve the MercadoPago `preapproval_plan` id for a commercial plan variant,
 * provisioning it on MercadoPago and recording it in `billing_mp_plans` if it does
 * not exist yet. Idempotent and safe under concurrent checkouts.
 *
 * Resolution:
 * 1. **Registry hit, amount matches** → return the stored id (no MP call).
 * 2. **Registry hit, amount drifted** → create a fresh MP plan at the current
 *    amount, archive the stale one (best-effort), update the row, return the new id.
 * 3. **Miss** → create the MP plan, insert the row. If a concurrent checkout won
 *    the insert race (unique constraint on `(commercial_plan_id, billing_interval,
 *    trial_days)`), archive our just-created orphan plan and return the winner's id.
 *
 * @param input - Adapter, commercial plan variant key, current price, and label.
 * @returns The resolved `mp_preapproval_plan_id` and whether it was created here.
 * @throws Rethrows a genuine insert failure (one not explained by the race).
 *
 * @example
 * ```ts
 * const adapter = getBillingPaymentAdapter();
 * if (!adapter) throw new Error('billing unavailable');
 * const { mpPreapprovalPlanId } = await resolveOrProvisionMpPlan({
 *   adapter,
 *   commercialPlanId: plan.id,
 *   billingInterval: 'monthly',
 *   trialDays: 14,
 *   amountCentavos: monthlyPrice.unitAmount,
 *   currency: monthlyPrice.currency,
 *   planName: plan.name,
 *   backUrl: urls.paymentMethodReturnUrl
 * });
 * ```
 */
export async function resolveOrProvisionMpPlan(
    input: ResolveOrProvisionMpPlanInput
): Promise<ResolveOrProvisionMpPlanResult> {
    const key = {
        commercialPlanId: input.commercialPlanId,
        billingInterval: input.billingInterval,
        trialDays: input.trialDays,
        // HOS-244: the cycle-1 discount is a second key dimension (0 = no discount).
        discountCycle1AmountArs: input.discountCycle1AmountCentavos
    };

    const existing = await billingMpPlanModel.findOne(key);

    // 1. Registry hit at the current amount and still active → reuse.
    if (existing && existing.amountArs === input.amountCentavos && existing.status === 'active') {
        return { mpPreapprovalPlanId: existing.mpPreapprovalPlanId, created: false };
    }

    // 2. Registry hit but the commercial price drifted (or the row was inactive):
    // re-provision at the current amount and retire the stale MP plan.
    if (existing) {
        const newId = await createMpPlan(input);
        // Compare-and-swap: only win the update if the row STILL points at the
        // plan we read. A concurrent drift re-provision for the same variant will
        // have swapped `mp_preapproval_plan_id` already, so our conditional update
        // matches 0 rows (returns null) — an UPDATE has no unique constraint to
        // collide on, so without this guard both requests would "succeed", the
        // loser's freshly-created MP plan would be orphaned, and last-write-wins
        // would silently pick one.
        const updated = await billingMpPlanModel.update(
            { id: existing.id, mpPreapprovalPlanId: existing.mpPreapprovalPlanId },
            {
                mpPreapprovalPlanId: newId,
                amountArs: input.amountCentavos,
                status: 'active'
            }
        );
        if (!updated) {
            // Lost the CAS: another request re-provisioned first. Find the winner,
            // THEN archive our new plan as the orphan. Order matters: if the row
            // has somehow vanished (pathological — nothing deletes billing_mp_plans
            // today), we keep our freshly-created plan as the live one instead of
            // archiving the very id we are about to hand back.
            const winner = await billingMpPlanModel.findOne(key);
            if (winner) {
                await archiveMpPlanBestEffort(input.adapter, newId, 'lost-race');
                return { mpPreapprovalPlanId: winner.mpPreapprovalPlanId, created: false };
            }
            return { mpPreapprovalPlanId: newId, created: true };
        }
        // We won the swap: retire the stale plan we just replaced.
        await archiveMpPlanBestEffort(input.adapter, existing.mpPreapprovalPlanId, 'drift');
        apiLogger.info(
            {
                commercialPlanId: input.commercialPlanId,
                billingInterval: input.billingInterval,
                trialDays: input.trialDays,
                oldMpPlanId: existing.mpPreapprovalPlanId,
                newMpPlanId: newId
            },
            'HOS-191: re-provisioned MP plan after price drift'
        );
        return { mpPreapprovalPlanId: newId, created: true };
    }

    // 3. Miss → provision, then insert. The unique constraint on the variant key
    // makes the insert the concurrency guard.
    const newId = await createMpPlan(input);
    try {
        await billingMpPlanModel.create({
            commercialPlanId: input.commercialPlanId,
            billingInterval: input.billingInterval,
            trialDays: input.trialDays,
            // HOS-244: persist the discount dimension (0 = no discount).
            discountCycle1AmountArs: input.discountCycle1AmountCentavos,
            mpPreapprovalPlanId: newId,
            amountArs: input.amountCentavos,
            status: 'active'
        });
        return { mpPreapprovalPlanId: newId, created: true };
    } catch (insertErr) {
        // A concurrent checkout for the same variant likely won the insert. Re-read
        // the winner; if present, our just-created MP plan is an orphan — archive it
        // and use the winner's id so both requests converge on one plan.
        const winner = await billingMpPlanModel.findOne(key);
        if (winner) {
            await archiveMpPlanBestEffort(input.adapter, newId, 'lost-race');
            return { mpPreapprovalPlanId: winner.mpPreapprovalPlanId, created: false };
        }
        // No winner row exists → the failure was not the race. Surface it.
        throw insertErr;
    }
}

/**
 * Input for {@link resolveCheckoutMpPlanId}.
 */
export interface ResolveCheckoutMpPlanIdInput {
    /** The Hospeda commercial plan (`billing_plans.id`, a UUID). */
    readonly commercialPlanId: string;
    /** Human-readable plan name, used as the MP plan `reason` (dashboard label). */
    readonly planName: string;
    /** Current commercial FULL price for this variant, in centavos. */
    readonly amountCentavos: number;
    /**
     * Cycle-1 discounted amount in centavos (HOS-244), or `0` for no signup
     * discount. When non-zero the resolved MP plan is provisioned at this amount
     * so the preapproval is born discounted. Optional for backward-compat with
     * non-discount callers; defaults to `0`.
     */
    readonly discountCycle1AmountCentavos?: number;
    /** ISO currency code (e.g. `'ARS'`). */
    readonly currency: string;
    /** Billing cadence of this variant. */
    readonly billingInterval: BillingIntervalLabel;
    /** Resolved free-trial days (`0` = no trial, base, or base + promo extension). */
    readonly trialDays: number;
    /**
     * Absolute `http(s)` return URL required to create the MercadoPago
     * `preapproval_plan`. Callers pass the same URL that becomes the
     * preapproval's `back_url` (the checkout success page).
     */
    readonly backUrl: string;
    /**
     * The billing customer id initiating this checkout. Used ONLY as the
     * E2E test-control scope for the `provisionPlan` seam (HOS-191 resilience
     * specs), so a `failNext({ operation: 'provisionPlan', scope: customerId })`
     * only fails THIS customer's checkout and parallel workers do not consume
     * each other's armed failures. Omit outside the checkout callers — an
     * unscoped seam entry then matches any caller (backward-compat). Inert in
     * production (`applyTestControl` is a passthrough unless the test-control
     * gate is enabled).
     */
    readonly customerId?: string;
}

/**
 * Resolve the MercadoPago `preapproval_plan` id a checkout should subscribe
 * against, acquiring the payment adapter from the billing middleware and
 * provisioning the variant on first use (HOS-191).
 *
 * This is the single entry point every card-first checkout flow uses, so the
 * whole "get adapter → resolve/provision plan" step can be mocked at one boundary
 * in tests. It throws a typed, HTTP-mappable checkout error when the adapter is
 * unavailable, so the checkout surfaces a 502 rather than a raw 500.
 *
 * @param input - Commercial plan variant key, current price, and label.
 * @returns The `mp_preapproval_plan_id` to pass to `createPaidSubscription`.
 * @throws SubscriptionCheckoutError `MP_PLAN_PROVISIONING_FAILED` when the payment
 *   adapter is unavailable (billing not configured / in init backoff).
 */
export async function resolveCheckoutMpPlanId(
    input: ResolveCheckoutMpPlanIdInput
): Promise<string> {
    const adapter = getBillingPaymentAdapter();
    if (!adapter) {
        throw new SubscriptionCheckoutError(
            'MP_PLAN_PROVISIONING_FAILED',
            'Billing payment adapter is unavailable — cannot resolve the MercadoPago plan.'
        );
    }
    try {
        // The resolve/provision step is wrapped in the E2E test-control seam
        // (HOS-191). `applyTestControl` consumes a queued `provisionPlan` failure
        // by throwing BEFORE it invokes `resolveOrProvisionMpPlan`, so the
        // `billing_mp_plans` cache lookup inside that call never runs and the
        // failure fires deterministically whether or not the variant is already
        // provisioned. That determinism is the whole point: the lazy, per-variant,
        // shared-across-customers cache fires the underlying `prices.create` at
        // most once per variant, so a seam at the adapter level could not be forced
        // to fail per-test. This is the ONLY provider call the accommodation
        // checkout makes, and the resilience specs (HOST-07c, RES-01) arm a failure
        // here. Scoped by `customerId` so parallel E2E workers don't consume each
        // other's failures. Inert in production: `applyTestControl` returns
        // `realCall()` untouched unless HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'.
        const { mpPreapprovalPlanId } = (await applyTestControl(
            'provisionPlan',
            { customerId: input.customerId },
            () =>
                resolveOrProvisionMpPlan({
                    adapter,
                    commercialPlanId: input.commercialPlanId,
                    billingInterval: input.billingInterval,
                    trialDays: input.trialDays,
                    amountCentavos: input.amountCentavos,
                    // HOS-244: default 0 = no discount (backward-compat).
                    discountCycle1AmountCentavos: input.discountCycle1AmountCentavos ?? 0,
                    currency: input.currency,
                    planName: input.planName,
                    backUrl: input.backUrl
                })
        )) as ResolveOrProvisionMpPlanResult;
        return mpPreapprovalPlanId;
    } catch (err) {
        // A provisioning failure (MP `prices.create` error, a registry read/write
        // failure, or the E2E seam's injected failure) must surface as the typed,
        // retryable 502 the error code documents — not a raw 500. An already-typed
        // checkout error (the adapter-unavailable case above) passes through.
        if (err instanceof SubscriptionCheckoutError) throw err;
        const message = err instanceof Error ? err.message : String(err);
        throw new SubscriptionCheckoutError(
            'MP_PLAN_PROVISIONING_FAILED',
            `Could not resolve or provision the MercadoPago plan: ${message}`
        );
    }
}

/**
 * Input for {@link buildPreapprovalPlanShareLink}.
 */
export interface BuildPreapprovalPlanShareLinkInput {
    /** The MercadoPago `preapproval_plan` id to build a hosted checkout link for. */
    readonly mpPreapprovalPlanId: string;
    /**
     * The pending checkout's anti-IDOR `nonce` (HOS-209). When provided it is
     * appended to the hosted-checkout URL as `external_reference`, so
     * MercadoPago stamps it on whichever preapproval the customer authorizes on
     * that page — making the nonce present on the preapproval FROM THE START,
     * before any `back_url` return or webhook.
     *
     * Why this matters: the `preapproval_plan_id` is shared across every buyer
     * of the same plan/interval/trial variant, so a webhook-only (F3) linking
     * with multiple concurrent pending checkouts for the same customer+plan
     * falls back to heuristic reconciliation and can refuse ambiguous
     * candidates (observed in prod, SMOKE-19-07). A per-checkout
     * `external_reference` lets the linker resolve by exact-nonce (Tier 2)
     * immediately, independent of whether the browser ever returns.
     *
     * The post-hoc `adapter.subscriptions.update({ externalReference })` in
     * `link-preapproval.service.ts` (Step 4) remains as a fallback for the case
     * MercadoPago does not honor the URL param — this is belt-and-suspenders.
     * Whether MP actually stamps it is deferred to a real-MP smoke (HOS-174).
     */
    readonly externalReference?: string;
}

/**
 * Build MercadoPago's HOSTED share-link URL for a `preapproval_plan` (HOS-191
 * Path C). The customer completes card collection and preapproval authorization
 * entirely on this page — Hospeda never sees the card and creates no
 * `POST /preapproval` server-side, which is what avoids the "card_token_id is
 * required" rejection a server-side `preapproval_plan_id` create hits.
 *
 * The host (`mercadopago.com.ar`) is hardcoded to MercadoPago Argentina (MLA)
 * prod, matching the account Hospeda operates under; this is not
 * environment-conditional the way `HOSPEDA_SITE_URL`/`HOSPEDA_API_URL` are.
 * This string-built URL is the SOLE mechanism today: the qzpay `prices.create`
 * adapter returns only the `preapproval_plan` id, so nothing captures the real
 * per-plan `init_point`. The `billing_mp_plans.init_point` column is reserved
 * for a follow-up that records the provider's own `init_point` once the adapter
 * exposes it — it is NOT read here and is not a fallback. Empirically this
 * hand-built URL is functionally identical to what MP's own dashboard "share"
 * button generates.
 *
 * @param input - The resolved MP plan id (from {@link resolveCheckoutMpPlanId}).
 * @returns The absolute hosted checkout URL to redirect the customer to.
 */
export function buildPreapprovalPlanShareLink(input: BuildPreapprovalPlanShareLinkInput): string {
    const params = new URLSearchParams({ preapproval_plan_id: input.mpPreapprovalPlanId });
    // HOS-209: stamp the per-checkout nonce so MercadoPago carries it onto the
    // authorized preapproval as external_reference, enabling exact-nonce (Tier 2)
    // linking from the start. URLSearchParams handles the encoding.
    if (input.externalReference) {
        params.set('external_reference', input.externalReference);
    }
    return `https://www.mercadopago.com.ar/subscriptions/checkout?${params.toString()}`;
}

/**
 * Archive a MercadoPago `preapproval_plan` without letting a failure propagate.
 * Used to retire a drifted plan or reap a lost-race orphan — neither is worth
 * failing the checkout over; a leaked inactive plan is harmless and the reconcile
 * path can clean it up later.
 */
async function archiveMpPlanBestEffort(
    adapter: QZPayPaymentAdapter,
    mpPreapprovalPlanId: string,
    context: 'drift' | 'lost-race'
): Promise<void> {
    try {
        await adapter.prices.archive(mpPreapprovalPlanId);
    } catch (archiveErr) {
        apiLogger.warn(
            {
                mpPreapprovalPlanId,
                context,
                error: archiveErr instanceof Error ? archiveErr.message : String(archiveErr)
            },
            'HOS-191: failed to archive MP plan (non-fatal)'
        );
    }
}
