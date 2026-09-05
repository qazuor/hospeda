/**
 * MercadoPago ADD-ON plan provisioning (HOS-847 PR 3).
 *
 * Sibling of `mp-plan-provisioning.service.ts` (HOS-191) for RECURRING add-ons.
 * Projects a Hospeda add-on onto a MercadoPago `preapproval_plan` and records the
 * mapping in `billing_mp_addon_plans`, so a recurring add-on checkout has a plan
 * to subscribe against. A MercadoPago preapproval carries exactly one
 * `auto_recurring.transaction_amount` and no line items, so each recurring add-on
 * needs its own preapproval and, transitively, its own `preapproval_plan`.
 *
 * The registry is a projection of the add-on catalog (`billing_addons`) — never
 * the source of truth. `amount_ars` is a snapshot used to detect drift; when the
 * catalog price changes, the next {@link resolveOrProvisionMpAddonPlan} re-provisions
 * (creates a fresh MP plan at the new amount and archives the stale one) so new
 * checkouts always charge the current price. Existing add-on subscriptions keep
 * the amount they were authorized at.
 *
 * ## Two deliberate differences from the commercial-plan mold
 *
 * 1. **The trial length is a module constant of `0`, never an input.** There is no
 *    such thing as a free-trial add-on, so there is no trial variant to provision
 *    and no caller may ask for one. See {@link ADDON_MP_PLAN_TRIAL_DAYS}.
 * 2. **The variant key is `(addon_id, billing_interval)`** — without the
 *    `trial_days` and `discount_cycle1_amount` dimensions `billing_mp_plans`
 *    needs, because neither exists for add-ons.
 *
 * Nothing calls this module yet: recurring add-on checkout lands in PR 4, behind
 * `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` (OFF until PR 8). This module does
 * NOT read that flag — it is pure provisioning; gating is the caller's job.
 *
 * @module services/billing/mp-addon-plan-provisioning
 */

import type {
    QZPayBillingInterval,
    QZPayCreatePriceInput,
    QZPayCurrency,
    QZPayPaymentAdapter
} from '@qazuor/qzpay-core';
import { billingMpAddonPlanModel } from '@repo/db';
import { getBillingPaymentAdapter } from '../../middlewares/billing.js';
import { apiLogger } from '../../utils/logger.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Free-trial days baked into EVERY add-on `preapproval_plan`: always zero.
 *
 * This is a module constant rather than a field on
 * {@link ResolveOrProvisionMpAddonPlanInput} on purpose, and it is the single most
 * load-bearing line in this file. `QZPayCreatePriceInput.trialDays` is the qzpay
 * spelling of a MercadoPago free trial, and the CI guard that forbids sending one
 * (`scripts/check-no-trial-to-mercadopago.sh`) matches
 * `freeTrialDays|freeTrial|free_trial|start_date` — NOT `trialDays`. So a trial
 * could reach MercadoPago through this field without CI noticing. Making the value
 * unreachable from the outside is what closes that hole; the behavioural half is
 * pinned by a test that asserts the payload handed to `prices.create`.
 *
 * Zero is also exactly the right value at the adapter boundary: the MercadoPago
 * price adapter tests `if (input.trialDays)`, a TRUTHY check, so `0` makes it omit
 * `auto_recurring.free_trial` from the payload entirely — the key is not sent as
 * `0`, nor as `null`; it does not exist.
 *
 * Why it matters beyond tidiness: in HOS-522 a trial nobody asked for cost
 * ARS 18.000 — MercadoPago advertised fourteen free days on the preapproval and
 * charged one hundred and eighteen seconds later. A trial we never request is a
 * trial MercadoPago cannot promise on our behalf (HOS-1012).
 *
 * Deliberately NOT exported: nothing outside this module has any business reading
 * or forwarding it, and a test that imported it could assert the constant against
 * itself instead of against the payload actually built.
 */
const ADDON_MP_PLAN_TRIAL_DAYS = 0;

