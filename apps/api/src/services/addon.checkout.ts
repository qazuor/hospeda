/**
 * Add-on Checkout Module
 *
 * Handles creation of qzpay-managed checkout sessions for add-on purchases
 * and confirmation of purchases after payment webhook callbacks.
 *
 * @module services/addon.checkout
 */

import { randomUUID } from 'node:crypto';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { DrizzleClient } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { BillingPlanResponse } from '@repo/schemas';
import type {
    ConfirmPurchaseInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    ServiceResult
} from '@repo/service-core';
import { AddonCatalogService, PlanService } from '@repo/service-core';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';
import type { AddonEntitlementService } from './addon-entitlement.service';
import { PromoCodeService } from './promo-code.service';

// ─── Plan service (DB-backed plan reads — SPEC-127 T-002) ─────────────────────
// Instantiated once at module level; stateless, no DB connection held.
//
// Post-SPEC-168, `planId` may be a `billing_plans` UUID (new rows) or a
// legacy slug (older rows/seeds). Use `resolvePlanByIdOrSlug` for dual-resolve.
const planService = new PlanService();

// ─── Addon catalog service (DB-backed addon reads — SPEC-127 T-003) ───────────
// Replaces `getAddonBySlug` from `@repo/billing` (config catalog).
// Instantiated once at module level; stateless, no DB connection held.
const addonCatalogService = new AddonCatalogService();

/**
 * Resolves a billing plan from the DB using dual-resolve:
 * 1. Try `getById(planId)` — succeeds for UUID planIds.
 * 2. On NOT_FOUND, fall back to `getBySlug(planId)` — handles slug planIds.
 *
 * Returns `null` if neither lookup succeeds.
 *
 * @param planId - UUID or slug of the billing plan
 * @returns Resolved plan or `null` when not found
 */
async function resolvePlanByIdOrSlug(planId: string): Promise<BillingPlanResponse | null> {
    const byId = await planService.getById(planId);
    if (byId.success) {
        return byId.data;
    }
    const bySlug = await planService.getBySlug(planId);
    if (bySlug.success) {
        return bySlug.data;
    }
    return null;
}

/**
 * Create a qzpay-managed checkout session for an add-on purchase.
 *
 * Validates that:
 * - The add-on exists and is active
 * - The customer exists
 * - The customer has an active or trialing subscription
 * - The promo code (if provided) is valid
 *
 * Then creates a checkout session via `billing.checkout.create()` with a
 * 30-minute expiration window and records promo code usage if applicable.
 *
 * @param billing - QZPay billing instance
 * @param input - Purchase request details
 * @returns Checkout URL, order ID, amount, and expiration
 *
 * @example
 * ```ts
 * const result = await createAddonCheckout(billing, {
 *   customerId: 'cust_123',
 *   addonSlug: 'extra-photos',
 *   userId: 'user_456',
 *   promoCode: 'SAVE10',
 * });
 * if (result.success) {
 *   redirect(result.data.checkoutUrl);
 * }
 * ```
 */
