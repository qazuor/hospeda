/**
 * Add-on Checkout Module
 *
 * Handles creation of Mercado Pago checkout sessions for add-on purchases
 * and confirmation of purchases after payment webhook callbacks.
 *
 * @module services/addon.checkout
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ALL_PLANS, getAddonBySlug } from '@repo/billing';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { PreferenceCreateData } from 'mercadopago/dist/clients/preference/create/types';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger';
import type { AddonEntitlementService } from './addon-entitlement.service';
import type {
    ConfirmPurchaseInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    ServiceResult
} from './addon.types';
import { PromoCodeService } from './promo-code.service';

// TODO: Extend @repo/billing adapter to support preference creation.
// Once the billing adapter has a createPreference() method, replace
// createMercadoPagoPreference() below with the adapter call.

/**
 * Creates a MercadoPago preference using the raw SDK.
 *
 * This is a thin wrapper that centralizes raw SDK usage to a single place,
 * making future migration to the billing adapter straightforward.
 *
 * @param accessToken - MercadoPago API access token
 * @param preferenceData - Preference creation data
 * @returns Created preference object
 */
async function createMercadoPagoPreference({
    accessToken,
    preferenceData
}: {
    accessToken: string;
    preferenceData: PreferenceCreateData;
}) {
    const mpClient = new MercadoPagoConfig({ accessToken });
    const preferenceClient = new Preference(mpClient);
    return preferenceClient.create(preferenceData);
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

        // Validate addon is available for the customer's plan category
        if (addon.targetCategories && addon.targetCategories.length > 0) {
            const customerPlan = ALL_PLANS.find((p) => p.slug === activeSubscription.planId);
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

        const orderId = `addon_${addon.slug}_${Date.now()}`;
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

        const preference = await createMercadoPagoPreference({
            accessToken: mpAccessToken,
            preferenceData: {
                body: {
                    items: [
                        {
                            id: addon.slug,
                            title: addon.name,
                            description: addon.description,
                            quantity: 1,
                            // Convert centavos to whole ARS units (MercadoPago expects ARS, not cents)
                            unit_price: finalPrice / 100,
                            currency_id: 'ARS'
                        }
                    ],
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
                    statement_descriptor: 'HOSPEDA',
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

        // Record promo code usage if applicable
        if (promoCodeId && input.promoCode) {
            try {
                const promoService = new PromoCodeService();
                await promoService.incrementUsage(promoCodeId);
                await promoService.recordUsage({
                    promoCodeId,
                    customerId: input.customerId,
                    discountAmount,
                    currency: 'ARS'
                });

                apiLogger.info(
                    {
                        promoCodeId,
                        promoCode: input.promoCode,
                        customerId: input.customerId,
                        discountAmount
                    },
                    'Promo code usage recorded for add-on purchase'
                );
            } catch (error) {
                // Log but don't fail the purchase
                apiLogger.warn(
                    {
                        promoCodeId,
                        promoCode: input.promoCode,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'Failed to record promo code usage'
                );
            }
        }

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
    input: ConfirmPurchaseInput
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

        // Resolve plan limits from the canonical ALL_PLANS config rather than
        // fetching them from the billing SDK. The canonical config is the
        // single source of truth for plan definitions and avoids an extra
        // network round-trip to QZPay for data we already have locally.
        const canonicalPlan = ALL_PLANS.find((p) => p.slug === activeSubscription.planId);

        // Compute limit adjustments
        const limitAdjustments: Array<{
            limitKey: string;
            increase: number;
            previousValue: number;
            newValue: number;
        }> = [];

        if (addon.affectsLimitKey && addon.limitIncrease) {
            const limitDef = canonicalPlan?.limits.find((l) => l.key === addon.affectsLimitKey);
            const previousValue = limitDef?.value ?? 0;
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

        const { getDb } = await import('@repo/db/client');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
        const db = getDb();

        // Wrap DB operations in a transaction to ensure atomicity
        let purchaseId: string;

        try {
            const [insertedPurchase] = await db.transaction(async (tx) => {
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
            });

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

        apiLogger.info(
            { customerId: input.customerId, addonSlug: input.addonSlug },
            'Add-on purchase confirmed and entitlements applied'
        );

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