/**
 * Billing cadence of a recurring add-on. Only the two real cadences exist here —
 * unlike the commercial registry there is no hidden `daily` QA cadence, because
 * the `TEST_DAILY_PLAN` tool is a commercial plan, not an add-on.
 */
export type AddonBillingIntervalLabel = 'monthly' | 'annual';

/**
 * Input for {@link resolveOrProvisionMpAddonPlan}.
 *
 * Note what is absent: there is no `trialDays`. See {@link ADDON_MP_PLAN_TRIAL_DAYS}.
 */
export interface ResolveOrProvisionMpAddonPlanInput {
    /**
     * The MercadoPago payment adapter (from `getBillingPaymentAdapter()`). Its
     * `prices` slot wraps `POST /preapproval_plan`.
     */
    readonly adapter: QZPayPaymentAdapter;
    /** The Hospeda add-on (`billing_addons.id`, a UUID) being projected. */
    readonly addonId: string;
    /** Billing cadence of this variant. */
    readonly billingInterval: AddonBillingIntervalLabel;
    /**
     * Current catalog price for this variant, in **centavos**. Stored as the drift
     * snapshot in `billing_mp_addon_plans.amount_ars` (the column name mirrors
     * `billing_mp_plans.amount_ars`, which likewise stores centavos) and used as
     * the MP plan's `transaction_amount`.
     */
    readonly amountCentavos: number;
    /** ISO currency code (e.g. `'ARS'`). */
    readonly currency: string;
    /** Human-readable add-on name, used as the MP plan `reason` (dashboard label). */
    readonly addonName: string;
    /**
     * Absolute `http(s)` return URL MercadoPago **requires** when creating a
     * `preapproval_plan`. qzpay rejects the call early — before hitting
     * MercadoPago — when neither this nor an adapter-level `defaultPlanBackUrl`
     * resolves to a valid absolute URL. Hospeda configures no adapter default, so
     * this field is what guarantees the plan always gets one.
     */
    readonly backUrl: string;
}

/**
 * Result of {@link resolveOrProvisionMpAddonPlan}.
 */
export interface ResolveOrProvisionMpAddonPlanResult {
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
 * into MercadoPago's `frequency: 12, frequency_type: 'months'` (MP rejects
 * `frequency_type: 'years'` outright).
 */
function toQZPayBillingInterval(interval: AddonBillingIntervalLabel): QZPayBillingInterval {
    return interval === 'annual' ? 'year' : 'month';
}

/**
 * Spanish labels for each cadence. This `reason` string is shown to the buyer on
 * the MercadoPago checkout/dashboard and Hospeda's default locale is `es`
 * (Argentina market), so it must not leak the English cadence literals.
 */
const ADDON_BILLING_INTERVAL_LABELS_ES: Record<AddonBillingIntervalLabel, string> = {
    monthly: 'mensual',
    annual: 'anual'
};

/**
 * MercadoPago's hard cap on a `preapproval_plan` `reason`. Exceeding it makes
 * `POST /preapproval_plan` fail with `Reason has more than 60 characters`, which
 * qzpay surfaces as `Create price - Reason has more than 60 characters` — killing
 * the checkout before any subscription exists (the H-83 production incident, on
 * the commercial side).
 *
 * The cap counts CHARACTERS, not bytes: a 55-character reason carrying three
 * 3-byte em dashes was accepted by MercadoPago in production, so the accented,
 * em-dashed Spanish wording is safe.
 */
const MP_PLAN_REASON_MAX_LENGTH = 60;

/**
 * Truncate a string to at most `maxLength` characters, appending an ellipsis when
 * it had to give ground. Operates on code POINTS rather than UTF-16 code units, so
 * an add-on name containing an astral character can never be cut in half into a
 * lone surrogate.
 *
 * @param value - The string to fit.
 * @param maxLength - Maximum number of characters allowed in the result.
 * @returns `value` unchanged when it already fits, otherwise a truncated form of
 *   exactly `maxLength` characters (or the empty string when there is no room).
 */
