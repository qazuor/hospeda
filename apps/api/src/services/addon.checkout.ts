/**
 * Add-on Checkout Module
 *
 * Handles creation of Mercado Pago checkout sessions for add-on purchases
 * and confirmation of purchases after payment webhook callbacks.
 *
 * @module services/addon.checkout
 */

import { randomUUID } from 'node:crypto';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getAddonBySlug } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { BillingPlanResponse } from '@repo/schemas';
import type {
    ConfirmPurchaseInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    ServiceResult
} from '@repo/service-core';
import { PlanService } from '@repo/service-core';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { PreferenceCreateData } from 'mercadopago/dist/clients/preference/create/types';
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

// TODO: Extend @repo/billing adapter to support preference creation.
// Once the billing adapter has a createPreference() method, replace
// createMercadoPagoPreference() below with the adapter call.

/**
 * Creates a MercadoPago preference using the raw SDK.
 *
 * This is a thin wrapper that centralizes raw SDK usage to a single place,
 * making future migration to the billing adapter straightforward.
 *
 * The `idempotencyKey` is forwarded to MercadoPago via the `X-Idempotency-Key`
 * header. MP guarantees that two calls made with the same key (within their
 * dedup window) return the same preference, which makes retries safe and
 * prevents duplicate preferences from double-clicks or transient network
 * errors.
 *
 * @param accessToken - MercadoPago API access token
 * @param preferenceData - Preference creation data
 * @param idempotencyKey - UUID forwarded as MP's X-Idempotency-Key header
 * @returns Created preference object
 */
async function createMercadoPagoPreference({
    accessToken,
    preferenceData,
    idempotencyKey
}: {
    accessToken: string;
    preferenceData: PreferenceCreateData;
    idempotencyKey: string;
}) {
    const mpClient = new MercadoPagoConfig({ accessToken });
    const preferenceClient = new Preference(mpClient);
    return preferenceClient.create({
        ...preferenceData,
        requestOptions: {
            ...preferenceData.requestOptions,
            idempotencyKey
        }
    });
}

/**
 * MercadoPago category id for digital services / SaaS subscriptions.
 *
 * Set on every `items[].category_id`. MP's fraud engine uses this to model
 * approval rate; populating it (instead of leaving it blank) is one of the
 * 14 mandatory items in MP's quality checklist.
 */
const MP_ITEM_CATEGORY_ID = 'services';

/**
 * Payer fields required by MercadoPago Checkout Pro for quality compliance.
 *
 * MP rejects empty strings on `payer.last_name`, so callers must always
 * supply a non-empty value (a single space is acceptable as a fallback).
 */
interface MercadoPagoPayerInfo {
    readonly email: string;
    readonly first_name: string;
    readonly last_name: string;
}

/**
 * Derive `payer` fields for a MercadoPago preference from a billing customer.
 *
 * MercadoPago Checkout Pro's quality checklist requires `payer.email`,
 * `payer.first_name`, and `payer.last_name` to be populated. We source them
 * from the QZPay billing customer:
 *
 * - `email` comes directly from `customer.email`.
 * - `first_name` and `last_name` are split from `customer.metadata.name` on
 *   the first space. When `metadata.name` is missing or empty, we fall back
 *   to the local-part of the email for `first_name` and a single space for
 *   `last_name` (MP rejects empty strings).
 *
 * @param customer - Billing customer with `email` and optional `metadata.name`
 * @returns Payer info ready to embed in the preference body
 */
function extractPayerInfo(customer: {
    readonly email: string;
    readonly metadata?: Record<string, unknown> | null;
}): MercadoPagoPayerInfo {
    const rawName =
        typeof customer.metadata?.name === 'string' ? customer.metadata.name.trim() : '';
    const emailLocalPart = customer.email.split('@')[0] || customer.email;

    if (rawName.length === 0) {
        return {
            email: customer.email,
            first_name: emailLocalPart,
            last_name: ' '
        };
    }

    const firstSpaceIdx = rawName.indexOf(' ');
    if (firstSpaceIdx === -1) {
        return {
            email: customer.email,
            first_name: rawName,
            last_name: ' '
        };
    }

    const firstName = rawName.slice(0, firstSpaceIdx);
    const lastName = rawName.slice(firstSpaceIdx + 1).trim() || ' ';

    return {
        email: customer.email,
        first_name: firstName,
        last_name: lastName
    };
}

