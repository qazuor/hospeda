/**
 * Tourist Entitlement Content Filter
 *
 * Provides utility functions to filter API response content based on
 * a tourist user's subscription plan entitlements.
 *
 * Features filtered:
 * - Exclusive deals (hidden if user lacks EXCLUSIVE_DEALS entitlement)
 * - Direct contact info (hidden if user lacks direct contact entitlement)
 * - Recommendations (filtered based on entitlement)
 *
 * @module utils/tourist-entitlement-filter
 */

import { EntitlementKey } from '@repo/billing';
import type { Context } from 'hono';
import { hasEntitlement } from '../middlewares/entitlement';
import type { AppBindings } from '../types';

/**
 * Accommodation response with optional fields
 * @deprecated Currently unused - kept for future implementation
 */
interface _AccommodationResponse {
    id: string;
    name: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    exclusiveDeal?: {
        id: string;
        title: string;
        discount: number;
        validUntil: string;
    } | null;
    [key: string]: unknown;
}

/**
 * Content response that may include ads
 * @deprecated Currently unused - kept for future implementation
 */
interface _ContentWithAds {
    items: unknown[];
    ads?: Array<{
        id: string;
        type: string;
        content: unknown;
    }>;
    [key: string]: unknown;
}

/**
 * Filter options for content filtering
 */
export interface FilterOptions {
    /** Hide exclusive deals if user lacks EXCLUSIVE_DEALS entitlement */
    filterExclusiveDeals?: boolean;
    /** Hide direct contact info if user lacks direct contact entitlement */
    filterDirectContact?: boolean;
}

/**
 * Filter content for tourist based on their plan entitlements
 *
 * Removes or hides content elements that the user's plan doesn't allow access to.
 *
 * @param c - Hono context with user entitlements
 * @param content - The content to filter
 * @param options - Filter configuration options
 * @returns Filtered content appropriate for user's plan
 *
 * @example
 * ```typescript
 * import { filterContentForTourist } from '../utils/tourist-entitlement-filter';
 *
 * app.get('/accommodations', async (c) => {
 *   const results = await accommodationService.search(query);
 *
 *   const filtered = filterContentForTourist(c, results, {
 *     filterDirectContact: true,
 *     filterExclusiveDeals: true
 *   });
 *
 *   return c.json(filtered);
 * });
 * ```
 */
export function filterContentForTourist<T>(
    c: Context<AppBindings>,
    content: T,
    options: FilterOptions = {}
): T {
    const { filterExclusiveDeals = true, filterDirectContact = true } = options;

    // If content is null or undefined, return as-is
    if (content === null || content === undefined) {
        return content;
    }

    // Clone the content to avoid mutating the original
    let filtered = JSON.parse(JSON.stringify(content)) as T;

    // Filter exclusive deals if enabled and user lacks EXCLUSIVE_DEALS entitlement
    if (filterExclusiveDeals && !hasEntitlement(c, EntitlementKey.EXCLUSIVE_DEALS)) {
        filtered = hideExclusiveDeals(filtered);
    }

    // Filter direct contact info if enabled and user lacks direct contact entitlement
    // Note: Using CAN_CONTACT_WHATSAPP_DISPLAY as proxy for contact info access
    if (filterDirectContact && !hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY)) {
        filtered = hideDirectContactInfo(filtered);
    }

    return filtered;
}

/**
 * Hide exclusive deals from response content
 *
 * Removes exclusive deal information from content for users without
 * EXCLUSIVE_DEALS entitlement.
 *
 * @param content - Content that may contain exclusive deals
 * @returns Content with exclusive deals hidden
 */
function hideExclusiveDeals<T>(content: T): T {
    if (typeof content !== 'object' || content === null) {
        return content;
    }

    const result = content as Record<string, unknown>;

    // Handle single accommodation object
    if ('exclusiveDeal' in result) {
        result.exclusiveDeal = undefined;
    }

    // Handle array of accommodations
    if ('items' in result && Array.isArray(result.items)) {
        result.items = result.items.map((item) => {
            if (typeof item === 'object' && item !== null && 'exclusiveDeal' in item) {
                const filtered = { ...item };
                filtered.exclusiveDeal = undefined;
                return filtered;
            }
            return item;
        });
    }

    // Recursively hide exclusive deals from nested objects
    for (const key in result) {
        if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = hideExclusiveDeals(result[key]);
        }
    }

    return result as T;
}

/**
 * Hide direct contact information from response content
 *
 * Removes email and phone contact info for users without direct contact entitlement.
 *
 * @param content - Content that may contain contact info
 * @returns Content with contact info hidden
 */
function hideDirectContactInfo<T>(content: T): T {
    if (typeof content !== 'object' || content === null) {
        return content;
    }

    const result = content as Record<string, unknown>;

    // Hide contact fields from single object
    if ('contactEmail' in result) {
        result.contactEmail = undefined;
    }
    if ('contactPhone' in result) {
        result.contactPhone = undefined;
    }

    // Handle array of items
    if ('items' in result && Array.isArray(result.items)) {
        result.items = result.items.map((item) => {
            if (typeof item === 'object' && item !== null) {
                const filtered = { ...item };
                if ('contactEmail' in filtered) filtered.contactEmail = undefined;
                if ('contactPhone' in filtered) filtered.contactPhone = undefined;
                return filtered;
            }
            return item;
        });
    }

    // Recursively hide contact info from nested objects
    for (const key in result) {
        if (
            typeof result[key] === 'object' &&
            result[key] !== null &&
            key !== 'contactEmail' &&
            key !== 'contactPhone'
        ) {
            result[key] = hideDirectContactInfo(result[key]);
        }
    }

    return result as T;
}

/**
 * Check if user can view exclusive deals
 *
 * Convenience helper to check if user has access to exclusive deals.
 *
 * @param c - Hono context
 * @returns True if user can view exclusive deals
 *
 * @example
 * ```typescript
 * import { canViewExclusiveDeals } from '../utils/tourist-entitlement-filter';
 *
 * app.get('/deals', async (c) => {
 *   const deals = await getAllDeals();
 *
 *   if (!canViewExclusiveDeals(c)) {
 *     deals = deals.filter(d => !d.isExclusive);
 *   }
 *
 *   return c.json(deals);
 * });
 * ```
 */
export function canViewExclusiveDeals(c: Context<AppBindings>): boolean {
    return hasEntitlement(c, EntitlementKey.EXCLUSIVE_DEALS);
}

/**
 * Check if user can view direct contact info
 *
 * Convenience helper to check if user can view direct contact information.
 *
 * @param c - Hono context
 * @returns True if user can view direct contact info
 *
 * @example
 * ```typescript
 * import { canViewDirectContact } from '../utils/tourist-entitlement-filter';
 *
 * app.get('/accommodations/:id', async (c) => {
 *   const accommodation = await getAccommodation(id);
 *
 *   if (!canViewDirectContact(c)) {
 *     delete accommodation.contactEmail;
 *     delete accommodation.contactPhone;
 *   }
 *
 *   return c.json(accommodation);
 * });
 * ```
 */
export function canViewDirectContact(c: Context<AppBindings>): boolean {
    // Using CAN_CONTACT_WHATSAPP_DISPLAY as proxy for contact info access
    return hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY);
}
