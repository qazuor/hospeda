/**
 * Promo-code trial-extension apply seam (HOS-1012 T-039).
 *
 * This is the **API-side executable seam** for applying a `trial_extension`
 * effect to a trial the host is ALREADY running. Since HOS-1012 a Hospeda trial
 * is a local `billing_subscriptions` row with `status = 'trialing'` and
 * `mp_subscription_id IS NULL`, so extending it is a single-row `UPDATE` with
 * nothing to reconcile against MercadoPago — strictly simpler than the
 * MercadoPago `auto_recurring.free_trial` summing that T-021 removed from
 * checkout.
 *
 * It is the sibling of `promo-discount-apply.service.ts` (the `discount` seam)
 * and glues together:
 *
 * 1. `getPromoCodeByCode` — resolve + validate the code BEFORE anything is
 *    redeemed (unknown / inactive / expired / wrong-effect all fail here).
 * 2. Target-trial resolution — the caller's explicit `subscriptionId`, or the
 *    customer's own running trial.
 * 3. `extendExistingSubscriptionTrial` (`@repo/service-core`) — the mutator that
 *    pushes `trial_end` and records the usage row atomically.
 *
 * **Why the resolution happens here and not inside the mutator:** a customer
 * with no running trial must get a typed `NO_ACTIVE_TRIAL` back WITHOUT the
 * code being burnt. Before this seam existed, the `/apply` route handed
 * `trial_extension` codes to `applyPromoCode`, which redeems the code (it
 * increments `used_count` and writes a usage row) and then returned a
 * `trialEnd` computed from `new Date()` that was never persisted anywhere —
 * the customer was told a date that did not exist and the code was spent.
 *
 * **FOLLOW-UP (not implemented here, deliberately):** the other entry point the
 * owner accepted is capturing the code BEFORE the trial exists — at signup or
 * at the publish step — persisting it, and reading it when the trial row is
 * created so the trial is BORN long instead of being extended afterwards. That
 * variant needs somewhere to park the code between capture and trial creation
 * plus a read at creation time in `subscription-trial-create.service.ts`; it is
 * a separate issue. This seam covers the simpler half the owner asked for
 * first: a code applied against a trial that is already running.
 *
 * @module services/promo-trial-extension-apply.service
 */

import { and, billingSubscriptions, desc, eq, getDb } from '@repo/db';
import {
    ProductDomainEnum,
    type ProductDomainValue,
    PromoEffectKindEnum,
    ServiceErrorCode,
    SubscriptionStatusEnum
} from '@repo/schemas';
import {
    extendExistingSubscriptionTrial,
    getPromoCodeByCode,
    subscriptionMatchesDomain
} from '@repo/service-core';

/**
 * Typed error code returned when the caller has no trial to extend.
 *
 * Distinct from `VALIDATION_ERROR` so the route can answer 422 with a message
 * the host can act on ("you have no trial running") instead of a generic 400,
 * and so callers can assert on the no-op path. The promo code is NOT redeemed
 * when this is returned.
 */
export const NO_ACTIVE_TRIAL_ERROR_CODE = 'NO_ACTIVE_TRIAL' as const;

/**
 * Typed result of applying a trial-extension promo code to a running trial.
 */
export type ApplyTrialExtensionToRunningTrialResult =
    | {
          readonly success: true;
          readonly data: {
              /** UUID of the subscription whose trial was extended */
              readonly subscriptionId: string;
              /** The `trial_end` value that is now PERSISTED on the row */
              readonly newTrialEnd: Date;
              /** Calendar days added by the code */
              readonly daysAdded: number;
              /** UUID of the `billing_promo_code_usage` row written */
              readonly usageRecordId: string;
          };
      }
    | {
          readonly success: false;
          readonly error: { readonly code: string; readonly message: string };
      };

/**
 * Resolve the subscription whose trial should be extended for a billing customer.
 *
 * Callers that already know which subscription they mean pass `subscriptionId`
 * on the public function and never reach this.
 *
 * **HOS-1277 — ordered domain preference, not "most recent, any vertical".**
 * Since HOS-688 one billing customer can run MULTIPLE trials at once — one per
 * vertical (a dual-role host-provider is the concrete case: an accommodation
 * trial and a gastronomy trial, both `trialing`, simultaneously). The web has
 * no way to tell this seam which vertical a redemption is for yet (`input.domain`
 * exists for a future caller that can), so absent an explicit domain this picks
 * deterministically rather than by creation order: ACCOMMODATION first, then
 * TOURIST (the same ordered pair `selectAccommodationSubscription`
 * (`services/billing/plan-domain-guard.ts`) and `entitlement.ts` use for "the
 * customer's own consumer plan" per HOS-1233 — never an unordered match
 * between them), and only when the customer holds
 * NEITHER does it fall back to the single most-recently-created trial of
 * whatever vertical remains. Before this, a promo code meant to extend an
 * accommodation trial could silently land on a newer gastronomy trial (or vice
 * versa) purely because of which one was created later.
 *
 * @param input.billingCustomerId - The billing customer to search.
 * @param input.domain - Optional explicit target domain. When supplied, only a
 *   trial in exactly this domain is returned (no ordered fallback).
 * @returns The subscription id, or `null` when no matching trial is running.
 * @internal
 */
