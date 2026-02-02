import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import { atom, map } from 'nanostores';

/**
 * Billing customer state
 * Contains current user's QZPay customer information
 */
export const billingCustomer = atom<QZPayCustomer | null>(null);

/**
 * Billing subscription state
 * Contains current user's active subscription details
 */
export const billingSubscription = atom<QZPaySubscription | null>(null);

/**
 * Billing entitlements state
 * Map of feature flags indicating what user has access to
 *
 * @example
 * {
 *   "can_create_accommodation": true,
 *   "can_access_analytics": false,
 *   "can_use_advanced_search": true
 * }
 */
export const billingEntitlements = map<Record<string, boolean>>({});

/**
 * Billing limits state
 * Map of usage limits with current/max/remaining counts
 *
 * @example
 * {
 *   "accommodations": { current: 3, max: 10, remaining: 7 },
 *   "photos": { current: 45, max: 100, remaining: 55 }
 * }
 */
export const billingLimits = map<
    Record<string, { current: number; max: number; remaining: number }>
>({});

/**
 * Billing loading state
 * Indicates if billing data is currently being fetched
 */
export const billingIsLoading = atom<boolean>(false);

/**
 * Update billing customer information
 *
 * @param customer - QZPay customer object or null to clear
 */
export function updateBillingCustomer(customer: QZPayCustomer | null): void {
    billingCustomer.set(customer);
}

/**
 * Update billing subscription information
 *
 * @param subscription - QZPay subscription object or null to clear
 */
export function updateBillingSubscription(subscription: QZPaySubscription | null): void {
    billingSubscription.set(subscription);
}

/**
 * Update billing entitlements
 *
 * @param entitlements - Map of feature flags
 */
export function updateBillingEntitlements(entitlements: Record<string, boolean>): void {
    billingEntitlements.set(entitlements);
}

/**
 * Update billing limits
 *
 * @param limits - Map of usage limits with current/max/remaining counts
 */
export function updateBillingLimits(
    limits: Record<string, { current: number; max: number; remaining: number }>
): void {
    billingLimits.set(limits);
}

/**
 * Update billing loading state
 *
 * @param isLoading - Loading state
 */
export function setBillingIsLoading(isLoading: boolean): void {
    billingIsLoading.set(isLoading);
}

/**
 * Reset all billing store atoms to their default values
 * Useful for logout or clearing state
 */
export function resetBillingStore(): void {
    billingCustomer.set(null);
    billingSubscription.set(null);
    billingEntitlements.set({});
    billingLimits.set({});
    billingIsLoading.set(false);
}
