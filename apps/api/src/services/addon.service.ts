/**
 * Add-on Service
 *
 * Facade that delegates to extracted add-on modules:
 * - addon.catalog.ts    - list and get add-on definitions
 * - addon.checkout.ts   - create and confirm checkout sessions
 * - addon.user-addons.ts - user add-on retrieval and cancellation
 *
 * The public API (class name, method signatures, exports) is identical to
 * the original implementation so all existing imports continue to work.
 *
 * @module services/addon
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { AddonDefinition } from '@repo/billing';
import { AddonEntitlementService } from './addon-entitlement.service';
import { getAddonCatalogEntry, listAvailableAddons } from './addon.catalog';
import { confirmAddonPurchase, createAddonCheckout } from './addon.checkout';
import type {
    CancelAddonInput,
    ConfirmPurchaseInput,
    ListAvailableAddonsInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    ServiceResult,
    UserAddon
} from './addon.types';
import { cancelUserAddon, checkAddonActive, getUserAddons } from './addon.user-addons';

// Re-export types so existing consumers that import from this module keep working
export type {
    CancelAddonInput,
    ConfirmPurchaseInput,
    ListAvailableAddonsInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    ServiceResult,
    UserAddon
} from './addon.types';

/**
 * Facade service for add-on management.
 *
 * Delegates all business logic to focused sub-modules:
 * - Catalog operations: `addon.catalog.ts`
 * - Checkout operations: `addon.checkout.ts`
 * - User add-on operations: `addon.user-addons.ts`
 *
 * @example
 * ```ts
 * const service = new AddonService(billing);
 * const result = await service.listAvailable({ active: true });
 * if (result.success) {
 *   console.log(result.data); // AddonDefinition[]
 * }
 * ```
 */
export class AddonService {
    private readonly entitlementService: AddonEntitlementService;

    constructor(private readonly billing: QZPayBilling | null) {
        this.entitlementService = new AddonEntitlementService(billing);
    }

    /**
     * List available add-ons filtered by billing type, target category, and
     * active status. Results are sorted by sortOrder ascending.
     *
     * @param input - Filter options
     * @returns Filtered and sorted list of add-on definitions
     */
    async listAvailable(
        input: ListAvailableAddonsInput = {}
    ): Promise<ServiceResult<AddonDefinition[]>> {
        return listAvailableAddons(input);
    }

    /**
     * Get a single add-on by its slug.
     *
     * @param slug - The add-on slug identifier
     * @returns The matching add-on definition or a NOT_FOUND error
     */
    async getById(slug: string): Promise<ServiceResult<AddonDefinition>> {
        return getAddonCatalogEntry(slug);
    }

    /**
     * Create a Mercado Pago checkout session for an add-on purchase.
     *
     * Validates the add-on, customer, active subscription, and optional promo
     * code, then creates a Preference with a 30-minute expiration window.
     *
     * @param input - Purchase request details
     * @returns Checkout URL, order ID, amount, and expiration
     */
    async purchase(input: PurchaseAddonInput): Promise<ServiceResult<PurchaseAddonResult>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        return createAddonCheckout(this.billing, input);
    }

    /**
     * Get a user's active add-ons.
     *
     * Queries `billing_addon_purchases` as primary source, then merges results
     * from JSON metadata in subscription records for backward compatibility.
     *
     * @param userId - The user's external ID
     * @returns List of active user add-ons
     */
    async getUserAddons(userId: string): Promise<ServiceResult<UserAddon[]>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        return getUserAddons(this.billing, userId);
    }

    /**
     * Confirm an add-on purchase after payment webhook.
     *
     * Inserts a record into `billing_addon_purchases`, computes limit and
     * entitlement adjustments, and applies them to subscription metadata for
     * backward compatibility.
     *
     * @param input - Customer ID, add-on slug, and optional payment context
     * @returns Success or error result
     */
    async confirmPurchase(input: ConfirmPurchaseInput): Promise<ServiceResult<void>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        return confirmAddonPurchase(this.billing, this.entitlementService, input);
    }

    /**
     * Cancel an active add-on for a customer.
     *
     * Updates `billing_addon_purchases` to status='canceled' using the
     * purchase primary key, then removes entitlements from JSON metadata
     * for backward compatibility.
     *
     * @param input - Cancellation details (customerId, purchaseId, optional reason)
     * @returns Success or error result
     */
    async cancelAddon(input: CancelAddonInput): Promise<ServiceResult<void>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        return cancelUserAddon(this.billing, this.entitlementService, input);
    }

    /**
     * Check whether a specific add-on is currently active for a user.
     *
     * @param userId - User ID to check
     * @param addonSlug - Add-on slug to look for
     * @returns True if the add-on is found with status 'active'
     */
    async checkAddonActive(userId: string, addonSlug: string): Promise<ServiceResult<boolean>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        return checkAddonActive(this.billing, userId, addonSlug);
    }
}
