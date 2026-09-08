/**
 * Resolution primitives for the recurring add-on checkout (HOS-847 PR 4).
 *
 * Everything here ANSWERS A QUESTION and writes nothing: may this add-on be
 * sold recurringly at all, which `(planId, priceId)` pair satisfies qzpay's
 * `mode: 'paid'` contract, and which email the preapproval must bind to. The
 * module that CREATES the preapproval and the purchase row is
 * `addon.checkout.recurring.ts`; the one that decides what to do with a
 * checkout already in flight is `addon.checkout.recurring-idempotency.ts`.
 *
 * The split is not cosmetic — the three were one 545-line file, past the
 * 500-line limit that is the declared reason the recurring branch was extracted
 * from `addon.checkout.ts` in the first place.
 *
 * @module services/addon.checkout.recurring-resolve
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { AddonDefinition } from '@repo/billing';
import { PlanService } from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';
import type { AddonBillingIntervalLabel } from './billing/mp-addon-plan-provisioning.service.js';
import { getMpPayerEmail, resolvePayerEmail } from './billing/payer-email.js';
import { SubscriptionCheckoutError } from './billing/subscription-checkout-error.js';

/**
 * Cadence every recurring add-on preapproval is created on.
 *
 * A module constant, not an input, because nothing upstream can express the
 * other value: `PurchaseAddonInput` carries no interval, no route accepts one,
 * and no surface offers the annual price the catalog declares
 * (`AddonDefinition.annualPriceArs`). Making the annual cadence buyable is a
 * product change — a price to show, a control to pick it, and the cancellation
 * arithmetic that goes with a twelve-month commitment — not something this
 * checkout may infer. Until that exists, one cadence is the honest answer;
 * {@link AddonBillingIntervalLabel} already carries the other for the day it
 * lands.
 */
export const RECURRING_ADDON_BILLING_INTERVAL: AddonBillingIntervalLabel = 'monthly';

/**
 * The `billing_addons.billing_interval` value that means "charges again".
 *
 * The catalog stores exactly two spellings — `'one_time'` and `'month'` — and
 * `AddonCatalogService.list` maps `billingType: 'recurring'` onto
 * `eq(billingAddons.billingInterval, 'month')`, which is where this literal
 * comes from. See {@link shouldUseRecurringAddonCheckout} for why the raw
 * column is consulted at all rather than the derived `billingType`.
 */
const RECURRING_ADDON_DB_INTERVAL = 'month';

/**
 * LOCAL trial length written onto a recurring add-on's own subscription row.
 *
 * ZERO, stated explicitly, and it must stay a module constant rather than an
 * input for the same reason `ADDON_MP_PLAN_TRIAL_DAYS` is one: a parameter is a
 * place for a non-zero value to arrive from.
 *
 * The value being explicit is the whole fix. `createPaidSubscription` forwards
 * `trialDays` to qzpay-core, and qzpay-core's fallback when it is absent is
 * `else if (price?.trialDays != null) createInput.trialDays = price.trialDays`
 * — the price here is the OWNER'S monthly plan price, borrowed only to satisfy
 * qzpay's plan+price requirement, and data-migration
 * `packages/seed/src/data-migrations/0055-owner-trial-30-days.ts` set exactly
 * that row's `trial_days` to 30. Inherited, `@qazuor/qzpay-drizzle` would write
 * `trial_start = now` / `trial_end = now + 30d` onto the add-on's row: a trial
 * MercadoPago never granted, asserted by us about ourselves. Guard G-1 cannot
 * see it — it watches what we SEND MercadoPago, and this leak is inbound.
 *
 * Downstream, a `trial_end` in the future is what `deriveTrialingStatus` turns
 * into `status = 'trialing'` on the PR 5 webhook, which is what would put an
 * add-on row in front of every `status = 'trialing'` sweep and email series.
 */
export const RECURRING_ADDON_LOCAL_TRIAL_DAYS = 0;

