/**
 * Billing configuration validator.
 * Validates all billing configuration (plans, addons, promo codes) at startup
 * to catch configuration errors early before they cause runtime issues.
 */

import { ALL_ADDONS, ALL_PLANS, DEFAULT_PROMO_CODES } from '../config/index.js';
import type { PromoCodeDefinition } from '../config/promo-codes.config.js';
import type { AddonDefinition } from '../types/addon.types.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import type { PlanCategory, PlanDefinition } from '../types/plan.types.js';

/**
 * Result of billing configuration validation
 */
export interface BillingConfigValidationResult {
    /** Whether the configuration is valid */
    valid: boolean;
    /** Critical errors that should prevent startup */
    errors: string[];
    /** Non-critical issues (expired promo codes, etc.) */
    warnings: string[];
}

/**
 * Validates all plan configurations.
 * Checks prices, trial days, entitlement references, slugs, defaults, and sort order.
 *
 * @param plans - Array of plan definitions to validate
 * @returns Array of error messages (empty if valid)
 */
function validatePlans(plans: PlanDefinition[]): string[] {
    const errors: string[] = [];
    const slugsSeen = new Set<string>();
    const categoryCounts: Record<PlanCategory, { defaultCount: number; sortOrders: Set<number> }> =
        {
            owner: { defaultCount: 0, sortOrders: new Set() },
            complex: { defaultCount: 0, sortOrders: new Set() },
            tourist: { defaultCount: 0, sortOrders: new Set() }
        };

    // All valid entitlement keys
    const validEntitlements = new Set(Object.values(EntitlementKey));

    for (const plan of plans) {
        const prefix = `Plan "${plan.slug}"`;

        // Check for duplicate slugs
        if (slugsSeen.has(plan.slug)) {
            errors.push(`${prefix}: Duplicate slug found`);
        }
        slugsSeen.add(plan.slug);

        // Validate prices >= 0
        if (plan.monthlyPriceArs < 0) {
            errors.push(`${prefix}: monthlyPriceArs must be >= 0, got ${plan.monthlyPriceArs}`);
        }

        if (plan.annualPriceArs !== null && plan.annualPriceArs < 0) {
            errors.push(`${prefix}: annualPriceArs must be >= 0, got ${plan.annualPriceArs}`);
        }

        if (plan.monthlyPriceUsdRef < 0) {
            errors.push(
                `${prefix}: monthlyPriceUsdRef must be >= 0, got ${plan.monthlyPriceUsdRef}`
            );
        }

        // Validate trial days
        if (plan.hasTrial && plan.trialDays < 0) {
            errors.push(
                `${prefix}: trialDays must be >= 0 when hasTrial is true, got ${plan.trialDays}`
            );
        }

        // Validate entitlement references
        for (const entitlement of plan.entitlements) {
            if (!validEntitlements.has(entitlement)) {
                errors.push(`${prefix}: Invalid entitlement key "${entitlement}"`);
            }
        }

        // Track category-specific data
        const categoryData = categoryCounts[plan.category];
        if (plan.isDefault) {
            categoryData.defaultCount++;
        }

        // Check for duplicate sortOrder within category
        if (categoryData.sortOrders.has(plan.sortOrder)) {
            errors.push(
                `${prefix}: Duplicate sortOrder ${plan.sortOrder} in category "${plan.category}"`
            );
        }
        categoryData.sortOrders.add(plan.sortOrder);
    }

    // Check that each category has exactly one default plan
    for (const [category, data] of Object.entries(categoryCounts)) {
        if (data.defaultCount === 0) {
            errors.push(`Category "${category}": No default plan found`);
        } else if (data.defaultCount > 1) {
            errors.push(
                `Category "${category}": Multiple default plans found (${data.defaultCount})`
            );
        }
    }

    return errors;
}

/**
 * Validates all addon configurations.
 * Checks prices, limit increases, entitlement references, and slugs.
 *
 * @param addons - Array of addon definitions to validate
 * @returns Array of error messages (empty if valid)
 */