function truncateToLength(value: string, maxLength: number): string {
    if (maxLength <= 0) return '';
    const chars = Array.from(value);
    if (chars.length <= maxLength) return value;
    if (maxLength === 1) return '…';
    return `${chars.slice(0, maxLength - 1).join('')}…`;
}

/**
 * Build the MercadoPago plan `reason` (its buyer- and dashboard-visible name) for
 * an add-on variant. Rendered in Spanish; the `addonName` is a display name and is
 * left as-is.
 *
 * Only two fragments, because only two dimensions exist: there is no trial
 * fragment (a `sin prueba` label would be noise on a registry where no other value
 * is possible) and no discount marker (add-on signup discounts are not a thing).
 *
 * The result is GUARANTEED to fit {@link MP_PLAN_REASON_MAX_LENGTH}. The cadence
 * suffix is bounded by this module, so the add-on name — the one caller-supplied,
 * admin-editable, unbounded field — is what gives ground when the budget runs out.
 * That ordering is deliberate: the cadence is what tells two MP plans for the same
 * add-on apart, whereas a clipped name is still recognisable to its buyer.
 *
 * @param input - Add-on display name and cadence.
 * @returns A reason string of at most 60 characters.
 */
function buildAddonPlanReason(input: {
    addonName: string;
    billingInterval: AddonBillingIntervalLabel;
}): string {
    const suffix = ` — ${ADDON_BILLING_INTERVAL_LABELS_ES[input.billingInterval]}`;
    const addonName = truncateToLength(
        input.addonName,
        MP_PLAN_REASON_MAX_LENGTH - Array.from(suffix).length
    );
    // Belt-and-suspenders: the budget above already fits, but clamping the
    // assembled string means no input — however the catalog changes underneath
    // us — can hand MercadoPago a reason it will reject.
    return truncateToLength(`${addonName}${suffix}`, MP_PLAN_REASON_MAX_LENGTH);
}

/**
 * Create a fresh MercadoPago `preapproval_plan` for the given add-on variant and
 * return its id. Delegates to qzpay's `prices` adapter (`POST /preapproval_plan`),
 * which omits `billing_day` so billing follows the rolling anniversary, and — with
 * `trialDays` falsy — omits `auto_recurring.free_trial` entirely.
 */
async function createMpAddonPlan(input: ResolveOrProvisionMpAddonPlanInput): Promise<string> {
    const priceInput: QZPayCreatePriceInput = {
        // The MercadoPago price adapter ignores `planId` (a preapproval_plan is
        // self-contained), but the qzpay contract requires it; pass the add-on id
        // for traceability.
        planId: input.addonId,
        currency: input.currency as QZPayCurrency,
        unitAmount: input.amountCentavos,
        billingInterval: toQZPayBillingInterval(input.billingInterval),
        intervalCount: 1,
        // ALWAYS 0, and unreachable from the caller — see ADDON_MP_PLAN_TRIAL_DAYS.
        // `0` is falsy, so the adapter omits `free_trial` from the MP payload.
        trialDays: ADDON_MP_PLAN_TRIAL_DAYS,
        // MercadoPago requires a `back_url` on preapproval_plan creation; qzpay
        // fails fast (before the MP call) if it is absent or not absolute.
        backUrl: input.backUrl
    };
    const reason = buildAddonPlanReason({
        addonName: input.addonName,
        billingInterval: input.billingInterval
    });
    return input.adapter.prices.create(priceInput, reason);
}