export async function createAddonCheckout(
    billing: QZPayBilling,
    input: PurchaseAddonInput
): Promise<ServiceResult<PurchaseAddonResult>> {
    try {
        const addonResult = await addonCatalogService.getBySlug(input.addonSlug);

        if (!addonResult.success) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${input.addonSlug}' not found` }
            };
        }

        const addon = addonResult.data;

        if (!addon.isActive) {
            return {
                success: false,
                error: {
                    code: 'ADDON_INACTIVE',
                    message: 'This add-on is not currently available for purchase'
                }
            };
        }

        const customer = await billing.customers.get(input.customerId);

        if (!customer) {
            return {
                success: false,
                error: { code: 'CUSTOMER_NOT_FOUND', message: 'Billing customer not found' }
            };
        }

        const subscriptions = await billing.subscriptions.getByCustomerId(input.customerId);

        if (!subscriptions || subscriptions.length === 0) {
            return {
                success: false,
                error: {
                    code: 'NO_SUBSCRIPTION',
                    message: 'You must have an active subscription to purchase add-ons'
                }
            };
        }

        const activeSubscription = subscriptions.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            return {
                success: false,
                error: {
                    code: 'NO_ACTIVE_SUBSCRIPTION',
                    message: 'You must have an active subscription to purchase add-ons'
                }
            };
        }

        // Validate addon is available for the customer's plan category.
        // Post-SPEC-168, planId may be a UUID or a legacy slug — use dual-resolve
        // via PlanService (DB-backed) rather than the static ALL_PLANS config.
        if (addon.targetCategories && addon.targetCategories.length > 0) {
            const customerPlan = await resolvePlanByIdOrSlug(activeSubscription.planId);
            if (customerPlan && !addon.targetCategories.includes(customerPlan.category)) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_NOT_AVAILABLE_FOR_PLAN',
                        message: `This add-on is not available for ${customerPlan.category} plans`
                    }
                };
            }
        }

        // Validate and apply promo code if provided
        let finalPrice = addon.priceArs;
        let promoCodeId: string | undefined;
        let discountAmount = 0;

        if (input.promoCode) {
            const promoService = new PromoCodeService();
            const validation = await promoService.validate(input.promoCode, {
                userId: input.userId,
                amount: addon.priceArs
            });

            if (!validation.valid) {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_PROMO_CODE',
                        message: validation.errorMessage || 'Invalid promo code'
                    }
                };
            }

            if (validation.discountAmount) {
                discountAmount = validation.discountAmount;
                finalPrice = Math.max(0, addon.priceArs - discountAmount);
            }

            const promoCodeResult = await promoService.getByCode(input.promoCode);
            if (promoCodeResult.success && promoCodeResult.data) {
                promoCodeId = promoCodeResult.data.id;
            }
        }

        // SPEC-109 fix #5/#6: use a UUID as the idempotency key. A retry from
        // the same logical checkout reuses the same UUID, so the provider
        // returns the existing session instead of creating a duplicate. The
        // `addon_<slug>_` prefix on orderId is kept for human traceability in
        // the provider dashboard. There is NO access-token guard here: qzpay
        // owns MP credentials (configured at billing adapter init) and throws
        // internally when the adapter is misconfigured — matching the pattern
        // used in the annual subscription flow in subscription-checkout.service.ts.
        const checkoutUuid = randomUUID();
        const orderId = `addon_${addon.slug}_${checkoutUuid}`;
        const webUrl = env.HOSPEDA_SITE_URL;
        if (!webUrl) {
            return {
                success: false,
                error: {
                    code: 'PAYMENT_NOT_CONFIGURED',
                    message: 'HOSPEDA_SITE_URL is not configured'
                }
            };
        }
        const apiUrl = env.HOSPEDA_API_URL;
        if (!apiUrl) {
            return {
                success: false,
                error: {
                    code: 'PAYMENT_NOT_CONFIGURED',
                    message: 'HOSPEDA_API_URL is not configured'
                }
            };
        }

        // customerName is passed as a plain string so the qzpay adapter can
        // derive payer.first_name / payer.last_name via its built-in split logic.
        const customerName =
            typeof customer.metadata?.name === 'string'
                ? customer.metadata.name.trim() || undefined
                : undefined;

        const result = await billing.checkout.create({
            mode: 'payment',
            lineItems: [
                {
                    /**
                     * unitAmount is in centavos (smallest currency unit). The MP adapter
                     * divides by 100 internally when building the preference body — do NOT
                     * pre-divide here.
                     */
                    unitAmount: finalPrice,
                    currency: 'ARS',
                    quantity: 1,
                    title: addon.name,
                    description: addon.description,
                    /**
                     * 'services' is the canonical MP category_id for digital SaaS.
                     * Now passed via qzpay's `categoryId` field — the adapter maps it
                     * to `items[].category_id` on the MP preference body.
                     */
                    categoryId: 'services'
                }
            ],
            successUrl: `${webUrl}/mi-cuenta/addons?status=success&addon=${addon.slug}`,
            cancelUrl: `${webUrl}/mi-cuenta/addons?status=failure&addon=${addon.slug}`,
            customerId: input.customerId,
            customerEmail: customer.email,
            ...(customerName !== undefined ? { customerName } : {}),
            notificationUrl: `${apiUrl}/api/v1/webhooks/mercadopago`,
            idempotencyKey: checkoutUuid,
            ...(env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR
                ? { statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR }
                : {}),
            expiresInMinutes: 30,
            /**
             * Metadata is intentionally sent in both snake_case and camelCase formats
             * for backward compatibility.
             *
             * - snake_case keys (e.g. `addon_slug`, `customer_id`): consumed by the
             *   MercadoPago webhook handler, which receives the raw MP payment object
             *   where metadata arrives in snake_case.
             * - camelCase keys (e.g. `addonSlug`, `customerId`): consumed by internal
             *   services (e.g. confirmAddonPurchase) that work with the JS-normalized
             *   representation.
             *
             * Do NOT remove either format without coordinating with the webhook handler
             * and any downstream consumers.
             *
             * `order_id` is added here (not in the original MP path) so the webhook
             * handler can correlate back to the orderId for tracing.
             */
            metadata: {
                addon_slug: addon.slug,
                addonSlug: addon.slug,
                customer_id: input.customerId,
                customerId: input.customerId,
                user_id: input.userId,
                userId: input.userId,
                type: 'addon_purchase',
                order_id: orderId,
                promo_code: input.promoCode || null,
                promo_code_id: promoCodeId || null,
                discount_amount: discountAmount,
                original_price: addon.priceArs
            }
        });

        // Intentionally prod-first (init_point before sandbox_init_point).
        // The original direct-MP path was sandbox-first; this aligns with the
        // qzpay convention used in the annual subscription flow.
        const checkoutUrl = result.providerInitPoint ?? result.providerSandboxInitPoint;

        if (!checkoutUrl) {
            return {
                success: false,
                error: {
                    code: 'CHECKOUT_ERROR',
                    message: 'Failed to get checkout URL from payment provider'
                }
            };
        }

        // Use the session's own expiresAt (qzpay sets it from expiresInMinutes).
        const expiresAt = result.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

        // NOTE: Promo code usage (incrementUsage + recordUsage) is intentionally
        // NOT recorded here. It is recorded in confirmAddonPurchase() after payment
        // is confirmed, to prevent inflated usage counts from abandoned checkouts.

        apiLogger.info(
            {
                customerId: input.customerId,
                addonSlug: addon.slug,
                billingType: addon.billingType,
                amount: finalPrice,
                originalAmount: addon.priceArs,
                discountAmount,
                promoCode: input.promoCode,
                orderId,
                checkoutSessionId: result.id
            },
            'Created add-on checkout via qzpay billing'
        );

        return {
            success: true,
            data: {
                checkoutUrl,
                orderId,
                addonId: addon.slug,
                amount: finalPrice,
                currency: 'ARS',
                expiresAt: expiresAt.toISOString()
            }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId: input.customerId, addonSlug: input.addonSlug },
            'Failed to create add-on checkout'
        );

        return {
            success: false,
            error: {
                code: 'CHECKOUT_ERROR',
                message: 'Failed to create checkout session for add-on purchase'
            }
        };
    }
}