async function findRunningTrialSubscriptionId(input: {
    readonly billingCustomerId: string;
    readonly domain?: ProductDomainValue;
}): Promise<string | null> {
    const rows = await getDb()
        .select({ id: billingSubscriptions.id, productDomain: billingSubscriptions.productDomain })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, input.billingCustomerId),
                eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING)
            )
        )
        .orderBy(desc(billingSubscriptions.createdAt));

    if (rows.length === 0) {
        return null;
    }

    if (input.domain) {
        return (
            rows.find((row) => subscriptionMatchesDomain(row, input.domain as ProductDomainValue))
                ?.id ?? null
        );
    }

    return (
        rows.find((row) => subscriptionMatchesDomain(row, ProductDomainEnum.ACCOMMODATION))?.id ??
        rows.find((row) => subscriptionMatchesDomain(row, ProductDomainEnum.TOURIST))?.id ??
        // Neither: the customer's only running trial(s) are in a commerce
        // vertical (gastronomy/experience/partner). No ordering precedent
        // exists across those yet, so keep the pre-HOS-1277 behavior — the
        // most recently created — for this narrower remaining case.
        rows[0]?.id ??
        null
    );
}

/**
 * Apply a `trial_extension` promo code to a trial that is already running.
 *
 * Ordering is fail-closed on the code: every reason to refuse (unknown code,
 * inactive, expired, wrong effect kind, no running trial) is decided BEFORE
 * `extendExistingSubscriptionTrial` is called, so a refused application never
 * increments `used_count` and never writes a usage row. Once the mutator IS
 * called, the usage row and the `trial_end` UPDATE share one transaction — the
 * code cannot be spent on days that were not granted, and days cannot be
 * granted without the code being spent.
 *
 * The returned `newTrialEnd` is the value read back from the mutator — i.e. the
 * value that is now on the row — never a projection computed from `new Date()`.
 *
 * @param input.code - Promo code string as typed by the host (case-insensitive).
 * @param input.billingCustomerId - The caller's own billing customer id.
 * @param input.actorId - The acting user's id (audit only; usage is attributed
 *   to the subscription's customer inside the mutator).
 * @param input.subscriptionId - Optional explicit target. Ownership MUST have
 *   been verified by the caller (the route runs `assertSubscriptionOwnership`).
 * @param input.domain - Optional explicit target domain (HOS-1277), for a
 *   caller that knows which vertical's trial it means. Not yet wired to the
 *   web — no route passes it today — so omitting it falls back to the ordered
 *   accommodation-then-tourist auto-resolution documented on
 *   `findRunningTrialSubscriptionId`. Ignored when `subscriptionId` is given.
 * @param input.livemode - Whether to operate in live mode (default: false).
 * @returns Typed success carrying the PERSISTED `trial_end`, or a typed error.
 *
 * @example
 * ```ts
 * const result = await applyTrialExtensionToRunningTrial({
 *   code: 'LANZAMIENTO60',
 *   billingCustomerId,
 *   actorId: actor.id
 * });
 * if (result.success) console.log(result.data.newTrialEnd); // persisted
 * ```
 */
export async function applyTrialExtensionToRunningTrial(input: {
    readonly code: string;
    readonly billingCustomerId: string;
    readonly actorId: string;
    readonly subscriptionId?: string;
    readonly domain?: ProductDomainValue;
    readonly livemode?: boolean;
}): Promise<ApplyTrialExtensionToRunningTrialResult> {
    const { code, billingCustomerId, actorId, subscriptionId, domain, livemode = false } = input;

    try {
        // Step 1: resolve + validate the code. Mirrors the checks `applyPromoCode`
        // runs (active + expiry) so this path is not more permissive than the one
        // it replaces. Restriction checks (newCustomersOnly / validPlans) stay
        // where they already live — the `/validate` route.
        const promoResult = await getPromoCodeByCode(code.toUpperCase());
        if (!promoResult.success || !promoResult.data) {
            return {
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }
        const promoCode = promoResult.data;

        if (!promoCode.active) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'This promo code is no longer active'
                }
            };
        }

        if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'This promo code has expired'
                }
            };
        }

        if (!promoCode.effect || promoCode.effect.kind !== PromoEffectKindEnum.TRIAL_EXTENSION) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Promo code does not have a trial_extension effect.'
                }
            };
        }

        // Step 2: resolve the target trial. No trial → typed no-op; the code is
        // left unburnt and usable once a trial does exist.
        const targetSubscriptionId =
            subscriptionId ?? (await findRunningTrialSubscriptionId({ billingCustomerId, domain }));

        if (!targetSubscriptionId) {
            return {
                success: false,
                error: {
                    code: NO_ACTIVE_TRIAL_ERROR_CODE,
                    message:
                        'No trial is currently running on this account, so there is nothing to extend. ' +
                        'The promo code was not used and stays valid.'
                }
            };
        }

        // Step 3: the real mutation — pushes `trial_end` on the row and records
        // the usage atomically. It re-checks `status === 'trialing'` itself, so an
        // explicitly-passed subscription that is not in trial is refused there
        // (also without burning the code).
        const extended = await extendExistingSubscriptionTrial({
            subscriptionId: targetSubscriptionId,
            promoCodeId: promoCode.id,
            actorId,
            livemode
        });

        if (!extended.success) {
            return { success: false, error: extended.error };
        }

        return {
            success: true,
            data: {
                subscriptionId: extended.data.subscriptionId,
                newTrialEnd: extended.data.newTrialEnd,
                daysAdded: extended.data.daysAdded,
                usageRecordId: extended.data.usageRecordId
            }
        };
    } catch (error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    error instanceof Error ? error.message : 'Failed to apply the trial extension'
            }
        };
    }
}