/**
 * Resolve the MercadoPago `preapproval_plan` id for a recurring add-on variant,
 * provisioning it on MercadoPago and recording it in `billing_mp_addon_plans` if it
 * does not exist yet. Idempotent and safe under concurrent checkouts.
 *
 * Resolution:
 * 1. **Registry hit, amount matches, row active** → return the stored id (no MP call).
 * 2. **Registry hit, amount drifted (or row inactive)** → create a fresh MP plan at
 *    the current amount, compare-and-swap the row, archive the stale plan
 *    (best-effort), return the new id.
 * 3. **Miss** → create the MP plan, insert the row. If a concurrent checkout won the
 *    insert race (unique constraint on `(addon_id, billing_interval)`), archive our
 *    just-created orphan plan and return the winner's id.
 *
 * @param input - Adapter, add-on variant key, current price, and label.
 * @returns The resolved `mp_preapproval_plan_id` and whether it was created here.
 * @throws Rethrows a genuine insert failure (one not explained by the race).
 *
 * @example
 * ```ts
 * const adapter = getBillingPaymentAdapter();
 * if (!adapter) throw new Error('billing unavailable');
 * const { mpPreapprovalPlanId } = await resolveOrProvisionMpAddonPlan({
 *   adapter,
 *   addonId: addon.id,
 *   billingInterval: 'monthly',
 *   amountCentavos: addon.priceCentavos,
 *   currency: 'ARS',
 *   addonName: addon.name,
 *   backUrl: urls.addonReturnUrl
 * });
 * ```
 */
export async function resolveOrProvisionMpAddonPlan(
    input: ResolveOrProvisionMpAddonPlanInput
): Promise<ResolveOrProvisionMpAddonPlanResult> {
    const key = {
        addonId: input.addonId,
        billingInterval: input.billingInterval
    };

    const existing = await billingMpAddonPlanModel.findOne(key);

    // 1. Registry hit at the current amount and still active → reuse.
    if (existing && existing.amountArs === input.amountCentavos && existing.status === 'active') {
        return { mpPreapprovalPlanId: existing.mpPreapprovalPlanId, created: false };
    }

    // 2. Registry hit but the catalog price drifted (or the row was archived):
    // re-provision at the current amount and retire the stale MP plan.
    if (existing) {
        const newId = await createMpAddonPlan(input);
        // Compare-and-swap: only win the update if the row STILL points at the plan
        // we read. A concurrent drift re-provision for the same variant will have
        // swapped `mp_preapproval_plan_id` already, so our conditional update matches
        // 0 rows (returns null) — an UPDATE has no unique constraint to collide on,
        // so without this guard both requests would "succeed", the loser's
        // freshly-created MP plan would be orphaned, and last-write-wins would
        // silently pick one.
        const updated = await billingMpAddonPlanModel.update(
            { id: existing.id, mpPreapprovalPlanId: existing.mpPreapprovalPlanId },
            {
                mpPreapprovalPlanId: newId,
                amountArs: input.amountCentavos,
                status: 'active'
            }
        );
        if (!updated) {
            // Lost the CAS: another request re-provisioned first. Find the winner,
            // THEN archive our new plan as the orphan. Order matters: if the row has
            // somehow vanished (pathological — nothing deletes billing_mp_addon_plans
            // today), we keep our freshly-created plan as the live one instead of
            // archiving the very id we are about to hand back.
            const winner = await billingMpAddonPlanModel.findOne(key);
            if (winner) {
                await archiveMpAddonPlanBestEffort(input.adapter, newId, 'lost-race');
                return { mpPreapprovalPlanId: winner.mpPreapprovalPlanId, created: false };
            }
            return { mpPreapprovalPlanId: newId, created: true };
        }
        // We won the swap: retire the stale plan we just replaced.
        await archiveMpAddonPlanBestEffort(input.adapter, existing.mpPreapprovalPlanId, 'drift');
        apiLogger.info(
            {
                addonId: input.addonId,
                billingInterval: input.billingInterval,
                oldMpPlanId: existing.mpPreapprovalPlanId,
                newMpPlanId: newId
            },
            'HOS-847: re-provisioned MP add-on plan after price drift'
        );
        return { mpPreapprovalPlanId: newId, created: true };
    }

    // 3. Miss → provision, then insert. The unique constraint on the variant key
    // makes the insert the concurrency guard.
    const newId = await createMpAddonPlan(input);
    try {
        await billingMpAddonPlanModel.create({
            addonId: input.addonId,
            billingInterval: input.billingInterval,
            mpPreapprovalPlanId: newId,
            amountArs: input.amountCentavos,
            status: 'active'
        });
        return { mpPreapprovalPlanId: newId, created: true };
    } catch (insertErr) {
        // A concurrent checkout for the same variant likely won the insert. Re-read
        // the winner; if present, our just-created MP plan is an orphan — archive it
        // and use the winner's id so both requests converge on one plan.
        const winner = await billingMpAddonPlanModel.findOne(key);
        if (winner) {
            await archiveMpAddonPlanBestEffort(input.adapter, newId, 'lost-race');
            return { mpPreapprovalPlanId: winner.mpPreapprovalPlanId, created: false };
        }
        // No winner row exists → the failure was not the race. Surface it.
        throw insertErr;
    }
}

