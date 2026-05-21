/**
 * QZPay HTTP Storage Adapter for the Admin Application — Trimmed
 *
 * Implements `QZPayStorageAdapter` for the admin app, but with only the
 * methods that are actually exercised at runtime by `@qazuor/qzpay-react`'s
 * `EntitlementGate` and `LimitGate`:
 *
 *   - `entitlements.getByCustomerId(customerId)` — fetched on mount by
 *     `useEntitlements`; the synchronous `hasEntitlement(key)` predicate
 *     used by `EntitlementGate` reads from this cached payload.
 *   - `entitlements.check(customerId, key)` — exposed by `useEntitlements`
 *     as `checkEntitlement()` for callers who need a server-validated probe.
 *     Not used by `EntitlementGate` itself, kept for completeness.
 *   - `limits.getByCustomerId(customerId)` — fetched on mount by `useLimits`.
 *   - `limits.check(customerId, key)` — invoked by `LimitGate` through
 *     `useLimits.checkLimit(key)`.
 *
 * Every other method on the 13 storages (customers, subscriptions, payments,
 * payment methods, invoices, plans, prices, promo codes, vendors, addons,
 * checkouts, plus the unused branches of entitlements/limits themselves) is
 * stubbed via a Proxy that throws a descriptive error if invoked. This makes
 * the dead-code surface explicit and prevents silent reliance on writes the
 * admin app never intended to do (the previous fat adapter had 25+ unused
 * methods that called `/protected/billing/*` for vendor/entitlement/limit
 * grants that the admin UI never triggers).
 *
 * Background: this was follow-up F3 from the post-SPEC-143 billing UI audit.
 * Original assumption was that the adapter was mostly dead code; on review,
 * `EntitlementGate`/`LimitGate` are real product features (gating owner-facing
 * UI by plan entitlements/limits), so the adapter has to keep working — but
 * only for those 4 methods.
 *
 * @module lib/billing-http-adapter
 */

import type {
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayEntitlementStorage,
    QZPayLimitStorage,
    QZPayStorageAdapter
} from '@qazuor/qzpay-core';

import { type HttpAdapterConfig, billingFetch } from './billing-fetch';

export type { HttpAdapterConfig } from './billing-fetch';

/**
 * Creates a Proxy that throws a descriptive error for any method invocation.
 * Used to stub the storage branches the admin app never exercises.
 */
function createThrowingStorage<T extends object>(storageName: string): T {
    return new Proxy({} as T, {
        get(_target, method) {
            return (..._args: unknown[]): never => {
                throw new Error(
                    `QZPayStorageAdapter.${storageName}.${String(method)}() is not implemented in the admin app HTTP adapter. Only entitlements.{getByCustomerId,check} and limits.{getByCustomerId,check} are live. See apps/admin/src/lib/billing-http-adapter/index.ts for the full picture.`
                );
            };
        }
    });
}

/**
 * Wraps an active storage object with a Proxy fallback so any method NOT
 * explicitly implemented also throws — same descriptive error pattern as
 * `createThrowingStorage`. This is what we use for `entitlements` and
 * `limits`, whose live methods coexist with several deliberately-unused
 * sibling methods (definitions CRUD, grant/revoke, increment, recordUsage,
 * etc.).
 */
function withThrowingFallback<T extends object>(storageName: string, activeMethods: Partial<T>): T {
    return new Proxy(activeMethods as T, {
        get(target, method) {
            if (method in target) {
                return (target as Record<string | symbol, unknown>)[method];
            }
            return (..._args: unknown[]): never => {
                throw new Error(
                    `QZPayStorageAdapter.${storageName}.${String(method)}() is not implemented in the admin app HTTP adapter. Only getByCustomerId and check are live.`
                );
            };
        }
    });
}

const entitlements = withThrowingFallback<QZPayEntitlementStorage>('entitlements', {
    findByCustomerId: async (customerId: string) =>
        billingFetch<QZPayCustomerEntitlement[]>(
            `/api/v1/protected/billing/entitlements/customer/${customerId}`
        ),
    check: async (customerId: string, entitlementKey: string) => {
        const result = await billingFetch<{ hasAccess: boolean }>(
            `/api/v1/protected/billing/entitlements/${customerId}/${entitlementKey}/check`
        );
        return result.hasAccess;
    }
});

const limits = withThrowingFallback<QZPayLimitStorage>('limits', {
    findByCustomerId: async (customerId: string) =>
        billingFetch<QZPayCustomerLimit[]>(
            `/api/v1/protected/billing/limits/customer/${customerId}`
        ),
    check: async (customerId: string, limitKey: string) =>
        billingFetch<QZPayCustomerLimit>(
            `/api/v1/protected/billing/limits/${customerId}/${limitKey}/check`
        )
});

/**
 * Creates a trimmed HTTP-based storage adapter for QZPay where only the
 * methods invoked by `EntitlementGate` and `LimitGate` are implemented.
 * All other storage methods throw on invocation.
 *
 * @param _config - Configuration (kept for backwards compatibility; unused).
 * @returns A `QZPayStorageAdapter` instance whose 13 storage branches are
 *   either live (entitlements + limits, 2 methods each) or throwing stubs.
 *
 * @example
 * ```ts
 * const adapter = createHttpBillingAdapter({
 *   apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001'
 * });
 * const billing = createQZPayBilling({ storage: adapter, defaultCurrency: 'ARS' });
 * ```
 */
export function createHttpBillingAdapter(_config: HttpAdapterConfig): QZPayStorageAdapter {
    return {
        customers: createThrowingStorage('customers'),
        subscriptions: createThrowingStorage('subscriptions'),
        payments: createThrowingStorage('payments'),
        paymentMethods: createThrowingStorage('paymentMethods'),
        invoices: createThrowingStorage('invoices'),
        plans: createThrowingStorage('plans'),
        prices: createThrowingStorage('prices'),
        promoCodes: createThrowingStorage('promoCodes'),
        vendors: createThrowingStorage('vendors'),
        entitlements,
        limits,
        addons: createThrowingStorage('addons'),
        checkouts: createThrowingStorage('checkouts'),

        /**
         * Transaction wrapper. The HTTP adapter cannot perform real
         * client-side transactions; the callback is executed directly.
         */
        transaction: async <T>(fn: () => Promise<T>): Promise<T> => fn()
    };
}