/**
 * Confirm an add-on purchase after payment webhook.
 *
 * Inserts a record into `billing_addon_purchases`, computes limit and
 * entitlement adjustments from the add-on definition, and applies them to the
 * subscription metadata for backward compatibility.
 *
 * @param billing - QZPay billing instance
 * @param entitlementService - AddonEntitlementService for applying entitlements
 * @param input - Customer ID, add-on slug, and optional payment context
 * @returns Success or error result
 *
 * @example
 * ```ts
 * const result = await confirmAddonPurchase(billing, entitlementService, {
 *   customerId: 'cust_123',
 *   addonSlug: 'extra-photos',
 *   paymentId: 'pay_789',
 * });
 * ```
 */
export async function confirmAddonPurchase(
    billing: QZPayBilling,
    entitlementService: AddonEntitlementService,
    input: ConfirmPurchaseInput & { tx?: DrizzleClient }
): Promise<ServiceResult<void>> {
    try {
        const addonResult = await addonCatalogService.getBySlug(input.addonSlug);

        if (!addonResult.success) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${input.addonSlug}' not found` }
            };
        }

        const addon = addonResult.data;

        const subscriptions = await billing.subscriptions.getByCustomerId(input.customerId);

        if (!subscriptions || subscriptions.length === 0) {
            return {
                success: false,
                error: { code: 'NO_SUBSCRIPTION', message: 'Customer has no active subscription' }
            };
        }

        const activeSubscription = subscriptions.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            return {
                success: false,
                error: {
                    code: 'NO_ACTIVE_SUBSCRIPTION',
                    message: 'Customer has no active subscription'
                }
            };
        }

        // Resolve plan limits via PlanService (DB-backed, dual-resolve).
        // Post-SPEC-168, planId may be a UUID or a legacy slug — PlanService handles
        // both. The DB `limits` field is `Record<string, number>` (key → value map).
        // When the plan cannot be resolved, limit baseline defaults to 0 (soft-skip).
        const canonicalPlan = await resolvePlanByIdOrSlug(activeSubscription.planId);

        // Compute limit adjustments
        const limitAdjustments: Array<{
            limitKey: string;
            increase: number;
            previousValue: number;
            newValue: number;
        }> = [];

        if (addon.affectsLimitKey && addon.limitIncrease) {
            const previousValue = canonicalPlan?.limits[addon.affectsLimitKey] ?? 0;
            const newValue = previousValue + addon.limitIncrease;

            limitAdjustments.push({
                limitKey: addon.affectsLimitKey,
                increase: addon.limitIncrease,
                previousValue,
                newValue
            });
        }

        // Compute entitlement adjustments
        const entitlementAdjustments: Array<{
            entitlementKey: string;
            granted: boolean;
        }> = [];

        if (addon.grantsEntitlement) {
            entitlementAdjustments.push({
                entitlementKey: addon.grantsEntitlement,
                granted: true
            });
        }

        const now = new Date();
        const expiresAt =
            addon.billingType === 'one_time' && addon.durationDays
                ? new Date(now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000)
                : null;

        const { withTransaction } = await import('@repo/db/client');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

        // Re-verify the subscription is still active immediately before the DB
        // insert. The initial check at the top of this function happened earlier
        // in the request lifecycle; the subscription could have been cancelled
        // in the window between checkout creation and payment confirmation.
        const currentSubscriptions = await billing.subscriptions.getByCustomerId(input.customerId);
        const stillActive = currentSubscriptions?.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!stillActive) {
            return {
                success: false,
                error: {
                    code: 'SUBSCRIPTION_CANCELLED',
                    message:
                        'Cannot confirm addon purchase: subscription was cancelled during checkout'
                }
            };
        }

        // Wrap DB operations in a transaction to ensure atomicity.
        // When input.tx is provided (caller already holds a transaction), reuse it
        // directly via withTransaction's existingTx passthrough to avoid nesting.
        let purchaseId: string;

        const { sql: drizzleSql } = await import('drizzle-orm');

        try {
            const [insertedPurchase] = await withTransaction(async (tx) => {
                // ── SELECT FOR UPDATE: check for existing active purchase ───────
                // Locks any matching row so a concurrent confirmAddonPurchase for
                // the same customer+addon cannot insert a duplicate between this
                // read and the INSERT below (TOCTOU prevention).
                const existing = await tx.execute<{ id: string }>(
                    drizzleSql`SELECT id
                               FROM   billing_addon_purchases
                               WHERE  customer_id = ${input.customerId}
                                 AND  addon_slug  = ${input.addonSlug}
                                 AND  status      = 'active'
                                 AND  deleted_at  IS NULL
                               LIMIT  1
                               FOR UPDATE`
                );

                if (existing.rows.length > 0) {
                    // Throw a sentinel so the outer catch can return the right error
                    // without logging it as an unexpected failure.
                    const err = new Error('ADDON_ALREADY_ACTIVE') as Error & { sentinel: true };
                    err.sentinel = true;
                    throw err;
                }

                return tx
                    .insert(billingAddonPurchases)
                    .values({
                        customerId: input.customerId,
                        subscriptionId: input.subscriptionId || activeSubscription.id,
                        addonSlug: input.addonSlug,
                        status: 'active',
                        purchasedAt: now,
                        expiresAt,
                        paymentId: input.paymentId || null,
                        limitAdjustments,
                        entitlementAdjustments,
                        metadata: input.metadata || {}
                    })
                    .returning({ id: billingAddonPurchases.id });
            }, input.tx);

            if (!insertedPurchase) {
                return {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Failed to insert add-on purchase record'
                    }
                };
            }

            purchaseId = insertedPurchase.id;
        } catch (insertError) {
            // Sentinel thrown by the FOR UPDATE check above
            if (
                insertError instanceof Error &&
                'sentinel' in insertError &&
                (insertError as Error & { sentinel: boolean }).sentinel
            ) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_ALREADY_ACTIVE',
                        message: 'Addon already active for this customer'
                    }
                };
            }

            // Postgres unique constraint violation (partial index: active addon per customer)
            if (
                insertError instanceof Error &&
                'code' in insertError &&
                (insertError as { code: string }).code === '23505'
            ) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_ALREADY_ACTIVE',
                        message: 'Addon already active for this customer'
                    }
                };
            }

            throw insertError;
        }

        apiLogger.info(
            {
                customerId: input.customerId,
                addonSlug: input.addonSlug,
                subscriptionId: activeSubscription.id,
                purchaseId,
                expiresAt: expiresAt?.toISOString() || null,
                limitAdjustments,
                entitlementAdjustments
            },
            'Inserted add-on purchase into billing_addon_purchases table'
        );

        // Clear entitlement cache so the new add-on is reflected immediately
        clearEntitlementCache(input.customerId);

        // Apply entitlements to JSON metadata for backward compatibility.
        // This uses the billing SDK (not direct DB), so it runs outside the
        // transaction. Failure is non-fatal and logged as a warning.
        const result = await entitlementService.applyAddonEntitlements({
            customerId: input.customerId,
            addonSlug: input.addonSlug,
            purchaseId
        });

        if (!result.success) {
            apiLogger.warn(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    error: result.error
                },
                'Failed to apply add-on to JSON metadata (backward compat), but table insert succeeded'
            );
        }

        // Record promo code usage now that payment is confirmed (GAP-043-049).
        // Doing this here (not at checkout creation) prevents inflating usage
        // counts for abandoned checkouts.
        const confirmedPromoCodeId =
            typeof input.metadata?.promoCodeId === 'string'
                ? input.metadata.promoCodeId
                : undefined;
        const confirmedPromoCode =
            typeof input.metadata?.promoCode === 'string' ? input.metadata.promoCode : undefined;
        const confirmedDiscountAmount =
            typeof input.metadata?.discountAmount === 'number' ? input.metadata.discountAmount : 0;

        if (confirmedPromoCodeId && confirmedPromoCode) {
            const promoService = new PromoCodeService();
            const redeemResult = await promoService.redeemAndRecord({
                promoCodeId: confirmedPromoCodeId,
                customerId: input.customerId,
                discountAmount: confirmedDiscountAmount,
                currency: 'ARS'
            });

            if (redeemResult.success) {
                apiLogger.info(
                    {
                        promoCodeId: confirmedPromoCodeId,
                        promoCode: confirmedPromoCode,
                        customerId: input.customerId,
                        discountAmount: confirmedDiscountAmount
                    },
                    'Promo code usage recorded after payment confirmation'
                );
            } else {
                // Non-fatal: log and continue — purchase is already committed
                apiLogger.warn(
                    {
                        promoCodeId: confirmedPromoCodeId,
                        promoCode: confirmedPromoCode,
                        error: redeemResult.error.message
                    },
                    'Failed to record promo code usage after payment confirmation'
                );
            }
        }

        apiLogger.info(
            { customerId: input.customerId, addonSlug: input.addonSlug },
            'Add-on purchase confirmed and entitlements applied'
        );

        // Fire-and-forget: notify the user about the purchase confirmation.
        // Failure is non-blocking — the purchase already succeeded.
        try {
            const customer = await billing.customers.get(input.customerId);
            if (customer) {
                const customerName =
                    typeof customer.metadata?.name === 'string'
                        ? customer.metadata.name
                        : (customer.email ?? 'Usuario');
                const userId =
                    typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;
                sendNotification({
                    type: NotificationType.ADDON_PURCHASE,
                    recipientEmail: customer.email,
                    recipientName: customerName,
                    userId,
                    customerId: input.customerId,
                    planName: addon.name,
                    amount: addon.priceArs,
                    currency: 'ARS',
                    nextBillingDate: expiresAt?.toISOString() || undefined
                }).catch((notifErr) => {
                    apiLogger.debug(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            error: notifErr instanceof Error ? notifErr.message : String(notifErr)
                        },
                        'ADDON_PURCHASE notification failed (non-blocking)'
                    );
                });
            }
        } catch (notifLookupErr) {
            apiLogger.debug(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    error:
                        notifLookupErr instanceof Error
                            ? notifLookupErr.message
                            : String(notifLookupErr)
                },
                'Could not look up customer for ADDON_PURCHASE notification, skipping'
            );
        }

        return { success: true, data: undefined };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId: input.customerId, addonSlug: input.addonSlug },
            'Failed to confirm add-on purchase'
        );

        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm add-on purchase' }
        };
    }
}