function validateAddons(addons: AddonDefinition[]): string[] {
    const errors: string[] = [];
    const slugsSeen = new Set<string>();
    const validEntitlements = new Set(Object.values(EntitlementKey));

    for (const addon of addons) {
        const prefix = `Addon "${addon.slug}"`;

        // Check for duplicate slugs
        if (slugsSeen.has(addon.slug)) {
            errors.push(`${prefix}: Duplicate slug found`);
        }
        slugsSeen.add(addon.slug);

        // Validate price > 0
        if (addon.priceArs <= 0) {
            errors.push(`${prefix}: priceArs must be > 0, got ${addon.priceArs}`);
        }

        // Validate limitIncrease when affectsLimitKey is set
        if (addon.affectsLimitKey !== null) {
            if (addon.limitIncrease === null || addon.limitIncrease <= 0) {
                errors.push(
                    `${prefix}: limitIncrease must be > 0 when affectsLimitKey is set, got ${addon.limitIncrease}`
                );
            }
        }

        // Validate grantsEntitlement reference
        if (addon.grantsEntitlement !== null && !validEntitlements.has(addon.grantsEntitlement)) {
            errors.push(`${prefix}: Invalid entitlement key "${addon.grantsEntitlement}"`);
        }
    }

    return errors;
}

/**
 * Validates all promo code configurations.
 * Checks discount percentages, expiration dates, and plan references.
 *
 * @param promoCodes - Array of promo code definitions to validate
 * @param planSlugs - Set of valid plan slugs for reference checking
 * @returns Object with errors and warnings arrays
 */
function validatePromoCodes(
    promoCodes: PromoCodeDefinition[],
    planSlugs: Set<string>
): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const codesSeen = new Set<string>();
    const now = new Date();

    for (const promo of promoCodes) {
        const prefix = `Promo code "${promo.code}"`;

        // Check for duplicate codes
        if (codesSeen.has(promo.code)) {
            errors.push(`${prefix}: Duplicate code found`);
        }
        codesSeen.add(promo.code);

        // Validate discount percentage (0-100)
        if (promo.discountPercent < 0 || promo.discountPercent > 100) {
            errors.push(
                `${prefix}: discountPercent must be between 0 and 100, got ${promo.discountPercent}`
            );
        }

        // Warn if expired (not an error)
        if (promo.expiresAt !== null && promo.expiresAt < now) {
            warnings.push(
                `${prefix}: Promo code has expired (expiresAt: ${promo.expiresAt.toISOString()})`
            );
        }

        // Validate plan references
        if (promo.restrictedToPlans !== null) {
            for (const planSlug of promo.restrictedToPlans) {
                if (!planSlugs.has(planSlug)) {
                    errors.push(`${prefix}: References non-existent plan slug "${planSlug}"`);
                }
            }
        }
    }

    return { errors, warnings };
}

/**
 * Validates all billing configuration at startup.
 * Checks plans, addons, and promo codes for configuration errors.
 *
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```ts
 * const result = validateBillingConfig();
 * if (!result.valid) {
 *   console.error('Billing config errors:', result.errors);
 *   process.exit(1);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Billing config warnings:', result.warnings);
 * }
 * ```
 */
export function validateBillingConfig(): BillingConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate plans
    const planErrors = validatePlans(ALL_PLANS);
    errors.push(...planErrors);

    // Validate addons
    const addonErrors = validateAddons(ALL_ADDONS);
    errors.push(...addonErrors);

    // Validate promo codes (needs plan slugs for reference checking)
    const planSlugs = new Set(ALL_PLANS.map((p) => p.slug));
    const promoResult = validatePromoCodes(DEFAULT_PROMO_CODES, planSlugs);
    errors.push(...promoResult.errors);
    warnings.push(...promoResult.warnings);

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates billing configuration and throws if there are errors.
 * Logs warnings to console but does not throw for warnings.
 *
 * @throws {Error} If billing configuration has validation errors
 *
 * @example
 * ```ts
 * // In server startup
 * validateBillingConfigOrThrow();
 * console.log('Billing configuration validated successfully');
 * ```
 */
export function validateBillingConfigOrThrow(): void {
    const result = validateBillingConfig();

    // Log warnings if present
    if (result.warnings.length > 0) {
        console.warn('⚠️  Billing configuration warnings:');
        for (const warning of result.warnings) {
            console.warn(`  - ${warning}`);
        }
    }

    // Throw if errors present
    if (!result.valid) {
        const errorMessage = [
            '❌ Billing configuration validation failed:',
            ...result.errors.map((err) => `  - ${err}`)
        ].join('\n');

        throw new Error(errorMessage);
    }
}
