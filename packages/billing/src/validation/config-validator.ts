/**
 * Billing configuration validator.
 * Validates all billing configuration (plans, addons, promo codes) at startup
 * to catch configuration errors early before they cause runtime issues.
 */

import { createLogger } from '@repo/logger';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { ALL_ADDONS, ALL_PLAN_CATALOGS, DEFAULT_PROMO_CODES } from '../config/index.js';
import type { PromoCodeDefinition } from '../config/promo-codes.config.js';
import type { AddonDefinition } from '../types/addon.types.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import type { PlanDefinition } from '../types/plan.types.js';

const logger = createLogger('billing:config-validator');

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
 * Product domains whose catalogue legitimately carries NO default plan
 * (HOS-1290).
 *
 * The commerce verticals (`gastronomy`, `experience`) and `partner` resolve
 * their sellable/fallback tier through a per-vertical mechanism of their own
 * (`DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL`, `PARTNER_LISTING_PLAN` staying
 * active) rather than through `getDefaultPlan(category)` — every plan in
 * these catalogues declares `isDefault: false` on purpose, via
 * `commerceVerticalTier()` / the partner plan literals. `accommodation` and
 * `tourist` are deliberately NOT on this list: each MUST keep exactly one
 * default plan, same as always — an accidentally-empty default there (e.g. a
 * broken config load) must still fail loudly.
 */
const DOMAINS_ALLOWED_ZERO_DEFAULT: ReadonlySet<ProductDomainValue> = new Set([
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE,
    ProductDomainEnum.PARTNER
]);

/**
 * Validates all plan configurations, across every vertical's catalogue.
 * Checks prices, trial days, entitlement references, slugs, defaults, and sort order.
 *
 * Grouped by {@link PlanDefinition.productDomain}, not by `PlanCategory`
 * (HOS-1290): every commerce/partner tier declares `category: 'owner'` only
 * to satisfy the `PlanCategory` type (which has no commerce member), so
 * `category` can no longer tell those verticals apart from accommodation —
 * grouping by it would collide gastronomy/experience/partner's own
 * `sortOrder: 1/2/3` ladders with accommodation's. `productDomain` can tell
 * them apart, and every `PlanDefinition` is required to declare it.
 *
 * @param plans - Every plan definition to validate, across every catalogue
 *   (see {@link ALL_PLAN_CATALOGS}).
 * @returns Array of error messages (empty if valid)
 */
function validatePlans(plans: readonly PlanDefinition[]): string[] {
    const errors: string[] = [];
    const slugsSeen = new Set<string>();
    const domainData = new Map<
        ProductDomainValue,
        { defaultCount: number; sortOrders: Set<number> }
    >();

    // All valid entitlement keys
    const validEntitlements = new Set(Object.values(EntitlementKey));

    for (const plan of plans) {
        const prefix = `Plan "${plan.slug}"`;

        // Check for duplicate slugs (global — a slug must be unique across
        // every catalogue, not merely within its own vertical).
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

        // Track product-domain-specific data. Only domains that actually
        // appear in `plans` get an entry, so a domain with no plan catalogue
        // at all (e.g. `addon`, which is a billing mechanism, not a
        // sellable vertical) never needs an "allowed empty" carve-out.
        let domainStats = domainData.get(plan.productDomain);
        if (!domainStats) {
            domainStats = { defaultCount: 0, sortOrders: new Set() };
            domainData.set(plan.productDomain, domainStats);
        }
        if (plan.isDefault) {
            domainStats.defaultCount++;
        }

        // Check for duplicate sortOrder within the same product domain
        if (domainStats.sortOrders.has(plan.sortOrder)) {
            errors.push(
                `${prefix}: Duplicate sortOrder ${plan.sortOrder} in product domain "${plan.productDomain}"`
            );
        }
        domainStats.sortOrders.add(plan.sortOrder);
    }

    // Check that each product domain that appears has exactly one default
    // plan — except a domain on the explicit DOMAINS_ALLOWED_ZERO_DEFAULT
    // allowlist, which has no default plan by design (see its doc) and is
    // skipped rather than flagged for zero. `> 1` is NOT exempted for those
    // domains: two commerce plans both claiming `isDefault: true` is still a
    // real config bug.
    for (const [domain, data] of domainData.entries()) {
        if (data.defaultCount === 0) {
            if (!DOMAINS_ALLOWED_ZERO_DEFAULT.has(domain)) {
                errors.push(`Product domain "${domain}": No default plan found`);
            }
        } else if (data.defaultCount > 1) {
            errors.push(
                `Product domain "${domain}": Multiple default plans found (${data.defaultCount})`
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

        // Validate annualPriceArs for recurring addons
        if (addon.billingType === 'recurring') {
            if (addon.annualPriceArs === null || addon.annualPriceArs <= 0) {
                errors.push(
                    `${prefix}: annualPriceArs must be defined and > 0 for recurring addons, got ${addon.annualPriceArs}`
                );
            }
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

    // Validate plans — across EVERY vertical's catalogue (HOS-1290), not just
    // `ALL_PLANS` (accommodation + tourist). A commerce/partner plan with a
    // duplicate slug or a negative price used to start the API without a
    // complaint; now it fails exactly like an accommodation plan would.
    const allPlansAcrossDomains = ALL_PLAN_CATALOGS.flat();
    const planErrors = validatePlans(allPlansAcrossDomains);
    errors.push(...planErrors);

    // Validate addons
    const addonErrors = validateAddons(ALL_ADDONS);
    errors.push(...addonErrors);

    // Validate promo codes (needs plan slugs for reference checking) — also
    // across every catalogue (HOS-1290): a promo restricted to a commerce
    // plan used to fail startup outright because the validator only knew
    // `ALL_PLANS`'s slugs.
    const planSlugs = new Set(allPlansAcrossDomains.map((p) => p.slug));
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
        logger.warn('Billing configuration warnings:');
        for (const warning of result.warnings) {
            logger.warn(`  - ${warning}`);
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