/**
 * Status a recurring add-on purchase row is born in.
 *
 * `'pending'` is one of the four values the `billing_addon_purchases` CHECK
 * constraint already allows, so this needs no migration. It means exactly
 * "preapproval created, not yet authorized"; the webhook (PR 5) is what moves
 * it to `'active'` and applies the benefit.
 *
 * Exported for PR 5, which reads rows in this status to activate them, and for
 * {@link module:services/addon.checkout.recurring-idempotency}, which is the
 * only thing that reads them today.
 */
export const RECURRING_ADDON_PENDING_STATUS = 'pending' as const;

/**
 * Terminal status a superseded `'pending'` purchase is closed into.
 *
 * `pending -> canceled` is a declared edge of the add-on state machine
 * (`addon-status-transitions.ts`), and it is the ONLY `pending -> *` edge
 * anything in this PR drives. See the idempotency module for why a stale
 * pending row is closed rather than left alongside a fresh one.
 */
export const RECURRING_ADDON_CANCELED_STATUS = 'canceled' as const;

/**
 * How long the returned checkout window is advertised for.
 *
 * Mirrors `PENDING_PROVIDER_TTL_MS` in `subscription-checkout.service.ts`,
 * re-declared locally for the reason `abandoned-pending-subs.job.ts` re-declares
 * it too: importing that module pulls the whole subscription-checkout surface in
 * for one integer. There is no correlation row with a real TTL in the
 * own-preapproval flow, so this is a synthesized window, exactly as the
 * accommodation own-preapproval branch synthesizes its own.
 */
export const RECURRING_ADDON_CHECKOUT_TTL_MS = 30 * 60 * 1000;

/**
 * Plan resolver, instantiated once at module scope. Stateless, holds no
 * connection — same shape as the one in `addon.checkout.ts`.
 *
 * Deliberately a second instance rather than an import of that file's private
 * `resolvePlanByIdOrSlug`: `addon.checkout.ts` imports THIS module, so reaching
 * back into it would close an import cycle. The eight-line dual-resolve is
 * already spelled out three times in `apps/api/src/services`
 * (`addon.checkout.ts`, `addon-plan-change.service.ts`,
 * `addon-entitlement.service.ts`) — this follows that convention rather than
 * inventing a fourth shape for it.
 */
const planService = new PlanService();

/**
 * Input for {@link shouldUseRecurringAddonCheckout}.
 */
export interface ShouldUseRecurringAddonCheckoutInput {
    /**
     * The resolved `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` boolean (already
     * coerced from the literal `'true'` by the env schema).
     */
    readonly recurringAddonsEnabled: boolean;
    /** The add-on being bought, as resolved from the catalog by the caller. */
    readonly addon: AddonDefinition;
}

/**
 * Decide whether a checkout should take the recurring (preapproval) path.
 *
 * Three conditions, checked in this order because each is cheaper than the next
 * and the first one is what keeps the branch dark:
 *
 *  1. **The flag.** Off in every environment today, and off is a pure boolean
 *     read — nothing below runs, so this costs no query.
 *  2. **`billingType === 'recurring'`.** Keeps the two genuinely single-charge
 *     add-ons (`visibility-boost-7d` / `-30d`, which have a `durationDays`
 *     window) on the `Preference` path even once the flag is flipped.
 *  3. **The catalog row's REAL `billing_interval` is `'month'`.**
 *
 * Condition 3 is not redundant with condition 2, and it is the one that fails
 * CLOSED. `billingType` is derived by exclusion —
 * `addon-catalog.mapper.ts`'s `resolveBillingType` returns `'recurring'` for
 * anything that is not the literal `'one_time'`, so `NULL`, `''`, and any typo
 * an operator can enter through the SPEC-168 admin UI all become `'recurring'`.
 * Until this PR that misclassification was cosmetic (a label on a listing);
 * from here it decides between one charge and a perpetual one. Asking the
 * column for a POSITIVE match on `'month'` means an unknown value falls back to
 * the one-time path, which is exactly today's behavior and the only safe
 * direction to fail in.
 *
 * The mapper itself is deliberately NOT changed: it feeds every add-on listing
 * and filter in the product, so widening or narrowing it is a different blast
 * radius than hardening one gate.
 *
 * A catalog row with no `id` (an `AddonDefinition` built from the static config
 * rather than the database) cannot be verified, so it too resolves to `false`.
 * That is not a silent hole: an add-on with no primary key has no
 * `billing_mp_addon_plans` registry key either, so it could never have been
 * charged recurringly — see the `!addon.id` guard in
 * {@link createRecurringAddonCheckout}, which stays as the direct-caller
 * backstop.
 *
 * @param input - See {@link ShouldUseRecurringAddonCheckoutInput}.
 * @returns `true` when the recurring preapproval path applies.
 */