/**
 * Input for {@link resolveCheckoutMpAddonPlanId}.
 */
export interface ResolveCheckoutMpAddonPlanIdInput {
    /** The Hospeda add-on (`billing_addons.id`, a UUID). */
    readonly addonId: string;
    /** Human-readable add-on name, used as the MP plan `reason` (dashboard label). */
    readonly addonName: string;
    /** Current catalog price for this variant, in centavos. */
    readonly amountCentavos: number;
    /** ISO currency code (e.g. `'ARS'`). */
    readonly currency: string;
    /** Billing cadence of this variant. */
    readonly billingInterval: AddonBillingIntervalLabel;
    /**
     * Absolute `http(s)` return URL required to create the MercadoPago
     * `preapproval_plan`. Callers pass the same URL that becomes the preapproval's
     * `back_url` (the add-on checkout success page).
     */
    readonly backUrl: string;
}

/**
 * Resolve the MercadoPago `preapproval_plan` id a recurring add-on checkout should
 * subscribe against, acquiring the payment adapter from the billing middleware and
 * provisioning the variant on first use.
 *
 * This is the single entry point the recurring add-on checkout will use (PR 4), so
 * the whole "get adapter → resolve/provision plan" step can be mocked at one
 * boundary in tests. It throws a typed, HTTP-mappable checkout error when the
 * adapter is unavailable, so the checkout surfaces a 502 rather than a raw 500.
 *
 * @param input - Add-on variant key, current price, and label.
 * @returns The `mp_preapproval_plan_id` to create the add-on preapproval against.
 * @throws SubscriptionCheckoutError `MP_PLAN_PROVISIONING_FAILED` when the payment
 *   adapter is unavailable, or when provisioning itself fails.
 */
export async function resolveCheckoutMpAddonPlanId(
    input: ResolveCheckoutMpAddonPlanIdInput
): Promise<string> {
    const adapter = getBillingPaymentAdapter();
    if (!adapter) {
        throw new SubscriptionCheckoutError(
            'MP_PLAN_PROVISIONING_FAILED',
            'Billing payment adapter is unavailable — cannot resolve the MercadoPago add-on plan.'
        );
    }
    try {
        const { mpPreapprovalPlanId } = await resolveOrProvisionMpAddonPlan({
            adapter,
            addonId: input.addonId,
            billingInterval: input.billingInterval,
            amountCentavos: input.amountCentavos,
            currency: input.currency,
            addonName: input.addonName,
            backUrl: input.backUrl
        });
        return mpPreapprovalPlanId;
    } catch (err) {
        // A provisioning failure (MP `prices.create` error, or a registry read/write
        // failure) must surface as the typed, retryable 502 the error code documents
        // — not a raw 500. An already-typed checkout error passes through.
        if (err instanceof SubscriptionCheckoutError) throw err;
        const message = err instanceof Error ? err.message : String(err);
        throw new SubscriptionCheckoutError(
            'MP_PLAN_PROVISIONING_FAILED',
            `Could not resolve or provision the MercadoPago add-on plan: ${message}`
        );
    }
}

/**
 * Archive a MercadoPago `preapproval_plan` without letting a failure propagate.
 * Used to retire a drifted plan or reap a lost-race orphan — neither is worth
 * failing the checkout over; a leaked inactive plan is harmless and a reconcile
 * path can clean it up later.
 */
async function archiveMpAddonPlanBestEffort(
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
            'HOS-847: failed to archive MP add-on plan (non-fatal)'
        );
    }
}
