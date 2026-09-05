/**
 * Self-service effect gate for `POST /api/v1/protected/billing/promo-codes/apply`
 * (HOS-1195 / HOS-1171).
 *
 * ## The hole this closes
 *
 * The apply route was a `createProtectedRoute` with no `requiredPermissions`
 * and no effect gate at all, so ANY signed-in user could POST a `comp` code
 * against their OWN subscription and reach `service.apply` → `applyPromoCode`,
 * which runs `UPDATE billing_subscriptions SET status = 'comp'`. The B1
 * ownership guard does not stop it: that one exists for the CROSS-customer
 * attack ("flip the VICTIM's subscription to comp") and passes by construction
 * when the subscription is the caller's own. In production `HOSPEDA_FREE` is
 * active with `effect_kind = comp` and no `max_uses`, and `getPromoCodeByCode`
 * resolves on `eq(code, …)` alone, so `livemode` never scoped it either.
 * Anyone who learned the string got a permanently free subscription.
 *
 * ## The two rules
 *
 * 1. **`comp` is refused for EVERY caller, admins included.** The one
 *    legitimate way to grant it is the audited path
 *    (`services/subscription-comp-create.service.ts`), which inserts the row
 *    directly with no MercadoPago preapproval. A second, unaudited door for
 *    admins would only mean the grant sometimes happens where nobody looks.
 * 2. **A non-admin caller may redeem `trial_extension` and nothing else.** A
 *    `discount` is refused WITHOUT being redeemed (owner decision, HOS-1171):
 *    it stays usable at checkout, where a discount belongs. An untyped effect
 *    lands in the same bucket — a legacy row whose `value_kind` was never
 *    backfilled is a discount `parseEffectFromRow` could not type, and guessing
 *    in the permissive direction is the exact shape of failure this exists to
 *    stop.
 *
 * Admin callers keep the route's full behaviour (the SPEC-262 T-007 discount
 * seam and `service.apply`), which is what it was built for and what its ops
 * tooling still targets.
 *
 * ## Two smaller decisions worth not re-deriving
 *
 * **Fail-closed on the peek.** A code we could not READ is never handed to a
 * redemption path that would read it again inside its own transaction.
 * `NOT_FOUND` keeps answering 404, exactly as `service.apply` did.
 *
 * **403 for `comp`, not the error contract's usual 404.** The rule that a 403
 * must not confirm an id exists is about resources whose ids are guessable and
 * private. It buys nothing here: `POST /validate` — unchanged, and the
 * pre-flight the web form runs — hands back `effectPreview.effectKind` for any
 * code the caller can name. A 404 would only make the honest holder of a comp
 * code read "that code does not exist".
 *
 * @module routes/billing/promo-code-effect-gate
 */

import { PromoEffectKindEnum, ServiceErrorCode } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';

/** Reason forwarded on the `comp` refusal, whitelisted in `utils/entitlement-cause.ts`. */
export const COMP_NOT_SELF_SERVICE_REASON = 'PROMO_CODE_COMP_NOT_SELF_SERVICE' as const;

/** Reason forwarded on the discount / untyped refusal. */
export const DISCOUNT_AT_CHECKOUT_REASON = 'PROMO_CODE_DISCOUNT_AT_CHECKOUT' as const;

/**
 * The shape of `PromoCodeService.getByCode`'s result that this gate reads.
 *
 * Declared structurally rather than imported so the gate depends on the two
 * fields it actually inspects, not on the whole `PromoCode` DTO.
 */
export interface PromoCodePeek {
    readonly success: boolean;
    readonly data?: { readonly effect?: { readonly kind?: string } } | undefined;
    readonly error?: { readonly code?: string; readonly message?: string } | undefined;
}

/**
 * Refuses a promo code whose effect must not be redeemed through the
 * self-service apply route. Returns normally when the request may proceed.
 *
 * Every refusal happens BEFORE any redemption, so a refused code is not spent:
 * `used_count` is untouched and no usage row is written.
 *
 * @param input.peekResult - What `PromoCodeService.getByCode` answered for the
 *   submitted code, read BEFORE any mutation.
 * @param input.actorHasAdmin - Whether the caller holds `ACCESS_API_ADMIN`.
 * @throws HTTPException 403 when the code carries a `comp` effect (any caller).
 * @throws HTTPException 422 when a non-admin submits a discount or an untyped
 *   effect.
 * @throws HTTPException 404/500 when a non-admin's code could not be read.
 *
 * @example
 * ```ts
 * const peekResult = await service.getByCode(code);
 * assertPromoEffectIsSelfServiceRedeemable({ peekResult, actorHasAdmin });
 * // …only reachable for a trial_extension (or for an admin)
 * ```
 */
export function assertPromoEffectIsSelfServiceRedeemable(input: {
    readonly peekResult: PromoCodePeek;
    readonly actorHasAdmin: boolean;
}): void {
    const { peekResult, actorHasAdmin } = input;
    const effectKind = peekResult.success ? peekResult.data?.effect?.kind : undefined;

    if (effectKind === PromoEffectKindEnum.COMP) {
        throw new HTTPException(403, {
            message:
                'Complimentary codes cannot be redeemed here. Contact support if you were promised one.',
            cause: { code: COMP_NOT_SELF_SERVICE_REASON }
        });
    }

    if (actorHasAdmin) return;

    if (!peekResult.success) {
        const status = peekResult.error?.code === ServiceErrorCode.NOT_FOUND ? 404 : 500;
        throw new HTTPException(status as 404 | 500, {
            message: peekResult.error?.message ?? 'Promo code not found'
        });
    }

    if (effectKind !== PromoEffectKindEnum.TRIAL_EXTENSION) {
        throw new HTTPException(422, {
            message:
                'This is a discount code. It has not been used — apply it when you subscribe to a plan.',
            cause: { code: DISCOUNT_AT_CHECKOUT_REASON }
        });
    }
}
