/**
 * Add-on Service
 *
 * Service for managing add-on purchases and user add-ons.
 * Handles one-time and recurring add-on billing through QZPay.
 *
 * Features:
 * - List available add-ons filtered by plan type
 * - Purchase add-ons (creates checkout session with Mercado Pago)
 * - List user's active add-ons
 * - Cancel recurring add-ons
 * - Check if user has specific add-on active
 *
 * @module services/addon
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ALL_ADDONS, type AddonDefinition, getAddonBySlug } from '@repo/billing';
import { and, eq } from 'drizzle-orm';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { z } from 'zod';
import { apiLogger } from '../utils/logger';
import { AddonEntitlementService } from './addon-entitlement.service';
import { PromoCodeService } from './promo-code.service';

/**
 * Result wrapper for service methods
 */
interface ServiceResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * List available add-ons input
 */
export interface ListAvailableAddonsInput {
    /** Filter by billing type */
    billingType?: 'one_time' | 'recurring';
    /** Filter by target category (owner/complex) */
    targetCategory?: 'owner' | 'complex';
    /** Filter by active status */
    active?: boolean;
}

/**
 * Purchase add-on input
 */
export interface PurchaseAddonInput {
    /** User's billing customer ID */
    customerId: string;
    /** Add-on slug to purchase */
    addonSlug: string;
    /** Optional promo code */
    promoCode?: string;
    /** User ID for tracking */
    userId: string;
}

/**
 * Purchase add-on result
 */
export interface PurchaseAddonResult {
    /** Checkout URL to redirect user to Mercado Pago */
    checkoutUrl: string;
    /** Order/checkout session ID */
    orderId: string;
    /** Add-on slug */
    addonId: string;
    /** Amount in cents (ARS) */
    amount: number;
    /** Currency code */
    currency: string;
    /** Checkout expiration timestamp */
    expiresAt: string;
}

/**
 * User add-on (active purchase)
 */
export interface UserAddon {
    id: string;
    addonSlug: string;
    addonName: string;
    billingType: 'one_time' | 'recurring';
    status: 'active' | 'expired' | 'canceled';
    purchasedAt: string;
    expiresAt: string | null;
    canceledAt: string | null;
    priceArs: number;
    affectsLimitKey: string | null;
    limitIncrease: number | null;
    grantsEntitlement: string | null;
}

/**
 * Cancel add-on input
 */
export interface CancelAddonInput {
    /** User's billing customer ID */
    customerId: string;
    /** Add-on purchase ID to cancel */
    addonId: string;
    /** Optional cancellation reason */
    reason?: string;
    /** User ID for tracking */
    userId: string;
}

/**
 * Schema for validating addon adjustment metadata from JSON
 * Used for backward compatibility with JSON-stored addon data
 */
const addonAdjustmentSchema = z.object({
    addonSlug: z.string(),
    limitKey: z.string().optional().nullable(),
    limitIncrease: z.number().optional().nullable(),
    entitlement: z.string().optional().nullable(),
    appliedAt: z.string()
});

const addonAdjustmentsArraySchema = z.array(addonAdjustmentSchema);

/**
 * Service for add-on operations
 */
export class AddonService {
    private readonly entitlementService: AddonEntitlementService;

    constructor(private readonly billing: QZPayBilling | null) {
        this.entitlementService = new AddonEntitlementService(billing);
    }

