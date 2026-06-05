/**
 * Promo Code Defaults Initialization
 *
 * Ensures default promo codes exist in the system.
 * This module provides initialization functions to create essential
 * promo codes that should always be available, such as HOSPEDA_FREE.
 *
 * The defaults are created during API startup and are idempotent -
 * they will only create codes that don't already exist.
 *
 * ---
 * SCOPE: seed / startup path only (SPEC-192 T-029)
 *
 * `DEFAULT_PROMO_CODES` (private) and `getDefaultPromoCodeConfigs` are
 * intentionally restricted to:
 *   - API startup: `ensureDefaultPromoCodes()` (called once at boot)
 *   - Dev tooling and tests: `getDefaultPromoCodeConfigs()` (read-only)
 *
 * They MUST NOT be used for request-time catalog reads. Any runtime promo
 * code lookup MUST go through `PromoCodeService.getByCode()` or the
 * equivalent CRUD function so the DB (not this in-process config) is the
 * source of truth. See `@repo/billing` `DEFAULT_PROMO_CODES` for the
 * richer `PromoCodeDefinition` format used by the seeder.
 *
 * Moving this const to `packages/seed` was evaluated and rejected: seed
 * imports from service-core; inverting that dependency would create a cycle.
 * The JSDoc banner above is the designated guard.
 * ---
 *
 * @module services/billing/promo-code/promo-code-defaults
 */

import { type CreatePromoCodeInput, PromoCodeService } from './promo-code.service.js';

/**
 * Default promo codes configuration in `CreatePromoCodeInput` shape.
 *
 * @internal Startup / seed-path use only — see module JSDoc banner above.
 */
const DEFAULT_PROMO_CODES: CreatePromoCodeInput[] = [
    {
        code: 'HOSPEDA_FREE',
        discountType: 'percentage',
        discountValue: 100,
        description: 'Hospeda Free Plan - 100% permanent discount with no payment method required',
        isActive: true,
        // No expiration date - valid forever
        expiryDate: undefined,
        // Unlimited uses
        maxUses: undefined,
        // Applicable to all plans
        planRestrictions: undefined,
        // Not restricted to first purchase
        firstPurchaseOnly: false,
        // No minimum amount required
        minAmount: undefined
    }
];

/**
 * Ensures all default promo codes exist in the system
 *
 * This function is idempotent and can be safely called multiple times.
 * It will:
 * 1. Check if each default promo code exists
 * 2. Create any missing codes
 * 3. Skip codes that already exist
 *
 * @returns Promise that resolves when all default codes are ensured
 *
 * @example
 * ```typescript
 * // Called during API startup
 * await ensureDefaultPromoCodes();
 * ```
 */
export async function ensureDefaultPromoCodes(): Promise<void> {
    const service = new PromoCodeService();
    for (const promoCodeConfig of DEFAULT_PROMO_CODES) {
        try {
            // Check if the promo code already exists
            const existingCode = await service.getByCode(promoCodeConfig.code);

            // If code exists (success = true), skip creation
            if (existingCode.success) {
                continue;
            }

            // Code doesn't exist, create it
            await service.create(promoCodeConfig);
        } catch (_error) {
            // Caller is responsible for logging
        }
    }
}

/**
 * Get the list of default promo code configurations.
 *
 * Intended for testing and documentation purposes only.
 * Runtime catalog reads MUST use `PromoCodeService.getByCode()` instead.
 *
 * @returns Read-only array of default promo code configurations
 */
export function getDefaultPromoCodeConfigs(): readonly CreatePromoCodeInput[] {
    return DEFAULT_PROMO_CODES;
}
