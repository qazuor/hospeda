/**
 * Limit Check Utility
 *
 * Generic utility for checking usage limits against plan entitlements.
 * Used by limit enforcement middleware to determine if a user has
 * reached their plan limit for a specific resource.
 *
 * @module utils/limit-check
 */

import type { LimitKey } from '@repo/billing';
import type { Context } from 'hono';
import { getRemainingLimit } from '../middlewares/entitlement';
import type { AppBindings } from '../types';

/**
 * Parameters for checking a limit
 */
export interface LimitCheckParams {
    /** Hono context containing user entitlements and limits */
    context: Context<AppBindings>;
    /** The limit key to check */
    limitKey: LimitKey;
    /** Current usage count for this resource */
    currentCount: number;
}

/**
 * Result of a limit check
 */
export interface LimitCheckResult {
    /** Whether the action is allowed (user has not reached limit) */
    allowed: boolean;
    /** Current usage count */
    currentCount: number;
    /** Maximum allowed by plan (-1 means unlimited) */
    maxAllowed: number;
    /** Number of resources remaining (0 if limit reached, -1 if unlimited) */
    remaining: number;
    /** Optional message suggesting plan upgrade */
    upgradeMessage?: string;
}

/**
 * Resource name mapping for user-friendly error messages.
 *
 * NOTE: These are user-facing Spanish strings intentionally kept here
 * because the default locale is Spanish (es). They should be moved to
 * the i18n package (@repo/i18n) when multi-locale support is needed
 * for billing/limit messages.
 */
const RESOURCE_NAMES: Record<LimitKey, string> = {
    max_accommodations: 'alojamientos',
    max_photos_per_accommodation: 'fotos por alojamiento',
    max_active_promotions: 'promociones activas',
    max_favorites: 'favoritos',
    max_properties: 'propiedades',
    max_staff_accounts: 'cuentas de personal'
};

/**
 * Usage threshold levels based on percentage
 */
export type UsageThreshold = 'ok' | 'warning' | 'critical' | 'exceeded';

/**
 * Calculate usage threshold based on current usage and max allowed
 *
 * Thresholds:
 * - ok: < 80%
 * - warning: 80-89%
 * - critical: 90-99%
 * - exceeded: >= 100%
 *
 * @param current - Current usage count
 * @param max - Maximum allowed count
 * @returns Threshold status
 *
 * @example
 * ```typescript
 * const threshold = calculateThreshold(4, 5); // 'critical' (80%)
 * const threshold = calculateThreshold(5, 5); // 'exceeded' (100%)
 * ```
 */
export function calculateThreshold(current: number, max: number): UsageThreshold {
    // Unlimited or disabled (max = 0 or -1)
    if (max <= 0) {
        return 'ok';
    }

    const percentage = (current / max) * 100;

    if (percentage >= 100) {
        return 'exceeded';
    }
    if (percentage >= 90) {
        return 'critical';
    }
    if (percentage >= 80) {
        return 'warning';
    }

    return 'ok';
}

/**
 * Calculate usage percentage
 *
 * @param current - Current usage count
 * @param max - Maximum allowed count
 * @returns Usage percentage (0-100), rounded to 2 decimal places
 *
 * @example
 * ```typescript
 * const percent = calculateUsagePercent(4, 5); // 80.00
 * const percent = calculateUsagePercent(3, 10); // 30.00
 * ```
 */
export function calculateUsagePercent(current: number, max: number): number {
    if (max <= 0) {
        return 0;
    }

    const percentage = (current / max) * 100;
    return Math.round(percentage * 100) / 100;
}

/**
 * Check if a user has reached their plan limit for a specific resource
 *
 * @param params - Limit check parameters
 * @returns Limit check result with detailed information
 *
 * @example
 * ```typescript
 * const result = checkLimit({
 *   context: c,
 *   limitKey: LimitKey.MAX_ACCOMMODATIONS,
 *   currentCount: 5
 * });
 *
 * if (!result.allowed) {
 *   return c.json({
 *     success: false,
 *     error: {
 *       code: 'LIMIT_REACHED',
 *       message: result.upgradeMessage
 *     }
 *   }, 403);
 * }
 * ```
 */
export function checkLimit(params: LimitCheckParams): LimitCheckResult {
    const { context, limitKey, currentCount } = params;

    // Get limit from user's plan
    const maxAllowed = getRemainingLimit(context, limitKey);

    // If limit is -1, it means unlimited
    if (maxAllowed === -1) {
        return {
            allowed: true,
            currentCount,
            maxAllowed,
            remaining: -1
        };
    }

    // If limit is 0, feature is disabled for this plan
    if (maxAllowed === 0) {
        const resourceName = RESOURCE_NAMES[limitKey] || limitKey;
        return {
            allowed: false,
            currentCount,
            maxAllowed,
            remaining: 0,
            upgradeMessage: `Esta funcionalidad no está disponible en tu plan actual. Actualiza tu plan para poder usar ${resourceName}.`
        };
    }

    // Check if user has reached the limit
    const allowed = currentCount < maxAllowed;
    const remaining = allowed ? maxAllowed - currentCount : 0;

    // If limit reached, provide upgrade message
    let upgradeMessage: string | undefined;
    if (!allowed) {
        const resourceName = RESOURCE_NAMES[limitKey] || limitKey;
        upgradeMessage = `Has alcanzado el límite de ${maxAllowed} ${resourceName}. Actualiza tu plan para obtener más.`;
    }

    return {
        allowed,
        currentCount,
        maxAllowed,
        remaining,
        upgradeMessage
    };
}
