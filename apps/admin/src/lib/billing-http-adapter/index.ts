/**
 * QZPay HTTP Storage Adapter for the Admin Application — Plans-extended
 *
 * Implements `QZPayStorageAdapter` for the admin app. Live methods:
 *
 * **entitlements** (used by `EntitlementGate` / `useEntitlements`):
 *   - `findByCustomerId(customerId)` — fetch customer entitlements
 *   - `check(customerId, key)` — server-validated probe
 *
 * **limits** (used by `LimitGate` / `useLimits`):
 *   - `findByCustomerId(customerId)` — fetch customer limits
 *   - `check(customerId, key)` — per-limit server probe
 *
 * **plans** (T-013 / SPEC-168 — wired to real admin endpoints):
 *   - `findById(id)` — GET /api/v1/admin/billing/plans/:id
 *   - `list(options)` — GET /api/v1/admin/billing/plans
 *
 *   Plan CRUD mutations (create/update/delete/toggle) are intentionally NOT
 *   handled here because the admin UI uses dedicated TanStack Query hooks
 *   (`useCreatePlanMutation`, `useUpdatePlanMutation`, etc.) that call
 *   `fetchApi` directly — not the QZPay adapter. The adapter's `plans`
 *   branch exists to satisfy the `QZPayStorageAdapter` interface contract.
 *
 * Every other branch (customers, subscriptions, payments, payment methods,
 * invoices, prices, promo codes, vendors, addons, checkouts) is stubbed
 * via a Proxy that throws a descriptive error on invocation. This makes
 * dead-code surface explicit and prevents silent misuse.
 *
 * Background: this was follow-up F3 from the post-SPEC-143 billing UI audit.
 * T-013 of SPEC-168 extends the adapter with a real plans branch so that
 * any code relying on `adapter.plans.*` doesn't silently throw at runtime.
 *
 * @module lib/billing-http-adapter
 */

import type {
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayEntitlementStorage,
    QZPayLimitStorage,
    QZPayListOptions,
    QZPayPlan,
    QZPayPlanStorage,
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
 * Live plans storage that calls the admin billing/plans endpoints.
 *
 * `findById` and `list` are the two read operations that the QZPay adapter
 * interface requires from the plans branch. Plan mutations (create/update/
 * delete/toggle) are handled by the dedicated TanStack Query hooks in
 * `features/billing-plans/hooks.ts`, not by this adapter.
 *
 * Remaining plan methods throw with a descriptive message via
 * `withThrowingFallback`.
 */
const plans = withThrowingFallback<QZPayPlanStorage>('plans', {
    findById: async (id: string) => billingFetch<QZPayPlan>(`/api/v1/admin/billing/plans/${id}`),

    list: async (_options?: QZPayListOptions) =>
        billingFetch<QZPayPlan[]>('/api/v1/admin/billing/plans')
});

/**
 * Creates an HTTP-based QZPay storage adapter for the admin app.
 *
 * Live branches: `entitlements` (2 methods), `limits` (2 methods),
 * `plans` (2 read methods). All other branches throw on invocation.
 *
 * @param _config - Configuration (kept for backwards compatibility; unused).
 *   The centralized `fetchApi` client resolves base URL from `VITE_API_URL`.
 * @returns A `QZPayStorageAdapter` instance.
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
        plans,
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
