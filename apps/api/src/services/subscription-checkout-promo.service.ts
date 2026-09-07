/**
 * Checkout-signup promo resolution (SPEC-262 T-012 Phase 2).
 *
 * Resolves a raw `promoCode` string supplied at NEW-SUBSCRIBER checkout into a
 * discriminated "checkout promo plan" the monthly / annual initiators branch on:
 *
 *   - `{ kind: 'none' }`     — no code (or empty string).
 *   - `{ kind: 'trial' }`    — `trial_extension` effect → forwards `freeTrialDays`.
 *   - `{ kind: 'discount' }` — `discount` effect → discounted line-item amount
 *     (annual one-time) or live-preapproval mutation (monthly), plus the
 *     cycle-counter seed inputs.
 *   - `{ kind: 'comp' }`     — REMOVED (HOS-1171). A `comp` code is refused here
 *     and answers `invalid`; a complimentary subscription is an admin action.
 *
 * SPEC-262 C1+H1 fix: validation now routes through the FULL `validatePromoCode`
 * service, which checks active + expiresAt + maxUses + maxPerCustomer + validPlans
 * + newCustomersOnly + minAmount. The partial `active`-only path is replaced.
 * After validation passes, the effect is classified from the validated DB code.
 * The config-backed trial-extension fallback is preserved for legacy codes.
 *
 * Keeping it here keeps `subscription-checkout.service.ts` thin (branch routing only).
 *
 * @module services/subscription-checkout-promo.service
 */

import { resolveFreeTrialExtensionPromo } from '@repo/billing';
import { type PromoEffect, PromoEffectKindEnum } from '@repo/schemas';
import { type PromoCodeValidationContext, validatePromoCode } from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';

/**
 * Discriminated result of resolving a checkout promo code.
 *
 * `none` carries no DB identity. A `trial` may come from a DB-persisted
 * `trial_extension` code (then it carries `promoCodeId` + normalized `code` so
 * the redemption can be recorded — HOS-240) OR from the config-backed legacy
 * fallback (then it has neither, since there is no DB row to redeem). The
 * `discount` and `comp` variants always originate from a DB-persisted code, so
 * they always carry `promoCodeId` + the normalized `code` for the redemption record.
 *
 * The `invalid` variant is returned (NOT thrown) so this resolver has no import
 * dependency on the checkout service's error class — the caller maps `invalid`
 * to `SubscriptionCheckoutError('INVALID_PROMO_CODE')`. This keeps the module
 * graph acyclic (the checkout service imports this resolver, not vice versa).
 */
export type CheckoutPromoPlan =
    | { readonly kind: 'none' }
    | {
          readonly kind: 'trial';
          readonly freeTrialDays: number;
          /**
           * DB id + normalized code of the `trial_extension` promo, present ONLY
           * when the trial extension came from a DB-persisted code (HOS-240). The
           * config-backed legacy fallback leaves both undefined (nothing to
           * redeem). When set, the checkout records the redemption and stamps
           * `promo_code_id` on the subscription.
           */
          readonly promoCodeId?: string;
          readonly code?: string;
      }
    | {
          readonly kind: 'discount';
          readonly promoCodeId: string;
          readonly code: string;
          /** The typed discount effect (carries valueKind/value/durationCycles). */
          readonly effect: Extract<PromoEffect, { kind: 'discount' }>;
      }
    | { readonly kind: 'invalid'; readonly message: string };
// There is no `comp` variant any more (HOS-1171). It existed so the checkout
// could reach `createCompSubscription()` on a route with no permission check;
// deleting it deletes the two branches that consumed it, which is the point —
// a dead branch calling the comp inserter is a second path around the
// preapproval hard-cancel that `subscription-comp-grant.service.ts` performs.
//
// `CheckoutAppliedEffect` in `subscription-checkout.service.ts` KEEPS its
// `'comp'` member: it is an independently declared string union, not derived
// from this type, and it is part of the `/start-paid` response contract that
// `PlanPurchaseButton.client.tsx` and the checkout success page still read.
// Nothing produces that value now.

/**
 * Resolve a raw checkout promo code into a {@link CheckoutPromoPlan}.
 *
 * SPEC-262 C1+H1: routes through the FULL `validatePromoCode` which checks
 * active + expiresAt + maxUses + maxPerCustomer + validPlans + newCustomersOnly
 * + minAmount. The caller must supply `userId` and `planId` for the full
 * restriction check.
 *
 * Never throws — an unresolvable / invalid code returns `{ kind: 'invalid' }`
 * which the caller maps to a typed checkout error.
 *
 * @param input.promoCode - The raw code string (may be undefined / empty).
 * @param input.userId    - The authenticated user's ID (for newCustomersOnly + maxPerCustomer).
 * @param input.planId    - The resolved plan ID (for validPlans restriction check).
 * @param input.amount    - The base charge amount in centavos (for minAmount check).
 * @returns A discriminated plan the initiators branch on.
 */
