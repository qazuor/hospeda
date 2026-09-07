/**
 * Comp gate for `POST /api/v1/protected/billing/promo-codes/apply`
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
 * when the subscription is the caller's own. In production `HOSPEDA_FREE` was
 * active with `effect_kind = comp` and no `max_uses`, and `getPromoCodeByCode`
 * resolves on `eq(code, …)` alone, so `livemode` never scoped it either.
 * Anyone who learned the string got a permanently free subscription.
 *
 * ## This gate is the SECOND layer, not the fix
 *
 * The fix is that a complimentary subscription is no longer something a promo
 * code can grant AT ALL (owner decision, HOS-1171). `comp` is an admin action
 * on a subscription, exactly like courtesy:
 * `POST /api/v1/admin/billing/subscriptions/grant-comp`
 * (`routes/billing/admin/subscription-comp.ts`, `BILLING_MANAGE`) is the only
 * thing in the codebase that creates one. The two doors a code used to open —
 * this route and the self-serve checkout
 * (`services/subscription-checkout-promo.service.ts`) — both refuse it, and
 * `HOSPEDA_FREE`, the only comp code that ever existed, is retired from the
 * seed baseline and deactivated in every seeded environment by
 * `packages/seed/src/data-migrations/0099-hos-1171-retire-hospeda-free`.
 *
 * The two layers are independent on purpose. A gate has to be REMEMBERED by
 * whoever adds the next door; the absence of a redeemable comp code does not.
 * This one stays because it is cheap and because a comp row can still be
 * created by hand in a database.
 *
 * ## What is deliberately NOT gated
 *
 * **`discount` and `trial_extension`.** Both are ordinary self-service
 * redemptions and this route is where a signed-in customer makes them: a
 * trialing customer extends their trial, and an already-subscribed one applies
 * a discount to the subscription they are paying for (the SPEC-262 T-007 seam,
 * reached when the caller names a `subscriptionId`). An earlier draft of this
 * gate restricted `discount` to admins; that was wrong, and it broke the case
 * the owner actually wants.
 *
 * ## Two smaller decisions worth not re-deriving
 *
 * **Fail-closed on the peek.** A code we could not READ is never handed to a
 * redemption path that would read it again inside its own transaction — we
 * cannot tell whether it was a comp. `NOT_FOUND` keeps answering 404, exactly
 * as `service.apply` did.
 *
 * **403 for `comp`, not the error contract's usual 404.** The rule that a 403
 * must not confirm an id exists is about resources whose ids are guessable and
 * private. It buys nothing here: `POST /validate` — unchanged, and the
 * pre-flight the web form runs — hands back `effectPreview.effectKind` for any
 * code the caller can name. A 404 would only make the honest holder of a
 * legacy comp code read "that code does not exist".
 *
 * @module routes/billing/promo-code-effect-gate
 */

import { PromoEffectKindEnum, ServiceErrorCode } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';

/** Reason forwarded on the `comp` refusal, whitelisted in `utils/entitlement-cause.ts`. */
export const COMP_NOT_SELF_SERVICE_REASON = 'PROMO_CODE_COMP_NOT_SELF_SERVICE' as const;

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
 * Refuses a `comp` promo code before the apply route redeems anything.
 * Returns normally for every other effect kind.
 *
 * The refusal happens BEFORE any redemption, so a refused code is not spent:
 * `used_count` is untouched and no usage row is written.
 *
 * Applies to EVERY caller, admins included — a comp subscription is granted
 * through the admin route, never by redeeming a code.
 *
 * @param input.peekResult - What `PromoCodeService.getByCode` answered for the
 *   submitted code, read BEFORE any mutation.
 * @throws HTTPException 403 when the code carries a `comp` effect.
 * @throws HTTPException 404/500 when the code could not be read at all.
 *
 * @example
 * ```ts
 * const peekResult = await service.getByCode(code);
 * assertPromoCodeIsNotComp({ peekResult });
 * // …only reachable for a discount, a trial_extension, or an untyped legacy code
 * ```
 */
export function assertPromoCodeIsNotComp(input: { readonly peekResult: PromoCodePeek }): void {
    const { peekResult } = input;

    if (!peekResult.success) {
        // Fail closed: an unreadable code might be a comp, and the paths below
        // would read it again inside their own transaction.
        const status = peekResult.error?.code === ServiceErrorCode.NOT_FOUND ? 404 : 500;
        throw new HTTPException(status as 404 | 500, {
            message: peekResult.error?.message ?? 'Promo code not found'
        });
    }

    if (peekResult.data?.effect?.kind === PromoEffectKindEnum.COMP) {
        throw new HTTPException(403, {
            message:
                'Complimentary subscriptions are granted by an operator, not by redeeming a code.',
            cause: { code: COMP_NOT_SELF_SERVICE_REASON }
        });
    }
}