export async function shouldUseRecurringAddonCheckout(
    input: ShouldUseRecurringAddonCheckoutInput
): Promise<boolean> {
    const { recurringAddonsEnabled, addon } = input;

    if (recurringAddonsEnabled !== true) {
        return false;
    }
    if (addon.billingType !== 'recurring') {
        return false;
    }
    if (!addon.id) {
        return false;
    }

    return await addonRowDeclaresRecurringInterval({ addonId: addon.id, addonSlug: addon.slug });
}

/**
 * Read `billing_addons.billing_interval` for one row and answer whether it is
 * the recurring spelling.
 *
 * Fails closed on every uncertainty — no row, a `NULL` column, an unknown
 * string, or a failed query — because the fallback is the one-time path, which
 * is what production does today anyway. A refused recurring checkout costs a
 * feature that is not enabled; a wrongly granted one costs a charge every month
 * forever.
 */
async function addonRowDeclaresRecurringInterval(input: {
    readonly addonId: string;
    readonly addonSlug: string;
}): Promise<boolean> {
    try {
        const { billingAddons, eq, getDb } = await import('@repo/db');

        const rows = await getDb()
            .select({ billingInterval: billingAddons.billingInterval })
            .from(billingAddons)
            .where(eq(billingAddons.id, input.addonId))
            .limit(1);

        const interval = rows[0]?.billingInterval;
        if (interval === RECURRING_ADDON_DB_INTERVAL) {
            return true;
        }

        apiLogger.warn(
            {
                addonId: input.addonId,
                addonSlug: input.addonSlug,
                billingInterval: interval ?? null
            },
            "HOS-847: add-on is labelled 'recurring' but its catalog row does not declare a recurring billing_interval — falling back to the one-time checkout"
        );
        return false;
    } catch (error) {
        apiLogger.error(
            {
                addonId: input.addonId,
                addonSlug: input.addonSlug,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: could not read the add-on catalog row to confirm its billing interval — falling back to the one-time checkout'
        );
        return false;
    }
}

/**
 * Resolve the `(planId, priceId)` pair qzpay-core requires to create a
 * `mode: 'paid'` subscription, from the customer's existing plan subscription.
 *
 * ## Why the add-on borrows the customer's plan
 *
 * `billing.subscriptions.create({ mode: 'paid' })` looks the plan up (config
 * map first, then `billing_plans`) and throws `QZPayValidationError` when
 * neither the plan nor a price resolves. An add-on has no `billing_plans` row
 * and must not get one: those rows are the public plan catalog
 * (`GET /api/v1/public/plans`, `ALL_PLANS`, the grant-matrix snapshots), and a
 * synthetic add-on plan would surface in all three.
 *
 * ## The borrowed price is NOT inert — the HOS-1221 port made three of its
 * fields load-bearing
 *
 * This used to say the plan "contributes NOTHING to what is charged", and while
 * the add-on's own plan id was being sent that was true: the MercadoPago adapter
 * emitted `{ payer_email, external_reference, reason, back_url,
 * notification_url, preapproval_plan_id }` and returned early, never reading the
 * price's amount, currency or interval at all.
 *
 * The port removed that plan id — MercadoPago rejects the plan-based request
 * with HTTP 400 `"Create subscription - card_token_id is required"`, which is
 * why every checkout on this path answered 500 — so the adapter now takes its
 * OTHER branch and builds an inline `auto_recurring` out of this very price row:
 *
 *  - **amount** — OVERRIDDEN by the caller (`providerUnitAmountOverride =
 *    addon.priceArs`). That override is the point of the port: uncorrected, a
 *    ARS 5.000/month add-on would be charged at the borrowed owner plan's
 *    ARS 18.000-and-up monthly amount, every month, forever.
 *  - **currency** — `price.currency`, verbatim, with no override available.
 *    Every plan price and every add-on is ARS, so this agrees today.
 *  - **cadence** — `price.billingInterval` × `price.intervalCount`, verbatim,
 *    through the adapter's `toMercadoPagoInterval`, and with no override
 *    available either. This is what the price selection below now has to be
 *    strict about; see the comment on it.
 *
 * And the price is still not inert on the LOCAL row: qzpay-core inherits its
 * `trialDays` unless told otherwise, which is why the caller passes
 * {@link RECURRING_ADDON_LOCAL_TRIAL_DAYS} explicitly. Read that constant's
 * JSDoc before assuming anything else about this price is free.
 *
 * The borrowed plan's `name` also reaches the preapproval's `reason`, which the
 * adapter builds as `` `${plan.name} - Mensual` ``. The caller overrides it with
 * `planDisplayName = addon.name`, so the buyer authorizes the add-on they chose
 * instead of the plan whose price row it happened to borrow. (That override is
 * reachable only now: `planDisplayName` has no effect on the plan-based flow,
 * where MercadoPago renders the plan's own reason.)
 *
 * ## Why `PlanService`, and not `billing.plans.listAll()`
 *
 * The customer's plan is resolved TWICE in one request: once by the
 * `targetCategories` gate in `addon.checkout.ts` (via `PlanService`, which does
 * not filter `livemode`) and once here. Resolving the second one through
 * qzpay's `plans.listAll()` used two different rules for the same question:
 * that call funnels into `repo.search({ livemode, ... })` with
 * `livemode = !sandbox`, so on staging (`sandbox = true`) a plan seeded
 * `livemode = true` passes the gate and then vanishes here — turning every
 * recurring checkout into a 500 on the exact environment the PR 8 smoke runs
 * on. It was also a full catalog load with one `findByPlanId` per plan, to
 * convert an identifier the caller already held.
 *
 * @param input.billing - Resolved qzpay billing instance.
 * @param input.planIdOrSlug - `billing_subscriptions.plan_id`, which is a UUID
 *   on modern rows and a legacy slug on older ones (SPEC-168), so both are
 *   tried — matching `resolvePlanByIdOrSlug`'s dual-resolve in
 *   `addon.checkout.ts`.
 * @returns The ids to hand qzpay, or `null` when the plan or its prices cannot
 *   be resolved.
 */
export async function resolveSubscriptionPlanReference(input: {
    readonly billing: QZPayBilling;
    readonly planIdOrSlug: string;
}): Promise<{ readonly planId: string; readonly priceId: string } | null> {
    const plan = await resolvePlanByIdOrSlug(input.planIdOrSlug);

    if (!plan) {
        return null;
    }

    const prices = await input.billing.plans.getPrices(plan.id);

    // The plain monthly row, or nothing — NOT a preference with fallbacks any
    // more.
    //
    // The old selection fell back to `prices.find((p) => p.active)` and then to
    // `prices[0]`, mirroring qzpay's own `prices[0]` fallback. That was harmless
    // while the add-on's plan id was being sent, because then the adapter never
    // read this row's cadence at all. Since the HOS-1221 port it does: the
    // preapproval's `auto_recurring.frequency` / `frequency_type` come from
    // `price.billingInterval` × `price.intervalCount`, verbatim, and there is no
    // cadence override to correct them with (the amount has one; the cadence
    // does not).
    //
    // So a fallback that landed on an ANNUAL row — every owner plan has one, and
    // `prices[0]` has no defined order — would create a preapproval charging the
    // add-on's MONTHLY amount once every twelve months. That is the same class of
    // silent mispricing the amount override exists to prevent, in the other
    // dimension, and it would be invisible to everything except a real charge a
    // year later.
    //
    // Refusing is the safe direction and costs nothing real: the caller turns a
    // `null` into a typed `RECURRING_ADDON_PLAN_UNRESOLVED` refusal, and every
    // seeded plan carries the monthly row this looks for. `intervalCount === 1`
    // stays part of the match for the reason `findMonthlyPrice` has it in the
    // subscription checkout — the multi-month variants share the `'month'`
    // interval and belong to plan-change flows.
    const price = prices.find(
        (p) => p.active && p.billingInterval === 'month' && p.intervalCount === 1
    );

    if (!price) {
        apiLogger.error(
            { planId: plan.id, priceCount: prices.length },
            'HOS-847: recurring add-on checkout refused — the borrowed plan has no active plain-monthly price, and the preapproval cadence is read from it verbatim'
        );
        return null;
    }

    return { planId: plan.id, priceId: price.id };
}

/**
 * Dual-resolve a `billing_subscriptions.plan_id` that may be a UUID (modern
 * rows) or a legacy slug (older rows/seeds), returning the plan's UUID.
 *
 * @param planId - UUID or slug of the billing plan.
 * @returns The plan's UUID, or `null` when neither lookup succeeds.
 */
async function resolvePlanByIdOrSlug(planId: string): Promise<{ readonly id: string } | null> {
    const byId = await planService.getById(planId);
    if (byId.success && byId.data) {
        return { id: byId.data.id };
    }
    const bySlug = await planService.getBySlug(planId);
    if (bySlug.success && bySlug.data) {
        return { id: bySlug.data.id };
    }
    return null;
}

/**
 * Resolve which email the add-on's preapproval must bind to.
 *
 * Identical precedence to the four plan checkouts, and for the identical
 * reason: `payer_email` is BINDING on a MercadoPago preapproval — only whoever
 * uses or types that exact address can authorize the charge, and MercadoPago
 * never tells the buyer which address it expected, it just says to contact the
 * seller. A host whose Hospeda account is `maria@hotel.com.ar` but who paid
 * their plan with `maria.pagos@gmail.com` has that second address cached in
 * `billing_customers.mp_payer_email` (HOS-208), and an add-on checkout that
 * ignored the cache would hand them an authorization page they cannot complete.
 *
 * There is no `requestedPayerEmail` tier here: the add-on purchase has no
 * pre-redirect confirmation dialog to type one into. That makes the `+` guard
 * inside `resolvePayerEmail` reachable rather than defensive, so it is caught
 * and turned into a typed refusal instead of an unhandled throw.
 *
 * @param input.customerId - Hospeda billing customer id.
 * @param input.customerEmail - `billing_customers.email`, the signup address.
 * @returns The resolved payer email, or `null` when it cannot be used (a `+`).
 */
export async function resolveAddonPayerEmail(input: {
    readonly customerId: string;
    readonly customerEmail: string;
}): Promise<string | null> {
    try {
        const { payerEmail } = resolvePayerEmail({
            mpPayerEmail: await getMpPayerEmail(input.customerId),
            customerEmail: input.customerEmail
        });
        return payerEmail;
    } catch (error) {
        if (error instanceof SubscriptionCheckoutError) {
            apiLogger.warn(
                { customerId: input.customerId, code: error.code },
                'HOS-847: recurring add-on checkout refused — the resolved MercadoPago payer email cannot be used'
            );
            return null;
        }
        throw error;
    }
}