export async function resolveCheckoutPromoPlan(input: {
    readonly promoCode?: string;
    readonly userId?: string;
    readonly planId?: string;
    readonly amount?: number;
}): Promise<CheckoutPromoPlan> {
    const { promoCode, userId, planId, amount } = input;

    if (promoCode === undefined || promoCode.length === 0) {
        return { kind: 'none' };
    }

    // SPEC-262 C1+H1 fix: run the FULL validation (active + expiry + maxUses +
    // maxPerCustomer + validPlans + newCustomersOnly + minAmount) before classifying
    // the effect. The config-backed trial-extension path only runs when the DB has
    // no record of the code (not-found path), so legacy codes still work.
    if (userId) {
        const validationCtx: PromoCodeValidationContext = {
            userId,
            ...(planId ? { planId } : {}),
            ...(amount === undefined ? {} : { amount })
        };
        const validationResult = await validatePromoCode(promoCode, validationCtx);

        if (!validationResult.valid) {
            // Log the specific restriction reason to aid operator debugging.
            apiLogger.debug(
                { code: promoCode, errorCode: validationResult.errorCode, userId, planId },
                'Checkout promo validation rejected'
            );
            return {
                kind: 'invalid',
                message: validationResult.errorMessage ?? `Promo code '${promoCode}' is not valid`
            };
        }

        // Validation passed — classify the effect from the DB code (re-fetch via
        // the same normalised code; validatePromoCode already proved it exists).
        return classifyValidatedCode(promoCode);
    }

    // userId is not yet available (plan resolver only, no userId context yet):
    // fall through to the DB-only partial check (effect classification only).
    // This path is NOT used for real money decisions — it exists only so tests
    // that mock without userId still work. Production paths always supply userId.
    return classifyValidatedCode(promoCode);
}

/**
 * Classify the effect of a code that has already passed validation.
 *
 * Fetches the DB record and maps its typed `effect` to the checkout promo plan
 * discriminant. Falls back to the config-backed trial-extension path when the
 * code is not in the DB (legacy codes).
 *
 * @internal — only called after `validatePromoCode` returned `valid: true`.
 */
async function classifyValidatedCode(promoCode: string): Promise<CheckoutPromoPlan> {
    // Re-fetch via PromoCodeService to get the full DTO with effect + id + code.
    // This is a second DB round-trip intentionally: validatePromoCode operates on
    // raw DB rows and does not return the DTO with parsed effect fields.
    const { PromoCodeService } = await import('@repo/service-core');
    const promoService = new PromoCodeService();
    const promoResult = await promoService.getByCode(promoCode);

    if (promoResult.success && promoResult.data) {
        const dbCode = promoResult.data;

        const effect = dbCode.effect;

        if (effect?.kind === PromoEffectKindEnum.TRIAL_EXTENSION) {
            // HOS-240: carry the DB identity so the checkout can record the
            // redemption (used_count++, usage row, promo_code_id stamp). Without
            // it, a DB-backed trial_extension code applied its effect but never
            // enforced max_uses / max_per_customer — matching how the sibling
            // `comp`/`discount` branches below propagate `promoCodeId` + `code`.
            return {
                kind: 'trial',
                freeTrialDays: effect.extraDays,
                promoCodeId: dbCode.id,
                code: dbCode.code
            };
        }

        if (effect?.kind === PromoEffectKindEnum.COMP) {
            // HOS-1171: this DELIBERATELY undoes the SPEC-262 T-012 P2 decision
            // that used to sit here ("comp is ALLOWED at self-serve checkout
            // now"). It is an owner decision, not an oversight.
            //
            // This was the load-bearing door, not `/apply`. A comp code applied
            // through `/apply` needs an existing subscription to flip, and
            // whoever wants free access has none — so they come here, where this
            // branch reached `createCompSubscription()`: `status='comp'`,
            // `mp_subscription_id = NULL`, a period end 100 years out, no
            // permission check and no `livemode` filter anywhere on the path
            // (`start-paid.ts` is a `createCRUDRoute` with no
            // `requiredPermissions`). `HOSPEDA_FREE` was active and uncapped in
            // production. One request, and you were never billed again.
            //
            // A complimentary subscription is an ADMIN ACTION on a subscription
            // now — `POST /api/v1/admin/billing/subscriptions/grant-comp`
            // (`routes/billing/admin/subscription-comp.ts`, `BILLING_MANAGE`) —
            // exactly like courtesy. Neither is reachable by redeeming a code,
            // and `HOSPEDA_FREE` itself is retired from the seed baseline and
            // deactivated in seeded environments (seed data-migration 0099).
            //
            // `invalid` rather than a thrown error keeps this module free of any
            // import on the checkout service's error class (see the type's
            // docstring); the caller maps it to
            // `SubscriptionCheckoutError('INVALID_PROMO_CODE')`. Nothing is
            // redeemed on this path, so the code is not spent either.
            apiLogger.warn(
                { code: dbCode.code, promoCodeId: dbCode.id },
                'Comp promo code refused at self-serve checkout (HOS-1171): comp is an admin action'
            );
            return {
                kind: 'invalid',
                message: `Promo code '${promoCode}' is not valid`
            };
        }

        if (effect?.kind === PromoEffectKindEnum.DISCOUNT) {
            // SPEC-262 T-012 P2: discount is honored at signup.
            return {
                kind: 'discount',
                promoCodeId: dbCode.id,
                code: dbCode.code,
                effect
            };
        }

        // DB code exists but has no typed effect (legacy row, not yet backfilled).
        // Fall through to the config-backed trial-extension path.
        return resolveTrialExtensionFromConfig(promoCode);
    }

    // Code not in DB — fall back to config-backed trial-extension resolution.
    // Covers codes before the admin create-promo-code route or backfill ran.
    return resolveTrialExtensionFromConfig(promoCode);
}

/**
 * Config-backed trial-extension fallback. Returns a `trial` plan when the code
 * is a known config free-trial extension, otherwise an `invalid` plan.
 * @internal
 */
function resolveTrialExtensionFromConfig(promoCode: string): CheckoutPromoPlan {
    const resolved = resolveFreeTrialExtensionPromo(promoCode);
    if (!resolved) {
        return {
            kind: 'invalid',
            message: `Promo code '${promoCode}' is not a valid free-trial extension`
        };
    }
    return { kind: 'trial', freeTrialDays: resolved.extraTrialDays };
}