    /**
     * List available add-ons
     * Filters by billing type, target category, and active status
     *
     * @param input - Filter options
     * @returns List of available add-ons
     */
    async listAvailable(
        input: ListAvailableAddonsInput = {}
    ): Promise<ServiceResult<AddonDefinition[]>> {
        try {
            let addons = [...ALL_ADDONS];

            // Filter by billing type
            if (input.billingType) {
                addons = addons.filter((addon) => addon.billingType === input.billingType);
            }

            // Filter by target category
            if (input.targetCategory) {
                const targetCategory = input.targetCategory;
                addons = addons.filter((addon) => addon.targetCategories.includes(targetCategory));
            }

            // Filter by active status
            if (input.active !== undefined) {
                addons = addons.filter((addon) => addon.isActive === input.active);
            }

            // Sort by sortOrder
            addons.sort((a, b) => a.sortOrder - b.sortOrder);

            apiLogger.debug(
                {
                    count: addons.length,
                    filters: input
                },
                'Listed available add-ons'
            );

            return {
                success: true,
                data: addons
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    filters: input
                },
                'Failed to list available add-ons'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to list available add-ons'
                }
            };
        }
    }

    /**
     * Get add-on by slug
     *
     * @param slug - Add-on slug
     * @returns Add-on definition or error
     */
    async getById(slug: string): Promise<ServiceResult<AddonDefinition>> {
        try {
            const addon = getAddonBySlug(slug);

            if (!addon) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on '${slug}' not found`
                    }
                };
            }

            return {
                success: true,
                data: addon
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    slug
                },
                'Failed to get add-on'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get add-on'
                }
            };
        }
    }

    /**
     * Purchase add-on
     * Creates a checkout session with Mercado Pago
     *
     * For one-time add-ons: Creates a single payment
     * For recurring add-ons: Creates an add-on subscription
     *
     * @param input - Purchase details
     * @returns Checkout URL and order details
     */
    async purchase(input: PurchaseAddonInput): Promise<ServiceResult<PurchaseAddonResult>> {
        // Check billing enabled
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // Get add-on definition
            const addon = getAddonBySlug(input.addonSlug);

            if (!addon) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on '${input.addonSlug}' not found`
                    }
                };
            }

            // Check if add-on is active
            if (!addon.isActive) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_INACTIVE',
                        message: 'This add-on is not currently available for purchase'
                    }
                };
            }

            // Verify customer exists and has active subscription
            const customer = await this.billing.customers.get(input.customerId);

            if (!customer) {
                return {
                    success: false,
                    error: {
                        code: 'CUSTOMER_NOT_FOUND',
                        message: 'Billing customer not found'
                    }
                };
            }

            // Get customer's active subscription
            const subscriptions = await this.billing.subscriptions.getByCustomerId(
                input.customerId
            );

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

                // Apply discount
                if (validation.discountAmount) {
                    discountAmount = validation.discountAmount;
                    finalPrice = Math.max(0, addon.priceArs - discountAmount);
                }

                // Get promo code ID for usage tracking
                const promoCodeResult = await promoService.getByCode(input.promoCode);
                if (promoCodeResult.success && promoCodeResult.data) {
                    promoCodeId = promoCodeResult.data.id;
                }
            }

            // Create Mercado Pago preference for add-on purchase
            const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
            if (!mpAccessToken) {
                return {
                    success: false,
                    error: {
                        code: 'PAYMENT_NOT_CONFIGURED',
                        message: 'Payment system is not configured'
                    }
                };
            }

            const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
            const preferenceClient = new Preference(mpClient);

            const orderId = `addon_${addon.slug}_${Date.now()}`;
            const webUrl = process.env.WEB_URL || 'http://localhost:4321';
            const apiUrl = process.env.API_URL || 'http://localhost:3001';

            const preference = await preferenceClient.create({
                body: {
                    items: [
                        {
                            id: addon.slug,
                            title: addon.name,
                            description: addon.description,
                            quantity: 1,
                            unit_price: finalPrice,
                            currency_id: 'ARS'
                        }
                    ],
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

            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

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
                {
                    error: errorMessage,
                    customerId: input.customerId,
                    addonSlug: input.addonSlug
                },
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
     * Get user's active add-ons
     * Returns all purchased add-ons (both one-time and recurring)
     *
     * Queries billing_addon_purchases table first, with fallback to JSON metadata
     * for backward compatibility.
     *
     * @param userId - User ID
     * @returns List of user's active add-ons
     */
    async getUserAddons(userId: string): Promise<ServiceResult<UserAddon[]>> {
        // Check billing enabled
        if (!this.billing) {
            return {
                success: true,
                data: [] // Return empty list if billing is disabled
            };
        }

        try {
            // Get customer by external ID (userId)
            const customer = await this.billing.customers.getByExternalId(userId);

            if (!customer) {
                // No customer = no add-ons
                return {
                    success: true,
                    data: []
                };
            }

            // Import DB utilities and schema
            const { getDb } = await import('@repo/db/client');
            const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
            const db = getDb();

            // Query billing_addon_purchases table for active add-ons
            const addonPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.status, 'active')
                    )
                );

            // Map table results to UserAddon format
            const userAddonsFromTable: UserAddon[] = addonPurchases.map((purchase) => {
                const addonDef = getAddonBySlug(purchase.addonSlug);

                // Extract limit adjustment
                let affectsLimitKey: string | null = null;
                let limitIncrease: number | null = null;

                if (
                    purchase.limitAdjustments &&
                    Array.isArray(purchase.limitAdjustments) &&
                    purchase.limitAdjustments.length > 0
                ) {
                    const firstLimit = purchase.limitAdjustments[0];
                    // Type guard: ensure object has expected properties
                    if (
                        firstLimit &&
                        typeof firstLimit === 'object' &&
                        'limitKey' in firstLimit &&
                        'increase' in firstLimit
                    ) {
                        affectsLimitKey = firstLimit.limitKey as string;
                        limitIncrease = firstLimit.increase as number;
                    }
                }

                // Extract entitlement adjustment
                let grantsEntitlement: string | null = null;
                if (
                    purchase.entitlementAdjustments &&
                    Array.isArray(purchase.entitlementAdjustments) &&
                    purchase.entitlementAdjustments.length > 0
                ) {
                    const firstEntitlement = purchase.entitlementAdjustments[0];
                    grantsEntitlement = firstEntitlement?.entitlementKey ?? null;
                }

                return {
                    id: purchase.id,
                    addonSlug: purchase.addonSlug,
                    addonName: addonDef?.name || purchase.addonSlug,
                    billingType: addonDef?.billingType || 'one_time',
                    status: purchase.status as 'active' | 'expired' | 'canceled',
                    purchasedAt: purchase.purchasedAt.toISOString(),
                    expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
                    canceledAt: purchase.cancelledAt ? purchase.cancelledAt.toISOString() : null,
                    priceArs: addonDef?.priceArs || 0,
                    affectsLimitKey,
                    limitIncrease,
                    grantsEntitlement
                };
            });

            // Backward compatibility: Also read from JSON metadata as secondary source
            const userAddonsFromMetadata: UserAddon[] = [];
            const subscriptions = await this.billing.subscriptions.getByCustomerId(customer.id);

            if (subscriptions && subscriptions.length > 0) {
                const activeSubscription = subscriptions.find(
                    (sub: { status: string }) =>
                        sub.status === 'active' || sub.status === 'trialing'
                );

                if (activeSubscription) {
                    const metadata = activeSubscription.metadata as
                        | Record<string, unknown>
                        | undefined;
                    const adjustmentsJson = metadata?.addonAdjustments as string | undefined;

                    if (adjustmentsJson) {
                        try {
                            const parsed = JSON.parse(adjustmentsJson);

                            // Validate parsed JSON with Zod schema
                            const validationResult = addonAdjustmentsArraySchema.safeParse(parsed);

                            if (validationResult.success) {
                                const adjustments = validationResult.data;
                                for (const adj of adjustments) {
                                    // Only include if not already in table results
                                    const existsInTable = userAddonsFromTable.some(
                                        (addon) => addon.addonSlug === adj.addonSlug
                                    );

                                    if (!existsInTable) {
                                        const addonDef = getAddonBySlug(adj.addonSlug);
                                        userAddonsFromMetadata.push({
                                            id: `${activeSubscription.id}_${adj.addonSlug}`,
                                            addonSlug: adj.addonSlug,
                                            addonName: addonDef?.name || adj.addonSlug,
                                            billingType: addonDef?.billingType || 'one_time',
                                            status: 'active' as const,
                                            purchasedAt: adj.appliedAt,
                                            expiresAt: null,
                                            canceledAt: null,
                                            priceArs: addonDef?.priceArs || 0,
                                            affectsLimitKey: adj.limitKey || null,
                                            limitIncrease: adj.limitIncrease || null,
                                            grantsEntitlement: adj.entitlement || null
                                        });
                                    }
                                }
                            } else {
                                apiLogger.warn(
                                    {
                                        userId,
                                        customerId: customer.id,
                                        validationErrors: validationResult.error.flatten()
                                    },
                                    'Addon adjustments JSON failed schema validation, skipping malformed data'
                                );
                            }
                        } catch (error) {
                            apiLogger.error(
                                {
                                    error: error instanceof Error ? error.message : String(error),
                                    userId,
                                    customerId: customer.id
                                },
                                'Failed to parse addon adjustments JSON from metadata'
                            );
                        }
                    }
                }
            }

            // Merge results (table takes priority)
            const allUserAddons = [...userAddonsFromTable, ...userAddonsFromMetadata];

            apiLogger.debug(
                {
                    userId,
                    customerId: customer.id,
                    addonsCountFromTable: userAddonsFromTable.length,
                    addonsCountFromMetadata: userAddonsFromMetadata.length,
                    totalAddons: allUserAddons.length
                },
                'Retrieved user add-ons from billing_addon_purchases table and metadata'
            );

            return { success: true, data: allUserAddons };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    userId
                },
                'Failed to get user add-ons'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve user add-ons'
                }
            };
        }
    }

    /**
     * Confirm add-on purchase
     *
     * Called from webhook after payment is confirmed.
     * Applies entitlements and limits from the purchased add-on.
     * Inserts a record into billing_addon_purchases table.
     *
     * @param input - Customer ID, add-on slug, and optional payment/subscription context
     * @returns Success or error
     */
    async confirmPurchase(input: {
        customerId: string;
        addonSlug: string;
        paymentId?: string;
        subscriptionId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<ServiceResult<void>> {
        // Check billing enabled
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // Get add-on definition to compute expiration
            const addon = getAddonBySlug(input.addonSlug);

            if (!addon) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on '${input.addonSlug}' not found`
                    }
                };
            }

            // Get customer's active subscription
            const subscriptions = await this.billing.subscriptions.getByCustomerId(
                input.customerId
            );

            if (!subscriptions || subscriptions.length === 0) {
                return {
                    success: false,
                    error: {
                        code: 'NO_SUBSCRIPTION',
                        message: 'Customer has no active subscription'
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
                        message: 'Customer has no active subscription'
                    }
                };
            }

            // Get the current plan to compute limit/entitlement adjustments
            const plan = await this.billing.plans.get(activeSubscription.planId);

            if (!plan) {
                return {
                    success: false,
                    error: {
                        code: 'PLAN_NOT_FOUND',
                        message: 'Subscription plan not found'
                    }
                };
            }

            // Compute limit adjustments
            const limitAdjustments: Array<{
                limitKey: string;
                increase: number;
                previousValue: number;
                newValue: number;
            }> = [];

            if (addon.affectsLimitKey && addon.limitIncrease) {
                const previousValue = (plan.limits?.[addon.affectsLimitKey] as number) || 0;
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

            // Compute expiration date (for one-time add-ons with duration)
            const now = new Date();
            const expiresAt =
                addon.billingType === 'one_time' && addon.durationDays
                    ? new Date(now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000)
                    : null;

            // Insert into billing_addon_purchases table
            const { getDb } = await import('@repo/db/client');
            const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
            const db = getDb();

            await db.insert(billingAddonPurchases).values({
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
            });

            apiLogger.info(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    subscriptionId: activeSubscription.id,
                    expiresAt: expiresAt?.toISOString() || null,
                    limitAdjustments,
                    entitlementAdjustments
                },
                'Inserted add-on purchase into billing_addon_purchases table'
            );

            // Apply add-on entitlements and limits (backward compatibility - JSON metadata)
            const result = await this.entitlementService.applyAddonEntitlements({
                customerId: input.customerId,
                addonSlug: input.addonSlug
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
                // Continue - table insert is the primary source now
            }

            apiLogger.info(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug
                },
                'Add-on purchase confirmed and entitlements applied'
            );

            return {
                success: true
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    customerId: input.customerId,
                    addonSlug: input.addonSlug
                },
                'Failed to confirm add-on purchase'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to confirm add-on purchase'
                }
            };
        }
    }

    /**
     * Cancel a recurring add-on
     *
     * Updates billing_addon_purchases table (status='cancelled', cancelled_at=now)
     * and removes entitlements from JSON metadata for backward compatibility.
     *
     * @param input - Cancellation details
     * @returns Success or error
     */
    async cancelAddon(input: CancelAddonInput): Promise<ServiceResult<void>> {
        // Check billing enabled
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // The addonId is the add-on slug in this context
            const addonSlug = input.addonId;

            // Get the customer to find the user ID
            const customer = await this.billing.customers.get(input.customerId);

            if (!customer) {
                return {
                    success: false,
                    error: {
                        code: 'CUSTOMER_NOT_FOUND',
                        message: 'Billing customer not found'
                    }
                };
            }

            // Get the customer's external ID (user ID) to check active add-ons
            const userId = customer.externalId || customer.id;

            // Verify the add-on is actually active for this customer
            const userAddonsResult = await this.getUserAddons(userId);

            if (!userAddonsResult.success) {
                return {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Failed to retrieve user add-ons'
                    }
                };
            }

            const userAddons = userAddonsResult.data || [];
            const hasAddon = userAddons.some(
                (addon) => addon.addonSlug === addonSlug && addon.status === 'active'
            );

            if (!hasAddon) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on '${addonSlug}' is not active for this customer`
                    }
                };
            }

            // Update billing_addon_purchases table: set status='cancelled' and cancelled_at=now
            try {
                const { getDb } = await import('@repo/db/client');
                const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
                const db = getDb();

                const updateResult = await db
                    .update(billingAddonPurchases)
                    .set({
                        status: 'cancelled',
                        cancelledAt: new Date(),
                        updatedAt: new Date()
                    })
                    .where(
                        and(
                            eq(billingAddonPurchases.customerId, input.customerId),
                            eq(billingAddonPurchases.addonSlug, addonSlug),
                            eq(billingAddonPurchases.status, 'active')
                        )
                    );

                // Check number of rows affected to detect race conditions
                const rowCount = (updateResult as { rowCount?: number }).rowCount || 0;

                if (rowCount === 0) {
                    // No active row found in table (might be pre-migration data or already cancelled)
                    apiLogger.warn(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            reason: input.reason
                        },
                        'No active billing_addon_purchase record found to cancel (might be pre-migration data or already cancelled, continuing with entitlement removal)'
                    );
                } else if (rowCount === 1) {
                    // Expected case: exactly one row updated
                    apiLogger.info(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            reason: input.reason
                        },
                        'Cancelled billing_addon_purchase record'
                    );
                } else {
                    // Unexpected case: multiple rows updated (data integrity issue)
                    apiLogger.error(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            reason: input.reason,
                            rowsUpdated: rowCount
                        },
                        'WARNING: Multiple billing_addon_purchase records were cancelled - possible data integrity issue or race condition'
                    );
                }
            } catch (dbError) {
                // Log error but don't fail the entire operation (backward compatibility)
                apiLogger.error(
                    {
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                        customerId: input.customerId,
                        addonSlug
                    },
                    'Failed to cancel billing_addon_purchase record (continuing with entitlement removal)'
                );
            }

            // Remove add-on entitlements and limits (backward compatibility - JSON metadata)
            const result = await this.entitlementService.removeAddonEntitlements({
                customerId: input.customerId,
                addonSlug
            });

            if (!result.success) {
                apiLogger.warn(
                    {
                        customerId: input.customerId,
                        addonSlug,
                        error: result.error
                    },
                    'Failed to remove add-on from JSON metadata (backward compat), but table update may have succeeded'
                );
                // Continue - table update is the primary source now
            }

            apiLogger.info(
                {
                    customerId: input.customerId,
                    addonSlug,
                    reason: input.reason
                },
                'Add-on cancelled and entitlements removed'
            );

            return {
                success: true
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    customerId: input.customerId,
                    addonId: input.addonId
                },
                'Failed to cancel add-on'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to cancel add-on'
                }
            };
        }
    }

    /**
     * Check if user has a specific add-on active
     *
     * @param userId - User ID
     * @param addonSlug - Add-on slug to check
     * @returns True if user has the add-on active
     */
    async checkAddonActive(userId: string, addonSlug: string): Promise<ServiceResult<boolean>> {
        try {
            // Get user's add-ons
            const result = await this.getUserAddons(userId);

            if (!result.success || !result.data) {
                return {
                    success: false,
                    error: result.error
                };
            }

            // Check if add-on is in the list and active
            const hasAddon = result.data.some(
                (addon) => addon.addonSlug === addonSlug && addon.status === 'active'
            );

            return {
                success: true,
                data: hasAddon
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    userId,
                    addonSlug
                },
                'Failed to check if add-on is active'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to check add-on status'
                }
            };
        }
    }
}