/**
 * Create a Mercado Pago checkout session for an add-on purchase.
 *
 * Validates that:
 * - The add-on exists and is active
 * - The customer exists
 * - The customer has an active or trialing subscription
 * - The promo code (if provided) is valid
 *
 * Then creates a Mercado Pago Preference with a 30-minute expiration window and
 * records promo code usage if applicable.
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
        const addon = getAddonBySlug(input.addonSlug);

        if (!addon) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${input.addonSlug}' not found` }
            };
        }

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

        const mpAccessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
        if (!mpAccessToken) {
            return {
                success: false,
                error: {
                    code: 'PAYMENT_NOT_CONFIGURED',
                    message: 'Payment system is not configured'
                }
            };
        }

        // SPEC-109 fix #5/#6: use a UUID for the external_reference AND as the
        // MP X-Idempotency-Key. A retry from the same logical checkout reuses
        // the same UUID, so MP returns the existing preference instead of
        // creating a duplicate. The `addon_<slug>_` prefix is kept for human
        // traceability inside the MP dashboard.
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

        const payer = extractPayerInfo(customer);

        const preference = await createMercadoPagoPreference({
            accessToken: mpAccessToken,
            idempotencyKey: checkoutUuid,
            preferenceData: {
                body: {
                    items: [
                        {
                            id: addon.slug,
                            title: addon.name,
                            description: addon.description,
                            category_id: MP_ITEM_CATEGORY_ID,
                            quantity: 1,
                            // Convert centavos to whole ARS units (MercadoPago expects ARS, not cents)
                            unit_price: finalPrice / 100,
                            currency_id: 'ARS'
                        }
                    ],
                    payer,
                    /**
                     * Metadata is intentionally sent in both snake_case and camelCase formats
                     * for backward compatibility.
                     *
                     * - snake_case keys (e.g. `addon_slug`, `customer_id`): consumed by the
                     *   Mercado Pago webhook handler, which receives the raw MP payment object
                     *   where metadata arrives in snake_case.
                     * - camelCase keys (e.g. `addonSlug`, `customerId`): consumed by internal
                     *   services (e.g. confirmAddonPurchase) that work with the JS-normalized
                     *   representation.
                     *
                     * Do NOT remove either format without coordinating with the webhook handler
                     * and any downstream consumers.
                     */
                    metadata: {
                        addon_slug: addon.slug,
                        addonSlug: addon.slug,
                        customer_id: input.customerId,
                        customerId: input.customerId,
                        user_id: input.userId,
                        userId: input.userId,
                        type: 'addon_purchase',
                        promo_code: input.promoCode || null,
                        promo_code_id: promoCodeId || null,
                        discount_amount: discountAmount,
                        original_price: addon.priceArs
                    },
                    external_reference: orderId,
                    back_urls: {
                        success: `${webUrl}/mi-cuenta/addons?status=success&addon=${addon.slug}`,
                        failure: `${webUrl}/mi-cuenta/addons?status=failure&addon=${addon.slug}`,
                        pending: `${webUrl}/mi-cuenta/addons?status=pending&addon=${addon.slug}`
                    },
                    auto_return: 'approved',
                    notification_url: `${apiUrl}/api/v1/webhooks/mercadopago`,
                    statement_descriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR,
                    expires: true,
                    expiration_date_from: new Date().toISOString(),
                    expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                }
            }
        });

        const checkoutUrl = preference.sandbox_init_point || preference.init_point || '';

        if (!checkoutUrl) {
            return {
                success: false,
                error: {
                    code: 'CHECKOUT_ERROR',
                    message: 'Failed to get checkout URL from Mercado Pago'
                }
            };
        }

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

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
                preferenceId: preference.id
            },
            'Created add-on checkout with Mercado Pago'
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
        const addon = getAddonBySlug(input.addonSlug);

        if (!addon) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${input.addonSlug}' not found` }
            };
        }

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
