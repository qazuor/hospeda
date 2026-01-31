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
 * @module services/promo-code-defaults
 */

import { apiLogger } from '../utils/logger';
import { type CreatePromoCodeInput, PromoCodeService } from './promo-code.service';

/**
 * Default promo codes configuration
 *
 * These codes are created automatically on API startup if they don't exist.
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
    apiLogger.info('Initializing default promo codes...');

    const service = new PromoCodeService();
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const promoCodeConfig of DEFAULT_PROMO_CODES) {
        try {
            // Check if the promo code already exists
            const existingCode = await service.getByCode(promoCodeConfig.code);

            // If code exists (success = true), skip creation
            if (existingCode.success) {
                apiLogger.debug(
                    `Promo code '${promoCodeConfig.code}' already exists, skipping creation`
                );
                skippedCount++;
                continue;
            }

            // Code doesn't exist, create it
            apiLogger.info(`Creating default promo code: ${promoCodeConfig.code}`);

            const result = await service.create(promoCodeConfig);

            if (!result.success) {
                apiLogger.error(
                    `Failed to create default promo code '${promoCodeConfig.code}': ${result.error?.message}`
                );
                errorCount++;
                continue;
            }

            apiLogger.info(`Successfully created default promo code: ${promoCodeConfig.code}`);
            createdCount++;
        } catch (error) {
            apiLogger.error(
                `Error ensuring promo code '${promoCodeConfig.code}':`,
                error instanceof Error ? error.message : String(error)
            );
            errorCount++;
        }
    }

    // Log summary
    const total = DEFAULT_PROMO_CODES.length;
    apiLogger.info(
        `Default promo codes initialization complete: ${createdCount} created, ${skippedCount} already existed, ${errorCount} errors out of ${total} total`
    );

    // If there were errors, log a warning
    if (errorCount > 0) {
        apiLogger.warn('Some default promo codes failed to initialize. Check logs for details.');
    }
}

/**
 * Get the list of default promo code configurations
 *
 * Useful for testing and documentation purposes.
 *
 * @returns Array of default promo code configurations
 */
export function getDefaultPromoCodeConfigs(): readonly CreatePromoCodeInput[] {
    return DEFAULT_PROMO_CODES;
}
